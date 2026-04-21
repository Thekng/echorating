-- =============================================================================
-- Bundled apply script for the 2026-04-17 migration set.
-- Paste this whole file into the Supabase SQL Editor and run once.
-- Safe to re-run: every statement uses CREATE OR REPLACE / IF NOT EXISTS.
--
-- Dependency order:
--   1. company_members.is_active column  (required by 3, 4, 6)
--   2. fix_onboarding_company_members    (legacy RPC — keeps old path working)
--   3. provision_workspace               (new onboarding RPC — uses is_active)
--   4. accept_invitation                 (invite acceptance RPC — uses is_active)
--   5. action_events                     (telemetry table — independent)
--   6. save_latency_metrics              (telemetry table — independent)
--   7. calculated_value_jobs             (queue table + RPCs)
--   8. daily_log_save_rpc                (save_daily_log_entry RPC)
--   9. save_department_key_metrics_rpc   (dept key-metric slots RPC)
--  10. save_metric_formula_rpc           (formula + clear_metric_formula RPCs)
-- =============================================================================


-- =============================================================================
-- 1/10  2026-04-17_company_members_is_active.sql
-- =============================================================================

ALTER TABLE public.company_members
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.company_members cm
SET is_active = p.is_active
FROM public.profiles p
WHERE cm.user_id = p.user_id
  AND p.is_active = false;

CREATE INDEX IF NOT EXISTS idx_company_members_active
  ON public.company_members (company_id, is_active)
  WHERE is_active = true;


-- =============================================================================
-- 2/10  2026-04-17_fix_onboarding_company_members.sql
-- =============================================================================

create or replace function public.create_company_with_owner_profile(
  p_user_id uuid,
  p_user_name text,
  p_company_name text,
  p_timezone text,
  p_industry text,
  p_team_size text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  select company_id
    into v_company_id
  from public.profiles
  where user_id = p_user_id
    and is_active = true
    and deleted_at is null
  limit 1;

  if v_company_id is not null then
    insert into public.company_members (user_id, company_id, role)
    values (p_user_id, v_company_id, 'owner')
    on conflict (user_id, company_id) do nothing;

    return v_company_id;
  end if;

  insert into public.companies (
    name, timezone, industry, team_size, is_active
  ) values (
    p_company_name, p_timezone, p_industry, p_team_size, true
  )
  returning company_id into v_company_id;

  insert into public.profiles (
    user_id, company_id, name, role, is_active
  ) values (
    p_user_id, v_company_id, p_user_name, 'owner', true
  )
  on conflict (user_id) do update
  set
    company_id = excluded.company_id,
    name = excluded.name,
    role = 'owner',
    is_active = true,
    deleted_at = null,
    updated_at = now();

  insert into public.company_members (user_id, company_id, role)
  values (p_user_id, v_company_id, 'owner')
  on conflict (user_id, company_id) do update
  set role = 'owner', updated_at = now();

  return v_company_id;
end;
$$;

grant execute on function public.create_company_with_owner_profile(
  uuid, text, text, text, text, text
) to service_role;


-- =============================================================================
-- 3/10  2026-04-17_provision_workspace.sql
-- =============================================================================

create or replace function public.provision_workspace(
  p_user_id       uuid,
  p_user_name     text,
  p_company_name  text,
  p_timezone      text,
  p_industry      text,
  p_team_size     text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id    uuid;
  v_department_id uuid;
begin
  select cm.company_id into v_company_id
  from public.company_members cm
  where cm.user_id = p_user_id
    and cm.role = 'owner'
    and cm.is_active = true
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  insert into public.companies (name, timezone, industry, team_size, is_active)
  values (p_company_name, p_timezone, p_industry, p_team_size, true)
  returning company_id into v_company_id;

  insert into public.profiles (user_id, company_id, name, role, is_active)
  values (p_user_id, v_company_id, p_user_name, 'owner', true)
  on conflict (user_id) do update set
    company_id = excluded.company_id,
    name       = coalesce(nullif(trim(profiles.name), ''), excluded.name),
    role       = 'owner',
    is_active  = true,
    deleted_at = null,
    updated_at = now();

  insert into public.company_members (user_id, company_id, role, is_active)
  values (p_user_id, v_company_id, 'owner', true)
  on conflict (user_id, company_id) do update set
    role       = 'owner',
    is_active  = true,
    updated_at = now();

  insert into public.departments (company_id, name, type, is_active, created_by)
  values (v_company_id, 'General', 'custom', true, p_user_id)
  returning department_id into v_department_id;

  insert into public.department_members (department_id, user_id, member_role, is_active)
  values (v_department_id, p_user_id, 'lead', true)
  on conflict (department_id, user_id) do nothing;

  insert into public.metrics (
    company_id, department_id, name, code, description,
    data_type, unit, settings, direction, input_mode, precision_scale,
    sort_order, is_active, created_by
  ) values (
    v_company_id, v_department_id,
    'Follow-Ups Completed', 'follow_ups_completed',
    'Daily follow-up completion flag',
    'boolean', 'bool', '{}'::jsonb,
    'higher_is_better', 'manual', 0,
    1, true, p_user_id
  );

  return v_company_id;
end;
$$;

grant execute on function public.provision_workspace(
  uuid, text, text, text, text, text
) to service_role;


-- =============================================================================
-- 4/10  2026-04-17_accept_invitation_rpc.sql
-- =============================================================================

create or replace function public.accept_invitation(
  p_user_id        uuid,
  p_invitation_id  uuid,
  p_fallback_name  text
)
returns table (company_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_existing_profile_name text;
  v_profile_name text;
  v_now timestamptz := now();
begin
  select
    i.invitation_id, i.company_id, i.email, i.role,
    i.department_id, i.status, i.expires_at, i.auth_user_id
  into v_invitation
  from public.invitations i
  where i.invitation_id = p_invitation_id
  for update;

  if not found then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  if v_invitation.auth_user_id is not null and v_invitation.auth_user_id <> p_user_id then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'This invite has been revoked.';
  end if;

  if v_invitation.status <> 'pending' or v_invitation.expires_at <= v_now then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  select p.name into v_existing_profile_name
  from public.profiles p
  where p.user_id = p_user_id;

  v_profile_name := coalesce(
    nullif(trim(v_existing_profile_name), ''),
    nullif(trim(p_fallback_name), ''),
    v_invitation.email
  );

  insert into public.profiles (
    user_id, company_id, name, role, is_active, deleted_at, updated_at
  ) values (
    p_user_id, v_invitation.company_id, v_profile_name, v_invitation.role,
    true, null, v_now
  )
  on conflict (user_id) do update set
    company_id = excluded.company_id,
    name       = excluded.name,
    role       = excluded.role,
    is_active  = true,
    deleted_at = null,
    updated_at = v_now;

  insert into public.company_members (
    user_id, company_id, role, is_active, updated_at
  ) values (
    p_user_id, v_invitation.company_id, v_invitation.role, true, v_now
  )
  on conflict (user_id, company_id) do update set
    role       = excluded.role,
    is_active  = true,
    updated_at = v_now;

  if v_invitation.department_id is not null then
    insert into public.department_members (
      department_id, user_id, member_role, is_active,
      deleted_at, end_date, updated_at
    ) values (
      v_invitation.department_id, p_user_id, 'member', true,
      null, null, v_now
    )
    on conflict (department_id, user_id) do update set
      member_role = 'member',
      is_active   = true,
      deleted_at  = null,
      end_date    = null,
      updated_at  = v_now;
  end if;

  update public.invitations set
    status        = 'accepted',
    accepted_at   = v_now,
    auth_user_id  = p_user_id,
    updated_at    = v_now
  where invitation_id = v_invitation.invitation_id;

  return query select v_invitation.company_id, v_invitation.role::text;
end;
$$;

grant execute on function public.accept_invitation(uuid, uuid, text) to service_role;


-- =============================================================================
-- 5/10  2026-04-17_action_events.sql
-- =============================================================================

create table if not exists public.action_events (
  event_id       uuid primary key default gen_random_uuid(),
  action_name    text not null,
  outcome        text not null,
  duration_ms    integer not null,
  user_id        uuid,
  company_id     uuid,
  error_message  text,
  commit_sha     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_action_events_name_created_at
  on public.action_events (action_name, created_at desc);

create index if not exists idx_action_events_outcome_created_at
  on public.action_events (outcome, created_at desc);


-- =============================================================================
-- 6/10  2026-04-17_save_latency_metrics.sql
-- =============================================================================

create table if not exists public.daily_log_save_metrics (
  metric_id              uuid primary key default gen_random_uuid(),
  company_id             uuid not null,
  department_id          uuid not null,
  entry_id               uuid,
  duration_ms            integer not null,
  manual_metric_count    integer not null default 0,
  calculated_metric_count integer not null default 0,
  had_calculated_enqueue boolean not null default false,
  commit_sha             text,
  outcome                text not null,
  created_at             timestamptz not null default now()
);

create index if not exists idx_save_metrics_created_at
  on public.daily_log_save_metrics (created_at desc);

create index if not exists idx_save_metrics_commit
  on public.daily_log_save_metrics (commit_sha, created_at desc);


-- =============================================================================
-- 7/10  2026-04-17_calculated_value_jobs.sql
-- =============================================================================

create table if not exists public.calculated_value_jobs (
  job_id         uuid primary key default gen_random_uuid(),
  entry_id       uuid not null,
  company_id     uuid not null,
  department_id  uuid not null,
  status         text not null default 'pending',
  attempts       integer not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  completed_at   timestamptz,
  constraint calculated_value_jobs_entry_fk
    foreign key (entry_id) references public.daily_entries(entry_id) on delete cascade
);

create index if not exists idx_calc_value_jobs_pending
  on public.calculated_value_jobs (created_at)
  where status in ('pending', 'failed');

create unique index if not exists idx_calc_value_jobs_unique_active
  on public.calculated_value_jobs (entry_id)
  where status in ('pending', 'processing');

create or replace function public.enqueue_calculated_recompute_job(
  p_entry_id      uuid,
  p_company_id    uuid,
  p_department_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  insert into public.calculated_value_jobs (entry_id, company_id, department_id)
  values (p_entry_id, p_company_id, p_department_id)
  on conflict (entry_id) where status in ('pending', 'processing')
  do update set
    company_id    = excluded.company_id,
    department_id = excluded.department_id
  returning job_id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.claim_calculated_recompute_jobs(
  p_limit integer,
  p_max_attempts integer default 5
)
returns table (
  job_id        uuid,
  entry_id      uuid,
  company_id    uuid,
  department_id uuid,
  attempts      integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select j.job_id
    from public.calculated_value_jobs j
    where j.status in ('pending', 'failed')
      and j.attempts < p_max_attempts
    order by j.created_at
    for update skip locked
    limit p_limit
  )
  update public.calculated_value_jobs j
     set status     = 'processing',
         attempts   = j.attempts + 1,
         claimed_at = now()
    from claimed
   where j.job_id = claimed.job_id
   returning j.job_id, j.entry_id, j.company_id, j.department_id, j.attempts;
end;
$$;

create or replace function public.complete_calculated_recompute_job(
  p_job_id   uuid,
  p_error    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error is null then
    delete from public.calculated_value_jobs where job_id = p_job_id;
  else
    update public.calculated_value_jobs set
      status       = 'failed',
      last_error   = p_error,
      completed_at = now()
    where job_id = p_job_id;
  end if;
end;
$$;

grant execute on function public.enqueue_calculated_recompute_job(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_calculated_recompute_jobs(integer, integer) to service_role;
grant execute on function public.complete_calculated_recompute_job(uuid, text) to service_role;


-- =============================================================================
-- 8/10  2026-04-17_daily_log_save_rpc.sql
-- =============================================================================

create or replace function public.save_daily_log_entry(
  p_entry_id      uuid,
  p_company_id    uuid,
  p_department_id uuid,
  p_user_id       uuid,
  p_entry_date    date,
  p_status        text,
  p_submitted_at  timestamptz,
  p_notes         text,
  p_values        jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entry_id uuid;
begin
  if p_entry_id is not null then
    update daily_entries set
      entry_date   = p_entry_date,
      status       = p_status,
      submitted_at = p_submitted_at,
      notes        = p_notes,
      updated_at   = now()
    where entry_id  = p_entry_id
      and company_id = p_company_id
    returning entry_id into v_entry_id;

    if v_entry_id is null then
      raise exception 'Entry not found or does not belong to this company.';
    end if;
  else
    insert into daily_entries (
      company_id, department_id, user_id, entry_date,
      status, submitted_at, notes, updated_at
    ) values (
      p_company_id, p_department_id, p_user_id, p_entry_date,
      p_status, p_submitted_at, p_notes, now()
    )
    on conflict (company_id, department_id, user_id, entry_date)
    do update set
      status       = excluded.status,
      submitted_at = excluded.submitted_at,
      notes        = excluded.notes,
      updated_at   = now()
    returning entry_id into v_entry_id;
  end if;

  delete from entry_values     where entry_id = v_entry_id;
  delete from calculated_values where entry_id = v_entry_id;

  if p_values is not null and jsonb_array_length(p_values) > 0 then
    insert into entry_values (
      entry_id, metric_id, value_numeric, value_text, value_bool, value_source
    )
    select
      v_entry_id,
      (v->>'metric_id')::uuid,
      (v->>'value_numeric')::numeric,
      nullif(v->>'value_text', ''),
      (v->>'value_bool')::boolean,
      'manual'
    from jsonb_array_elements(p_values) as v;
  end if;

  return v_entry_id;
end;
$$;


-- =============================================================================
-- 9/10  2026-04-17_save_department_key_metrics_rpc.sql
-- =============================================================================

create or replace function public.save_department_key_metrics(
  p_company_id    uuid,
  p_department_id uuid,
  p_slots         jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
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


-- =============================================================================
-- 10/10  2026-04-17_save_metric_formula_rpc.sql
-- =============================================================================

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

  if found then
    update public.metric_formulas set
      is_current = false,
      updated_at = v_now
    where formula_id = v_current.formula_id;
    v_next_version := coalesce(v_current.version, 0) + 1;
  else
    v_next_version := 1;
  end if;

  insert into public.metric_formulas (
    metric_id, expression, ast_json, return_type, engine_version,
    version, is_current, updated_at
  ) values (
    p_metric_id, v_trimmed, p_ast_json, p_return_type, 'notion_v1',
    v_next_version, true, v_now
  )
  returning formula_id into v_new_formula_id;

  if found then
    begin
      update public.metric_formulas set
        superseded_by = v_new_formula_id
      where formula_id = v_current.formula_id;
    exception
      when undefined_column then null;
    end;
  end if;

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
