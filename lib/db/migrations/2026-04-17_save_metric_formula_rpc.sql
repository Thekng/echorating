-- Transactional save for a calculated metric's formula + dependency graph.
-- The existing flow did: INSERT new formula (is_current=false) → UPDATE old
-- to is_current=false → UPDATE new to is_current=true → DELETE+INSERT deps.
-- A failure between steps 2 and 3 left the metric with NO current formula;
-- a failure during the dependency swap left stale dependencies pointing at
-- the previous formula. Both corrupt calculated-value recomputes.

create or replace function public.save_metric_formula(
  p_metric_id       uuid,
  p_expression      text,
  p_ast_json        jsonb,
  p_return_type     text,
  p_dependency_ids  uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current record;
  v_new_formula_id uuid;
  v_now timestamptz := now();
  v_next_version integer;
  v_trimmed text := btrim(coalesce(p_expression, ''));
  v_dep uuid;
begin
  -- 1. Load current formula (row-lock to serialize concurrent saves)
  select formula_id, expression, version, ast_json, return_type, engine_version
  into v_current
  from public.metric_formulas
  where metric_id = p_metric_id
    and is_current = true
  for update;

  if found
     and v_current.expression is not distinct from v_trimmed
     and v_current.ast_json   is not distinct from p_ast_json
     and v_current.return_type is not distinct from p_return_type
     and v_current.engine_version is not distinct from 'notion_v1'
  then
    -- No formula change — still replace dependencies so they stay in sync.
    delete from public.metric_formula_dependencies
    where metric_id = p_metric_id;

    if p_dependency_ids is not null then
      foreach v_dep in array p_dependency_ids loop
        insert into public.metric_formula_dependencies (metric_id, depends_on_metric_id)
        values (p_metric_id, v_dep);
      end loop;
    end if;

    return v_current.formula_id;
  end if;

  -- 2. Close the previous current formula (if any) before inserting the new one,
  --    so the "one is_current per metric" unique constraint is satisfied.
  if found then
    update public.metric_formulas set
      is_current = false,
      updated_at = v_now
    where formula_id = v_current.formula_id;
    v_next_version := coalesce(v_current.version, 0) + 1;
  else
    v_next_version := 1;
  end if;

  -- 3. Insert the new current formula
  insert into public.metric_formulas (
    metric_id, expression, ast_json, return_type, engine_version,
    version, is_current, updated_at
  ) values (
    p_metric_id, v_trimmed, p_ast_json, p_return_type, 'notion_v1',
    v_next_version, true, v_now
  )
  returning formula_id into v_new_formula_id;

  -- 4. Back-link the superseded formula (best effort — column may be absent
  --    on older schemas; ignore if it doesn't exist)
  if found then
    begin
      update public.metric_formulas set
        superseded_by = v_new_formula_id
      where formula_id = v_current.formula_id;
    exception
      when undefined_column then null;
    end;
  end if;

  -- 5. Replace dependency edges
  delete from public.metric_formula_dependencies
  where metric_id = p_metric_id;

  if p_dependency_ids is not null then
    foreach v_dep in array p_dependency_ids loop
      insert into public.metric_formula_dependencies (metric_id, depends_on_metric_id)
      values (p_metric_id, v_dep);
    end loop;
  end if;

  return v_new_formula_id;
end;
$$;

-- Clear current formula + dependencies when a metric flips from calculated → manual.
create or replace function public.clear_metric_formula(
  p_metric_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.metric_formulas set
    is_current = false,
    updated_at = now()
  where metric_id = p_metric_id
    and is_current = true;

  delete from public.metric_formula_dependencies
  where metric_id = p_metric_id;
end;
$$;

grant execute on function public.save_metric_formula(uuid, text, jsonb, text, uuid[]) to service_role;
grant execute on function public.clear_metric_formula(uuid) to service_role;
