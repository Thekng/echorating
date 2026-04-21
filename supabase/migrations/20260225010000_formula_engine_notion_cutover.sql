-- One-shot cutover for formula engine v1 (Notion-like typed expressions)
-- 1) Remove legacy metric tuning fields from product model
-- 2) Add typed formula metadata
-- 3) Add typed calculated outputs (number | boolean)
-- 4) Remove async recalc queue infrastructure
-- 5) Keep mirrored entry_values in sync for calculated metrics

begin;

-- -----------------------------------------------------------------------------
-- Metrics: remove direction/precision from the product model.
-- -----------------------------------------------------------------------------
alter table if exists public.metrics
  drop column if exists direction,
  drop column if exists precision_scale;

-- -----------------------------------------------------------------------------
-- Formula storage: expression + typed AST metadata.
-- -----------------------------------------------------------------------------
alter table if exists public.metric_formulas
  add column if not exists ast_json jsonb not null default '{}'::jsonb,
  add column if not exists return_type text not null default 'number',
  add column if not exists engine_version text not null default 'notion_v1';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_metric_formulas_return_type'
      and conrelid = 'public.metric_formulas'::regclass
  ) then
    alter table public.metric_formulas
      add constraint chk_metric_formulas_return_type
      check (return_type in ('number', 'boolean'));
  end if;
end $$;

create index if not exists idx_metric_formulas_engine_current
  on public.metric_formulas (engine_version, is_current)
  where is_current = true;

-- -----------------------------------------------------------------------------
-- Calculated values: support typed output and enforce one populated value.
-- -----------------------------------------------------------------------------
alter table if exists public.calculated_values
  alter column value_numeric drop not null;

alter table if exists public.calculated_values
  add column if not exists value_bool boolean null;

alter table if exists public.calculated_values
  drop constraint if exists chk_calculated_values_exactly_one_value;

alter table if exists public.calculated_values
  add constraint chk_calculated_values_exactly_one_value
  check (((value_numeric is not null)::int + (value_bool is not null)::int) = 1);

-- -----------------------------------------------------------------------------
-- Remove async queue + helper RPCs.
-- -----------------------------------------------------------------------------
drop trigger if exists trg_enqueue_recalc_on_manual_entry_values on public.entry_values;
drop function if exists public.enqueue_recalc_on_manual_change() cascade;

drop function if exists public.dequeue_recalc_job(text, int) cascade;
drop function if exists public.complete_recalc_job(uuid, boolean, text) cascade;

drop table if exists public.recalc_queue cascade;

-- -----------------------------------------------------------------------------
-- Mirror calculated values into entry_values (typed).
-- -----------------------------------------------------------------------------
create or replace function public.mirror_calculated_to_entry_values()
returns trigger
language plpgsql
as $$
begin
  insert into public.entry_values (
    entry_id,
    metric_id,
    value_numeric,
    value_bool,
    value_text,
    value_source
  )
  values (
    new.entry_id,
    new.metric_id,
    new.value_numeric,
    new.value_bool,
    null,
    'calculated'
  )
  on conflict (entry_id, metric_id)
  do update set
    value_numeric = excluded.value_numeric,
    value_bool = excluded.value_bool,
    value_text = null,
    value_source = 'calculated',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_mirror_calc_to_entry_values on public.calculated_values;
create trigger trg_mirror_calc_to_entry_values
  after insert or update on public.calculated_values
  for each row execute function public.mirror_calculated_to_entry_values();

-- -----------------------------------------------------------------------------
-- DB fallback: invalidate calculated projections on direct manual writes.
-- This prevents stale calculated/output mirrors if writes bypass app sync compute.
-- -----------------------------------------------------------------------------
create or replace function public.invalidate_calculated_values_on_manual_change()
returns trigger
language plpgsql
as $$
declare
  target_entry_id uuid;
begin
  target_entry_id := coalesce(new.entry_id, old.entry_id);

  if target_entry_id is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' and new.value_source <> 'manual' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(new.value_source, old.value_source) <> 'manual' then
    return new;
  end if;

  if tg_op = 'DELETE' and old.value_source <> 'manual' then
    return old;
  end if;

  delete from public.calculated_values
  where entry_id = target_entry_id;

  delete from public.entry_values
  where entry_id = target_entry_id
    and value_source = 'calculated';

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invalidate_calc_on_manual_entry_values on public.entry_values;
create trigger trg_invalidate_calc_on_manual_entry_values
  after insert or update or delete on public.entry_values
  for each row execute function public.invalidate_calculated_values_on_manual_change();

commit;
