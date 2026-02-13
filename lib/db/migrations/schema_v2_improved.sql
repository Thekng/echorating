/* ============================================================================
SUPABASE DATABASE SETUP — Agency Performance OS (v2 - IMPROVED)

Melhorias implementadas:
- ✅ Soft deletes para dados críticos
- ✅ Auditoria completa (created_by, updated_by)
- ✅ Validação de dependências circulares
- ✅ Priorização e retry na fila de recálculo
- ✅ Índices compostos otimizados
- ✅ Helpers para timezone por company
- ✅ Versionamento de fórmulas
- ✅ Tratamento de concorrência
- ✅ Preparação para particionamento futuro

Multi-tenant (companies)
- Departments + members
- Metrics (manual + calculated) + formulas + dependencies
- Targets (department/member)
- Daily entries + values (manual + calculated mirror)
- Calculated values materialized + mirrored into entry_values
- Daily scores (calendar on/off track)
- Recalc queue (async recalculation with priority)

Assumptions:
- You use Supabase Auth (auth.users)
- Each app user has a profile row in public.profiles linked to auth.users.id
- RLS is enabled and policies restrict data to the user's company
============================================================================ */

begin;

-- Extensions
create extension if not exists pgcrypto;
create extension if not exists btree_gist; -- For exclusion constraints

---
-- Utility: updated_at trigger
---

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

---
-- Utility: audit trigger for created_by/updated_by
---

create or replace function public.set_audit_fields()
returns trigger
language plpgsql
as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by = auth.uid();
    new.updated_by = auth.uid();
  elsif TG_OP = 'UPDATE' then
    new.updated_by = auth.uid();
    new.updated_at = now();
  end if;
  return new;
end;
$$;

---
-- 1) Companies
---

create table if not exists public.companies (
  company_id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'UTC',
  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit fields
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint chk_companies_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_companies_updated_at on public.companies;
create trigger trg_companies_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

drop trigger if exists trg_companies_audit on public.companies;
create trigger trg_companies_audit
  before insert or update on public.companies
  for each row execute function public.set_audit_fields();

create index if not exists idx_companies_active
  on public.companies (is_active) where deleted_at is null;

---
-- 2) Profiles (app users) — 1:1 with auth.users
---

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(company_id) on delete restrict,
  name text not null,
  role text not null check (role in ('owner','manager','member')),
  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit (created_by is self on signup)
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint chk_profiles_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists trg_profiles_audit on public.profiles;
create trigger trg_profiles_audit
  before insert or update on public.profiles
  for each row execute function public.set_audit_fields();

create index if not exists idx_profiles_company_role
  on public.profiles (company_id, role) where deleted_at is null;

create index if not exists idx_profiles_active
  on public.profiles (company_id, is_active) where deleted_at is null;

---
-- Utility: get current user's company_id from profiles
---

create or replace function public.current_company_id()
returns uuid
language sql
stable
as $$
  select company_id
  from public.profiles
  where user_id = auth.uid();
$$;

---
-- Utility: current user role + owner/manager helper
---

create or replace function public.current_user_role()
returns text
language sql
stable
as $$
  select role
  from public.profiles
  where user_id = auth.uid();
$$;

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role in ('owner','manager')
      and is_active = true
      and deleted_at is null
  );
$$;

---
-- Utility: convert timestamp to company timezone
---

create or replace function public.to_company_tz(ts timestamptz, company_uuid uuid)
returns timestamptz
language sql
stable
as $$
  select ts at time zone coalesce(
    (select timezone from public.companies where company_id = company_uuid),
    'UTC'
  );
$$;

---
-- 3) Departments
---

create table if not exists public.departments (
  department_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id) on delete cascade,
  name text not null,
  type text not null check (type in ('sales','service','life','marketing','custom')),
  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  constraint chk_departments_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_departments_updated_at on public.departments;
create trigger trg_departments_updated_at
  before update on public.departments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_departments_audit on public.departments;
create trigger trg_departments_audit
  before insert or update on public.departments
  for each row execute function public.set_audit_fields();

-- Unique constraint for active departments only
create unique index if not exists idx_departments_company_name_active
  on public.departments (company_id, name)
  where deleted_at is null;

create index if not exists idx_departments_company_active
  on public.departments (company_id, is_active) where deleted_at is null;

---
-- 4) Department Members (N:N)
---

create table if not exists public.department_members (
  department_id uuid not null references public.departments(department_id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('lead','member')),
  start_date date null,
  end_date date null,
  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  primary key (department_id, user_id),
  
  constraint chk_dept_members_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_department_members_updated_at on public.department_members;
create trigger trg_department_members_updated_at
  before update on public.department_members
  for each row execute function public.set_updated_at();

drop trigger if exists trg_department_members_audit on public.department_members;
create trigger trg_department_members_audit
  before insert or update on public.department_members
  for each row execute function public.set_audit_fields();

create index if not exists idx_dept_members_user
  on public.department_members (user_id, is_active) where deleted_at is null;

create index if not exists idx_dept_members_dept
  on public.department_members (department_id, is_active) where deleted_at is null;

---
-- 5) Metrics (manual + calculated)
---

create table if not exists public.metrics (
  metric_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id) on delete cascade,
  department_id uuid not null references public.departments(department_id) on delete cascade,

  name text not null,
  code text not null, -- stable slug e.g. 'talk_time_min'
  description text null,

  data_type text not null check (data_type in ('number','currency','percent')),
  unit text not null, -- 'count','min','usd','pct'
  direction text not null check (direction in ('higher_is_better','lower_is_better')),

  input_mode text not null check (input_mode in ('manual','calculated')),
  precision_scale int not null default 0 check (precision_scale >= 0 and precision_scale <= 6),

  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_metrics_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_metrics_updated_at on public.metrics;
create trigger trg_metrics_updated_at
  before update on public.metrics
  for each row execute function public.set_updated_at();

drop trigger if exists trg_metrics_audit on public.metrics;
create trigger trg_metrics_audit
  before insert or update on public.metrics
  for each row execute function public.set_audit_fields();

-- Unique constraint for active metrics only
create unique index if not exists idx_metrics_company_dept_code_active
  on public.metrics (company_id, department_id, code)
  where deleted_at is null;

create index if not exists idx_metrics_company_dept_active
  on public.metrics (company_id, department_id, is_active) where deleted_at is null;

create index if not exists idx_metrics_company_code
  on public.metrics (company_id, code) where deleted_at is null;

---
-- 6) Metric formulas (with versioning)
---

create table if not exists public.metric_formulas (
  formula_id uuid primary key default gen_random_uuid(),
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,
  expression text not null, -- e.g. 'sold_items / quotes'
  notes text null,
  
  -- Versioning
  version int not null default 1,
  is_current boolean not null default true,
  superseded_by uuid null references public.metric_formulas(formula_id) on delete set null,
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_metric_formulas_updated_at on public.metric_formulas;
create trigger trg_metric_formulas_updated_at
  before update on public.metric_formulas
  for each row execute function public.set_updated_at();

create unique index if not exists idx_metric_formulas_current
  on public.metric_formulas (metric_id, is_current)
  where (is_current = true);

create index if not exists idx_metric_formulas_version
  on public.metric_formulas (metric_id, version desc);

---
-- 6b) Formula dependencies with circular validation
---

create table if not exists public.metric_formula_dependencies (
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,
  depends_on_metric_id uuid not null references public.metrics(metric_id) on delete restrict,
  primary key (metric_id, depends_on_metric_id),
  constraint chk_no_self_dependency check (metric_id <> depends_on_metric_id)
);

create index if not exists idx_formula_deps_depends
  on public.metric_formula_dependencies (depends_on_metric_id);

-- Prevent circular dependencies
create or replace function public.check_circular_dependency()
returns trigger
language plpgsql
as $$
declare
  visited uuid[];
  current_id uuid;
  next_ids uuid[];
  next_batch uuid[];
begin
  -- Simple cycle detection using iterative DFS
  visited := array[new.metric_id];
  next_ids := array[new.depends_on_metric_id];
  
  while coalesce(array_length(next_ids, 1), 0) > 0 loop
    current_id := next_ids[1];
    next_ids := next_ids[2:];
    
    -- If we've seen this node, we have a cycle
    if current_id = any(visited) then
      raise exception 'Circular dependency detected: metric % depends on itself through chain', new.metric_id;
    end if;
    
    visited := visited || current_id;
    
    -- Add dependencies of current node
    select array_agg(depends_on_metric_id)
    into next_batch
    from public.metric_formula_dependencies 
    where metric_id = current_id;
    
    if next_batch is not null then
      next_ids := next_ids || next_batch;
    end if;
  end loop;
  
  return new;
end;
$$;

drop trigger if exists trg_check_circular_dependency on public.metric_formula_dependencies;
create trigger trg_check_circular_dependency
  before insert or update on public.metric_formula_dependencies
  for each row execute function public.check_circular_dependency();

---
-- 7) Targets (department + member)
---

create table if not exists public.targets (
  target_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id) on delete cascade,
  department_id uuid not null references public.departments(department_id) on delete cascade,
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,

  scope text not null check (scope in ('department','member')),
  user_id uuid null references public.profiles(user_id) on delete cascade,

  period text not null check (period in ('daily','weekly','monthly','quarterly','yearly')),
  value numeric not null,

  start_date date null,
  end_date date null,

  is_active boolean not null default true,
  
  -- Soft delete
  deleted_at timestamptz null,
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_target_scope_user
    check (
      (scope = 'member' and user_id is not null) or
      (scope = 'department' and user_id is null)
    ),
  constraint chk_targets_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_targets_updated_at on public.targets;
create trigger trg_targets_updated_at
  before update on public.targets
  for each row execute function public.set_updated_at();

drop trigger if exists trg_targets_audit on public.targets;
create trigger trg_targets_audit
  before insert or update on public.targets
  for each row execute function public.set_audit_fields();

create index if not exists idx_targets_lookup
  on public.targets (company_id, department_id, metric_id, scope, period, is_active) 
  where deleted_at is null;

create index if not exists idx_targets_member
  on public.targets (company_id, user_id, period, is_active) 
  where deleted_at is null;

---
-- 8) Department rules (e.g., 2 of 5 = on track)
---

create table if not exists public.department_rules (
  department_id uuid primary key references public.departments(department_id) on delete cascade,
  company_id uuid not null references public.companies(company_id) on delete cascade,
  daily_pass_threshold int not null default 2 check (daily_pass_threshold >= 0),
  
  -- Audit
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_department_rules_updated_at on public.department_rules;
create trigger trg_department_rules_updated_at
  before update on public.department_rules
  for each row execute function public.set_updated_at();

drop trigger if exists trg_department_rules_audit on public.department_rules;
create trigger trg_department_rules_audit
  before insert or update on public.department_rules
  for each row execute function public.set_audit_fields();

create index if not exists idx_dept_rules_company
  on public.department_rules (company_id);

---
-- 9) Daily entries (header) - Prepared for partitioning
---

create table if not exists public.daily_entries (
  entry_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id) on delete cascade,
  department_id uuid not null references public.departments(department_id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,

  entry_date date not null,

  status text not null default 'submitted' check (status in ('draft','submitted')),
  submitted_at timestamptz null,
  
  -- Optimistic locking for concurrency control
  version int not null default 1,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_daily_entry unique (company_id, department_id, user_id, entry_date)
) /* PARTITION BY RANGE (entry_date) -- Uncomment when ready to partition */;

drop trigger if exists trg_daily_entries_updated_at on public.daily_entries;
create trigger trg_daily_entries_updated_at
  before update on public.daily_entries
  for each row execute function public.set_updated_at();

-- Optimistic locking: increment version on update
create or replace function public.increment_entry_version()
returns trigger
language plpgsql
as $$
begin
  new.version = old.version + 1;
  return new;
end;
$$;

drop trigger if exists trg_daily_entries_version on public.daily_entries;
create trigger trg_daily_entries_version
  before update on public.daily_entries
  for each row execute function public.increment_entry_version();

create index if not exists idx_entries_company_dept_date
  on public.daily_entries (company_id, department_id, entry_date);

create index if not exists idx_entries_company_user_date
  on public.daily_entries (company_id, user_id, entry_date);

create index if not exists idx_entries_status_date
  on public.daily_entries (status, entry_date) where status = 'draft';

---
-- 10) Entry values (manual + calculated mirror)
---

create table if not exists public.entry_values (
  entry_value_id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.daily_entries(entry_id) on delete cascade,
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,

  value_numeric numeric null,
  value_text text null,
  value_bool boolean null,

  value_source text not null default 'manual'
    check (value_source in ('manual','calculated')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_entry_metric unique (entry_id, metric_id),
  constraint chk_at_least_one_value
    check (value_numeric is not null or value_text is not null or value_bool is not null)
);

drop trigger if exists trg_entry_values_updated_at on public.entry_values;
create trigger trg_entry_values_updated_at
  before update on public.entry_values
  for each row execute function public.set_updated_at();

-- Optimized composite index for lookups
create index if not exists idx_entry_values_lookup
  on public.entry_values (entry_id, metric_id, value_source);

create index if not exists idx_entry_values_metric
  on public.entry_values (metric_id);

create index if not exists idx_entry_values_entry
  on public.entry_values (entry_id);

-- Prevent manual writes to calculated metrics in entry_values
create or replace function public.prevent_manual_write_to_calculated_metrics()
returns trigger
language plpgsql
as $$
declare
  mode text;
begin
  select input_mode into mode
  from public.metrics
  where metric_id = new.metric_id;

  if mode = 'calculated' and new.value_source <> 'calculated' then
    raise exception 'Cannot write manual value for calculated metric %', new.metric_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_manual_write_to_calculated on public.entry_values;
create trigger trg_prevent_manual_write_to_calculated
  before insert or update on public.entry_values
  for each row execute function public.prevent_manual_write_to_calculated_metrics();

---
-- 11) Calculated values (materialized) + mirror into entry_values
---

create table if not exists public.calculated_values (
  calculated_value_id uuid primary key default gen_random_uuid(),

  entry_id uuid not null references public.daily_entries(entry_id) on delete cascade,
  metric_id uuid not null references public.metrics(metric_id) on delete cascade,

  value_numeric numeric not null,
  computed_at timestamptz not null default now(),
  version_hash text not null,
  calc_trace jsonb null,
  
  -- Link to formula version used
  formula_id uuid null references public.metric_formulas(formula_id) on delete set null,

  constraint uq_calculated_entry_metric unique (entry_id, metric_id)
);

create index if not exists idx_calc_values_entry
  on public.calculated_values (entry_id);

create index if not exists idx_calc_values_metric
  on public.calculated_values (metric_id);

create index if not exists idx_calc_values_computed_at
  on public.calculated_values (computed_at);

create index if not exists idx_calc_values_formula
  on public.calculated_values (formula_id);

-- Enforce: only calculated metrics can exist in calculated_values
create or replace function public.enforce_calculated_metric_only()
returns trigger
language plpgsql
as $$
declare
  mode text;
begin
  select input_mode into mode
  from public.metrics
  where metric_id = new.metric_id;

  if mode is distinct from 'calculated' then
    raise exception 'metric_id % is not calculated (input_mode=%)', new.metric_id, mode;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_calculated_metric_only on public.calculated_values;
create trigger trg_enforce_calculated_metric_only
  before insert or update on public.calculated_values
  for each row execute function public.enforce_calculated_metric_only();

-- Mirror calculated_values into entry_values for easy dashboard queries
create or replace function public.mirror_calculated_to_entry_values()
returns trigger
language plpgsql
as $$
begin
  insert into public.entry_values (entry_id, metric_id, value_numeric, value_source)
  values (new.entry_id, new.metric_id, new.value_numeric, 'calculated')
  on conflict (entry_id, metric_id)
  do update set
    value_numeric = excluded.value_numeric,
    value_text = null,
    value_bool = null,
    value_source = 'calculated',
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_mirror_calc_to_entry_values on public.calculated_values;
create trigger trg_mirror_calc_to_entry_values
  after insert or update on public.calculated_values
  for each row execute function public.mirror_calculated_to_entry_values();

---
-- 12) Daily scores (calendar on/off track) - Prepared for partitioning
---

create table if not exists public.daily_scores (
  company_id uuid not null references public.companies(company_id) on delete cascade,
  department_id uuid not null references public.departments(department_id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,

  score_date date not null,
  met_targets_count int not null default 0,
  total_targets_count int not null default 0,
  status text not null check (status in ('on_track','off_track','no_data')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (department_id, user_id, score_date)
) /* PARTITION BY RANGE (score_date) -- Uncomment when ready to partition */;

drop trigger if exists trg_daily_scores_updated_at on public.daily_scores;
create trigger trg_daily_scores_updated_at
  before update on public.daily_scores
  for each row execute function public.set_updated_at();

create index if not exists idx_scores_company_dept_date
  on public.daily_scores (company_id, department_id, score_date);

create index if not exists idx_scores_status
  on public.daily_scores (company_id, department_id, status, score_date);

create index if not exists idx_scores_user_date
  on public.daily_scores (user_id, score_date);

---
-- 13) Recalc queue (async recalculation pipeline with priority)
---

create table if not exists public.recalc_queue (
  entry_id uuid primary key references public.daily_entries(entry_id) on delete cascade,
  
  -- Priority and retry logic
  priority int not null default 0, -- Higher = more urgent
  retry_count int not null default 0,
  max_retries int not null default 3,
  error_message text null,
  
  -- Status tracking
  status text not null default 'pending' 
    check (status in ('pending','processing','completed','failed')),
  
  requested_at timestamptz not null default now(),
  processing_started_at timestamptz null,
  processed_at timestamptz null,
  
  -- Lock for distributed workers
  locked_by text null, -- worker ID
  locked_until timestamptz null
);

create index if not exists idx_recalc_queue_status_priority
  on public.recalc_queue (status, priority desc, requested_at) 
  where status = 'pending';

create index if not exists idx_recalc_queue_lock
  on public.recalc_queue (locked_until) 
  where status = 'processing' and locked_until is not null;

-- Enqueue recalculation when manual values change
create or replace function public.enqueue_recalc_on_manual_change()
returns trigger
language plpgsql
as $$
declare
  src text;
begin
  -- Only enqueue on manual value changes
  src := coalesce(new.value_source, old.value_source, 'manual');
  if src = 'manual' then
    insert into public.recalc_queue (entry_id, priority)
    values (coalesce(new.entry_id, old.entry_id), 5) -- Medium priority
    on conflict (entry_id) do update
    set requested_at = now(),
        status = 'pending',
        priority = greatest(public.recalc_queue.priority, 5),
        retry_count = 0,
        error_message = null;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_enqueue_recalc_on_manual_entry_values on public.entry_values;
create trigger trg_enqueue_recalc_on_manual_entry_values
  after insert or update or delete on public.entry_values
  for each row execute function public.enqueue_recalc_on_manual_change();

---
-- Helper: Dequeue next recalc job (for workers)
---

create or replace function public.dequeue_recalc_job(worker_id text, lock_duration_seconds int default 300)
returns table(entry_id uuid, priority int, retry_count int)
language plpgsql
as $$
declare
  job_entry_id uuid;
  job_priority int;
  job_retry_count int;
begin
  -- Find and lock next available job
  select rq.entry_id, rq.priority, rq.retry_count
  into job_entry_id, job_priority, job_retry_count
  from public.recalc_queue rq
  where rq.status = 'pending'
    and rq.retry_count < rq.max_retries
    and (rq.locked_until is null or rq.locked_until < now())
  order by rq.priority desc, rq.requested_at asc
  limit 1
  for update skip locked;

  if job_entry_id is not null then
    -- Lock the job
    update public.recalc_queue
    set status = 'processing',
        locked_by = worker_id,
        locked_until = now() + (lock_duration_seconds || ' seconds')::interval,
        processing_started_at = now()
    where recalc_queue.entry_id = job_entry_id;
    
    return query select job_entry_id, job_priority, job_retry_count;
  end if;
end;
$$;

---
-- Helper: Mark recalc job as completed
---

create or replace function public.complete_recalc_job(job_entry_id uuid, success boolean, error_msg text default null)
returns void
language plpgsql
as $$
begin
  if success then
    update public.recalc_queue
    set status = 'completed',
        processed_at = now(),
        locked_by = null,
        locked_until = null,
        error_message = null
    where entry_id = job_entry_id;
  else
    update public.recalc_queue
    set status = case 
          when retry_count + 1 >= max_retries then 'failed'
          else 'pending'
        end,
        retry_count = retry_count + 1,
        error_message = error_msg,
        locked_by = null,
        locked_until = null,
        processing_started_at = null
    where entry_id = job_entry_id;
  end if;
end;
$$;

---
-- RLS (Row Level Security)
---

-- Enable RLS
alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.department_members enable row level security;
alter table public.metrics enable row level security;
alter table public.metric_formulas enable row level security;
alter table public.metric_formula_dependencies enable row level security;
alter table public.targets enable row level security;
alter table public.department_rules enable row level security;
alter table public.daily_entries enable row level security;
alter table public.entry_values enable row level security;
alter table public.calculated_values enable row level security;
alter table public.daily_scores enable row level security;
alter table public.recalc_queue enable row level security;

-- Helper: is user in same company for a given company_id
create or replace function public.is_same_company(target_company_id uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = target_company_id
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

---
-- PROFILES policies (Admin CRUD: owner/manager can manage company profiles)
---

drop policy if exists "profiles_select_own_company" on public.profiles;
create policy "profiles_select_own_company"
  on public.profiles for select
  using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists "profiles_insert_owner_manager" on public.profiles;
create policy "profiles_insert_owner_manager"
  on public.profiles for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (
    company_id = public.current_company_id()
    and deleted_at is null
    and (
      user_id = auth.uid()
      or public.is_owner_or_manager()
    )
  )
  with check (
    company_id = public.current_company_id()
  );

---
-- COMPANIES policies (read for company members; update only owner)
---

drop policy if exists "companies_select_own" on public.companies;
create policy "companies_select_own"
  on public.companies for select
  using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists "companies_update_owner_only" on public.companies;
create policy "companies_update_owner_only"
  on public.companies for update
  using (
    company_id = public.current_company_id()
    and public.current_user_role() = 'owner'
    and deleted_at is null
  )
  with check (company_id = public.current_company_id());

---
-- Departments (select company; write owner/manager)
---

drop policy if exists "departments_select" on public.departments;
create policy "departments_select"
  on public.departments for select
  using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists "departments_insert_owner_manager" on public.departments;
create policy "departments_insert_owner_manager"
  on public.departments for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "departments_update_owner_manager" on public.departments;
create policy "departments_update_owner_manager"
  on public.departments for update
  using (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
    and deleted_at is null
  )
  with check (company_id = public.current_company_id());

---
-- Department members (select same company via join; write owner/manager)
---

drop policy if exists "department_members_select" on public.department_members;
create policy "department_members_select"
  on public.department_members for select
  using (
    deleted_at is null
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_members.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  );

drop policy if exists "department_members_insert_owner_manager" on public.department_members;
create policy "department_members_insert_owner_manager"
  on public.department_members for insert
  with check (
    exists (
      select 1
      from public.departments d
      where d.department_id = department_members.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
    and public.is_owner_or_manager()
  );

drop policy if exists "department_members_update_owner_manager" on public.department_members;
create policy "department_members_update_owner_manager"
  on public.department_members for update
  using (
    deleted_at is null
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_members.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
    and public.is_owner_or_manager()
  )
  with check (true);

---
-- Metrics / formulas / deps / targets / rules — select same company; write owner/manager
---

-- Metrics
drop policy if exists "metrics_select" on public.metrics;
create policy "metrics_select"
  on public.metrics for select
  using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists "metrics_insert_owner_manager" on public.metrics;
create policy "metrics_insert_owner_manager"
  on public.metrics for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "metrics_update_owner_manager" on public.metrics;
create policy "metrics_update_owner_manager"
  on public.metrics for update
  using (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
    and deleted_at is null
  )
  with check (company_id = public.current_company_id());

-- Metric formulas (company inferred via metrics join)
drop policy if exists "metric_formulas_select" on public.metric_formulas;
create policy "metric_formulas_select"
  on public.metric_formulas for select
  using (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formulas.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  );

drop policy if exists "metric_formulas_insert_owner_manager" on public.metric_formulas;
create policy "metric_formulas_insert_owner_manager"
  on public.metric_formulas for insert
  with check (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formulas.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  );

drop policy if exists "metric_formulas_update_owner_manager" on public.metric_formulas;
create policy "metric_formulas_update_owner_manager"
  on public.metric_formulas for update
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formulas.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  )
  with check (true);

-- Dependencies (company inferred via metric)
drop policy if exists "metric_deps_select" on public.metric_formula_dependencies;
create policy "metric_deps_select"
  on public.metric_formula_dependencies for select
  using (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formula_dependencies.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  );

drop policy if exists "metric_deps_insert_owner_manager" on public.metric_formula_dependencies;
create policy "metric_deps_insert_owner_manager"
  on public.metric_formula_dependencies for insert
  with check (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formula_dependencies.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  );

drop policy if exists "metric_deps_update_owner_manager" on public.metric_formula_dependencies;
create policy "metric_deps_update_owner_manager"
  on public.metric_formula_dependencies for update
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formula_dependencies.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
    )
  )
  with check (true);

-- Targets
drop policy if exists "targets_select" on public.targets;
create policy "targets_select"
  on public.targets for select
  using (company_id = public.current_company_id() and deleted_at is null);

drop policy if exists "targets_insert_owner_manager" on public.targets;
create policy "targets_insert_owner_manager"
  on public.targets for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "targets_update_owner_manager" on public.targets;
create policy "targets_update_owner_manager"
  on public.targets for update
  using (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
    and deleted_at is null
  )
  with check (company_id = public.current_company_id());

-- Department rules
drop policy if exists "department_rules_select" on public.department_rules;
create policy "department_rules_select"
  on public.department_rules for select
  using (company_id = public.current_company_id());

drop policy if exists "department_rules_insert_owner_manager" on public.department_rules;
create policy "department_rules_insert_owner_manager"
  on public.department_rules for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "department_rules_update_owner_manager" on public.department_rules;
create policy "department_rules_update_owner_manager"
  on public.department_rules for update
  using (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  )
  with check (company_id = public.current_company_id());

---
-- DAILY LOG: Members can create/update daily_entries and entry_values for ANYONE in the same company
---

-- Daily entries: everyone in company can read
drop policy if exists "daily_entries_select_company" on public.daily_entries;
create policy "daily_entries_select_company"
  on public.daily_entries for select
  using (company_id = public.current_company_id());

-- Daily entries: everyone in company can insert (for any user_id in same company)
drop policy if exists "daily_entries_insert_company" on public.daily_entries;
create policy "daily_entries_insert_company"
  on public.daily_entries for insert
  with check (
    company_id = public.current_company_id()
    and exists (
      select 1
      from public.profiles pu
      where pu.user_id = daily_entries.user_id
        and pu.company_id = public.current_company_id()
        and pu.is_active = true
        and pu.deleted_at is null
    )
    and exists (
      select 1
      from public.departments d
      where d.department_id = daily_entries.department_id
        and d.company_id = public.current_company_id()
        and d.is_active = true
        and d.deleted_at is null
    )
  );

-- Daily entries: everyone in company can update
drop policy if exists "daily_entries_update_company" on public.daily_entries;
create policy "daily_entries_update_company"
  on public.daily_entries for update
  using (company_id = public.current_company_id())
  with check (company_id = public.current_company_id());

-- Entry values: everyone in company can read (via entry header join)
drop policy if exists "entry_values_select_company" on public.entry_values;
create policy "entry_values_select_company"
  on public.entry_values for select
  using (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = entry_values.entry_id
        and e.company_id = public.current_company_id()
    )
  );

-- Entry values: everyone in company can insert/update (via entry header join)
drop policy if exists "entry_values_insert_company" on public.entry_values;
create policy "entry_values_insert_company"
  on public.entry_values for insert
  with check (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = entry_values.entry_id
        and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "entry_values_update_company" on public.entry_values;
create policy "entry_values_update_company"
  on public.entry_values for update
  using (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = entry_values.entry_id
        and e.company_id = public.current_company_id()
    )
  )
  with check (true);

---
-- Calculated values: read company; write owner/manager only
---

drop policy if exists "calculated_values_select_company" on public.calculated_values;
create policy "calculated_values_select_company"
  on public.calculated_values for select
  using (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = calculated_values.entry_id
        and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "calculated_values_insert_owner_manager" on public.calculated_values;
create policy "calculated_values_insert_owner_manager"
  on public.calculated_values for insert
  with check (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.daily_entries e
      where e.entry_id = calculated_values.entry_id
        and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "calculated_values_update_owner_manager" on public.calculated_values;
create policy "calculated_values_update_owner_manager"
  on public.calculated_values for update
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.daily_entries e
      where e.entry_id = calculated_values.entry_id
        and e.company_id = public.current_company_id()
    )
  )
  with check (true);

---
-- Daily scores: read company; write owner/manager (or calculation job)
---

drop policy if exists "daily_scores_select_company" on public.daily_scores;
create policy "daily_scores_select_company"
  on public.daily_scores for select
  using (company_id = public.current_company_id());

drop policy if exists "daily_scores_insert_owner_manager" on public.daily_scores;
create policy "daily_scores_insert_owner_manager"
  on public.daily_scores for insert
  with check (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  );

drop policy if exists "daily_scores_update_owner_manager" on public.daily_scores;
create policy "daily_scores_update_owner_manager"
  on public.daily_scores for update
  using (
    company_id = public.current_company_id()
    and public.is_owner_or_manager()
  )
  with check (true);

---
-- Recalc queue: owner/manager only
---

drop policy if exists "recalc_queue_select_owner_manager" on public.recalc_queue;
create policy "recalc_queue_select_owner_manager"
  on public.recalc_queue for select
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.daily_entries e
      where e.entry_id = recalc_queue.entry_id
        and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "recalc_queue_insert_owner_manager" on public.recalc_queue;
create policy "recalc_queue_insert_owner_manager"
  on public.recalc_queue for insert
  with check (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.daily_entries e
      where e.entry_id = recalc_queue.entry_id
        and e.company_id = public.current_company_id()
    )
  );

drop policy if exists "recalc_queue_update_owner_manager" on public.recalc_queue;
create policy "recalc_queue_update_owner_manager"
  on public.recalc_queue for update
  using (
    public.is_owner_or_manager()
    and exists (
      select 1
      from public.daily_entries e
      where e.entry_id = recalc_queue.entry_id
        and e.company_id = public.current_company_id()
    )
  )
  with check (true);

commit;

/* ============================================================================
MIGRATION NOTES (from v1 to v2):

1. SOFT DELETES:
   - Add `deleted_at timestamptz null` to all tables with soft delete
   - Update all queries to filter `where deleted_at is null`
   - Update RLS policies to include `deleted_at is null` checks

2. AUDIT FIELDS:
   - Add `created_by` and `updated_by` uuid columns
   - Add audit trigger to all tables: trg_[table]_audit

3. FORMULA VERSIONING:
   - metric_formulas now has versioning (formula_id PK, version, is_current)
   - Old migration: copy existing formula rows with version=1, is_current=true
   - calculated_values.formula_id links to the formula version used

4. OPTIMISTIC LOCKING:
   - daily_entries.version added for concurrency control
   - Client should send version when updating and handle conflicts

5. RECALC QUEUE ENHANCEMENTS:
   - Added priority, retry_count, status fields
   - Added helper functions: dequeue_recalc_job, complete_recalc_job
   - Workers should use these functions for job processing

6. PARTITIONING (optional):
   - Uncomment PARTITION BY clauses in daily_entries and daily_scores
   - Create partitions for each month/quarter as needed
   - Example: CREATE TABLE daily_entries_2025_q1 PARTITION OF daily_entries 
              FOR VALUES FROM ('2025-01-01') TO ('2025-04-01');

7. CIRCULAR DEPENDENCY CHECK:
   - Now validated automatically on insert/update in metric_formula_dependencies
   - Will raise exception if cycle detected

============================================================================ */
