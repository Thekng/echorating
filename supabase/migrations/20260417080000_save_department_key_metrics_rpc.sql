-- Transactional replacement of department_log_key_metrics rows.
-- The delete + insert pattern without a transaction boundary can leave the
-- department with zero key metrics if the insert fails — breaking the
-- daily-log UI for everyone in that department.

create or replace function public.save_department_key_metrics(
  p_company_id    uuid,
  p_department_id uuid,
  p_slots         jsonb   -- [{slot: 1, metric_id: uuid|null}, ...]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard: ensure the department belongs to the calling company.
  if not exists (
    select 1
    from public.departments d
    where d.department_id = p_department_id
      and d.company_id    = p_company_id
      and d.is_active     = true
      and d.deleted_at is null
  ) then
    raise exception 'Department not found or inactive.';
  end if;

  -- Clear + repopulate atomically.
  delete from public.department_log_key_metrics
  where department_id = p_department_id;

  if p_slots is not null and jsonb_array_length(p_slots) > 0 then
    insert into public.department_log_key_metrics (department_id, slot, metric_id)
    select
      p_department_id,
      (s->>'slot')::smallint,
      (s->>'metric_id')::uuid
    from jsonb_array_elements(p_slots) as s
    where s->>'metric_id' is not null;
  end if;
end;
$$;

grant execute on function public.save_department_key_metrics(uuid, uuid, jsonb) to service_role;
