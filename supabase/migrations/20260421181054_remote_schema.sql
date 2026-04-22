begin;

alter table public.companies
  add column if not exists owner_user_id uuid references auth.users(id) on delete restrict,
  add column if not exists contact_email text;

update public.companies c
set owner_user_id = owner_row.user_id
from (
  select distinct on (cm.company_id)
    cm.company_id,
    cm.user_id
  from public.company_members cm
  where cm.role = 'owner'
    and coalesce(cm.is_active, true) = true
  order by cm.company_id, cm.created_at nulls first, cm.user_id
) as owner_row
where c.company_id = owner_row.company_id
  and c.owner_user_id is null;

update public.companies c
set contact_email = lower(u.email)
from auth.users u
where c.owner_user_id = u.id
  and c.contact_email is null
  and u.email is not null;

do $$
begin
  if exists (
    select 1
    from public.companies
    where owner_user_id is null
  ) then
    raise exception 'Cannot continue schema pivot: at least one company is missing an owner membership.';
  end if;
end;
$$;

alter table public.companies
  alter column owner_user_id set not null;

create index if not exists idx_companies_owner_user_id
  on public.companies (owner_user_id);

create index if not exists idx_companies_contact_email
  on public.companies (lower(contact_email))
  where contact_email is not null;

create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  with claimed as (
    select case
      when coalesce(auth.jwt() -> 'app_metadata' ->> 'active_company_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then (auth.jwt() -> 'app_metadata' ->> 'active_company_id')::uuid
      else null
    end as company_id
  )
  select cm.company_id
  from claimed
  join public.company_members cm
    on cm.company_id = claimed.company_id
   and cm.user_id = auth.uid()
   and cm.is_active = true
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.company_members cm
  where cm.user_id = auth.uid()
    and cm.company_id = public.current_company_id()
    and cm.is_active = true
  limit 1;
$$;

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('owner', 'manager');
$$;

create or replace function public.is_same_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.company_members cm
    where cm.user_id = auth.uid()
      and cm.company_id = target_company_id
      and cm.is_active = true
  );
$$;

create or replace function public.is_department_lead(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.department_members dm
    join public.departments d
      on d.department_id = dm.department_id
    where dm.department_id = target_department_id
      and dm.user_id = auth.uid()
      and dm.member_role = 'lead'
      and dm.is_active = true
      and dm.deleted_at is null
      and d.company_id = public.current_company_id()
      and d.is_active = true
      and d.deleted_at is null
  );
$$;

create or replace function public.can_manage_department_metrics(target_department_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_owner_or_manager()
    or public.is_department_lead(target_department_id);
$$;

create or replace function public.can_write_daily_log(target_department_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_company as (
    select public.current_company_id() as company_id
  ),
  target_membership as (
    select exists (
      select 1
      from public.company_members cm
      join current_company cc
        on cc.company_id = cm.company_id
      where cm.user_id = target_user_id
        and cm.is_active = true
    ) as ok
  ),
  target_department_membership as (
    select exists (
      select 1
      from public.department_members dm
      join public.departments d
        on d.department_id = dm.department_id
      join current_company cc
        on cc.company_id = d.company_id
      where dm.department_id = target_department_id
        and dm.user_id = target_user_id
        and dm.is_active = true
        and dm.deleted_at is null
        and d.is_active = true
        and d.deleted_at is null
    ) as ok
  )
  select
    (
      select ok from target_membership
    )
    and (
      select ok from target_department_membership
    )
    and (
      public.is_owner_or_manager()
      or auth.uid() = target_user_id
      or public.is_department_lead(target_department_id)
    );
$$;

grant execute on function public.current_company_id() to anon, authenticated, service_role;
grant execute on function public.current_user_role() to anon, authenticated, service_role;
grant execute on function public.is_owner_or_manager() to anon, authenticated, service_role;
grant execute on function public.is_same_company(uuid) to anon, authenticated, service_role;
grant execute on function public.is_department_lead(uuid) to anon, authenticated, service_role;
grant execute on function public.can_manage_department_metrics(uuid) to anon, authenticated, service_role;
grant execute on function public.can_write_daily_log(uuid, uuid) to anon, authenticated, service_role;

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
  v_owner_email text;
begin
  select cm.company_id
    into v_company_id
  from public.company_members cm
  where cm.user_id = p_user_id
    and cm.role = 'owner'
    and cm.is_active = true
  limit 1;

  if v_company_id is not null then
    insert into public.profiles (user_id, name, is_active)
    values (p_user_id, p_user_name, true)
    on conflict (user_id) do update
    set
      name = coalesce(nullif(trim(excluded.name), ''), public.profiles.name),
      is_active = true,
      deleted_at = null,
      updated_at = now();

    insert into public.company_members (user_id, company_id, role, is_active)
    values (p_user_id, v_company_id, 'owner', true)
    on conflict (user_id, company_id) do update
    set
      role = 'owner',
      is_active = true,
      updated_at = now();

    update public.companies
    set owner_user_id = p_user_id
    where company_id = v_company_id
      and owner_user_id <> p_user_id;

    return v_company_id;
  end if;

  select lower(u.email)
    into v_owner_email
  from auth.users u
  where u.id = p_user_id;

  insert into public.companies (
    name,
    timezone,
    industry,
    team_size,
    is_active,
    owner_user_id,
    contact_email
  ) values (
    p_company_name,
    p_timezone,
    p_industry,
    p_team_size,
    true,
    p_user_id,
    v_owner_email
  )
  returning company_id into v_company_id;

  insert into public.profiles (
    user_id,
    name,
    is_active
  ) values (
    p_user_id,
    p_user_name,
    true
  )
  on conflict (user_id) do update
  set
    name = coalesce(nullif(trim(excluded.name), ''), public.profiles.name),
    is_active = true,
    deleted_at = null,
    updated_at = now();

  insert into public.company_members (user_id, company_id, role, is_active)
  values (p_user_id, v_company_id, 'owner', true)
  on conflict (user_id, company_id) do update
  set
    role = 'owner',
    is_active = true,
    updated_at = now();

  return v_company_id;
end;
$$;

grant execute on function public.create_company_with_owner_profile(
  uuid, text, text, text, text, text
) to service_role;

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
  v_owner_email   text;
begin
  select cm.company_id
    into v_company_id
  from public.company_members cm
  where cm.user_id = p_user_id
    and cm.role = 'owner'
    and cm.is_active = true
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  select lower(u.email)
    into v_owner_email
  from auth.users u
  where u.id = p_user_id;

  insert into public.companies (
    name,
    timezone,
    industry,
    team_size,
    is_active,
    owner_user_id,
    contact_email
  )
  values (
    p_company_name,
    p_timezone,
    p_industry,
    p_team_size,
    true,
    p_user_id,
    v_owner_email
  )
  returning company_id into v_company_id;

  insert into public.profiles (user_id, name, is_active)
  values (p_user_id, p_user_name, true)
  on conflict (user_id) do update set
    name       = coalesce(nullif(trim(excluded.name), ''), public.profiles.name),
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
    user_id, name, is_active, deleted_at, updated_at
  ) values (
    p_user_id, v_profile_name, true, null, v_now
  )
  on conflict (user_id) do update set
    name       = excluded.name,
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

drop trigger if exists trg_profiles_sync_company_memberships on public.profiles;
drop function if exists public.sync_profile_to_company_memberships();

drop policy if exists "profiles_select_own_company" on public.profiles;
create policy "profiles_select_own_company"
  on public.profiles for select
  using (
    (
      user_id = auth.uid()
      and deleted_at is null
    )
    or exists (
      select 1
      from public.company_members cm
      where cm.user_id = profiles.user_id
        and cm.company_id = public.current_company_id()
        and cm.is_active = true
        and profiles.deleted_at is null
    )
  );

drop policy if exists "profiles_insert_owner_manager" on public.profiles;
create policy "profiles_insert_owner_manager"
  on public.profiles for insert
  with check (
    user_id = auth.uid()
    or (
      public.is_owner_or_manager()
      and exists (
        select 1
        from public.company_members cm
        where cm.user_id = profiles.user_id
          and cm.company_id = public.current_company_id()
          and cm.is_active = true
      )
    )
  );

drop policy if exists "profiles_update_self_or_admin" on public.profiles;
create policy "profiles_update_self_or_admin"
  on public.profiles for update
  using (
    deleted_at is null
    and (
      user_id = auth.uid()
      or (
        public.is_owner_or_manager()
        and exists (
          select 1
          from public.company_members cm
          where cm.user_id = profiles.user_id
            and cm.company_id = public.current_company_id()
            and cm.is_active = true
        )
      )
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.company_members cm
      where cm.user_id = profiles.user_id
        and cm.company_id = public.current_company_id()
        and cm.is_active = true
    )
  );

drop policy if exists "metrics_insert_owner_manager" on public.metrics;
create policy "metrics_insert_owner_manager"
  on public.metrics for insert
  with check (
    company_id = public.current_company_id()
    and public.can_manage_department_metrics(department_id)
  );

drop policy if exists "metrics_update_owner_manager" on public.metrics;
create policy "metrics_update_owner_manager"
  on public.metrics for update
  using (
    company_id = public.current_company_id()
    and deleted_at is null
    and public.can_manage_department_metrics(department_id)
  )
  with check (
    company_id = public.current_company_id()
    and public.can_manage_department_metrics(department_id)
  );

drop policy if exists "metric_formulas_insert_owner_manager" on public.metric_formulas;
create policy "metric_formulas_insert_owner_manager"
  on public.metric_formulas for insert
  with check (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formulas.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
        and public.can_manage_department_metrics(m.department_id)
    )
  );

drop policy if exists "metric_formulas_update_owner_manager" on public.metric_formulas;
create policy "metric_formulas_update_owner_manager"
  on public.metric_formulas for update
  using (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formulas.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
        and public.can_manage_department_metrics(m.department_id)
    )
  )
  with check (true);

drop policy if exists "metric_deps_insert_owner_manager" on public.metric_formula_dependencies;
create policy "metric_deps_insert_owner_manager"
  on public.metric_formula_dependencies for insert
  with check (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formula_dependencies.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
        and public.can_manage_department_metrics(m.department_id)
    )
  );

drop policy if exists "metric_deps_update_owner_manager" on public.metric_formula_dependencies;
create policy "metric_deps_update_owner_manager"
  on public.metric_formula_dependencies for update
  using (
    exists (
      select 1
      from public.metrics m
      where m.metric_id = metric_formula_dependencies.metric_id
        and m.company_id = public.current_company_id()
        and m.deleted_at is null
        and public.can_manage_department_metrics(m.department_id)
    )
  )
  with check (true);

drop policy if exists "department_log_key_metrics_insert_owner_manager" on public.department_log_key_metrics;
create policy "department_log_key_metrics_insert_owner_manager"
  on public.department_log_key_metrics for insert
  with check (
    public.can_manage_department_metrics(department_id)
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
    public.can_manage_department_metrics(department_id)
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
    public.can_manage_department_metrics(department_id)
    and exists (
      select 1
      from public.departments d
      where d.department_id = department_log_key_metrics.department_id
        and d.company_id = public.current_company_id()
        and d.deleted_at is null
    )
  );

drop policy if exists "daily_entries_insert_company" on public.daily_entries;
create policy "daily_entries_insert_company"
  on public.daily_entries for insert
  with check (
    company_id = public.current_company_id()
    and public.can_write_daily_log(department_id, user_id)
    and exists (
      select 1
      from public.departments d
      where d.department_id = daily_entries.department_id
        and d.company_id = public.current_company_id()
        and d.is_active = true
        and d.deleted_at is null
    )
  );

drop policy if exists "daily_entries_update_company" on public.daily_entries;
create policy "daily_entries_update_company"
  on public.daily_entries for update
  using (
    company_id = public.current_company_id()
    and public.can_write_daily_log(department_id, user_id)
  )
  with check (
    company_id = public.current_company_id()
    and public.can_write_daily_log(department_id, user_id)
  );

drop policy if exists "entry_values_insert_company" on public.entry_values;
create policy "entry_values_insert_company"
  on public.entry_values for insert
  with check (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = entry_values.entry_id
        and e.company_id = public.current_company_id()
        and public.can_write_daily_log(e.department_id, e.user_id)
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
        and public.can_write_daily_log(e.department_id, e.user_id)
    )
  )
  with check (
    exists (
      select 1
      from public.daily_entries e
      where e.entry_id = entry_values.entry_id
        and e.company_id = public.current_company_id()
        and public.can_write_daily_log(e.department_id, e.user_id)
    )
  );

drop index if exists public.idx_profiles_company_role;
drop index if exists public.idx_profiles_active;

alter table public.profiles
  drop column if exists company_id,
  drop column if exists role;

commit;
