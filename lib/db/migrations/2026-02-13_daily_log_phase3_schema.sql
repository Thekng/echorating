begin;

-- Expand metric data types for daily-log rich inputs.
alter table public.metrics
  drop constraint if exists metrics_data_type_check;

alter table public.metrics
  add constraint metrics_data_type_check
  check (data_type in ('number', 'currency', 'percent', 'boolean', 'duration'));

-- Notes on the daily entry header.
alter table public.daily_entries
  add column if not exists notes text null;

create index if not exists idx_daily_entries_company_updated_at
  on public.daily_entries (company_id, updated_at desc);

-- Department-level configuration for 3 key metrics displayed in history.
create table if not exists public.department_log_key_metrics (
  department_id uuid not null references public.departments(department_id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (department_id, slot),
  constraint uq_department_log_key_metrics_metric unique (department_id, metric_id)
);

create index if not exists idx_department_log_key_metrics_metric
  on public.department_log_key_metrics (metric_id);

drop trigger if exists trg_department_log_key_metrics_updated_at on public.department_log_key_metrics;
create trigger trg_department_log_key_metrics_updated_at
  before update on public.department_log_key_metrics
  for each row execute function public.set_updated_at();

alter table public.department_log_key_metrics enable row level security;

drop policy if exists "department_log_key_metrics_select" on public.department_log_key_metrics;
create policy "department_log_key_metrics_select"
  on public.department_log_key_metrics for select
  using (
    exists (
      select 1
      from public.departments d
      where d.department_id = department_log_key_metrics.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  );

drop policy if exists "department_log_key_metrics_insert_owner_manager" on public.department_log_key_metrics;
create policy "department_log_key_metrics_insert_owner_manager"
  on public.department_log_key_metrics for insert
  with check (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_log_key_metrics.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  );

drop policy if exists "department_log_key_metrics_update_owner_manager" on public.department_log_key_metrics;
create policy "department_log_key_metrics_update_owner_manager"
  on public.department_log_key_metrics for update
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_log_key_metrics.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  )
  with check (true);

drop policy if exists "department_log_key_metrics_delete_owner_manager" on public.department_log_key_metrics;
create policy "department_log_key_metrics_delete_owner_manager"
  on public.department_log_key_metrics for delete
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_log_key_metrics.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  );

-- Bootstrap follow-up boolean KPI in active departments where missing.
insert into public.metrics (
  company_id,
  department_id,
  name,
  code,
  description,
  data_type,
  unit,
  direction,
  input_mode,
  precision_scale,
  is_active
)
select
  d.company_id,
  d.department_id,
  'Follow-Ups Completed',
  'follow_ups_completed',
  'Daily follow-up completion flag',
  'boolean',
  'bool',
  'higher_is_better',
  'manual',
  0,
  true
from public.departments d
where d.is_active = true
  and d.deleted_at is null
  and not exists (
    select 1
    from public.metrics m
    where m.company_id = d.company_id
      and m.department_id = d.department_id
      and m.code = 'follow_ups_completed'
      and m.deleted_at is null
  );

commit;
