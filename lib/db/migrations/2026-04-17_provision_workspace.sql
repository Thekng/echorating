-- Atomic workspace provisioning for agency onboarding.
-- Replaces create_company_with_owner_profile with a function that also
-- bootstraps a default department, assigns the owner to it, and seeds
-- a starter metric — so the workspace is immediately usable.

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
  -- Idempotency: if the user already owns a company, return it.
  select cm.company_id into v_company_id
  from public.company_members cm
  where cm.user_id = p_user_id
    and cm.role = 'owner'
    and cm.is_active = true
  limit 1;

  if v_company_id is not null then
    return v_company_id;
  end if;

  -- 1. Company
  insert into public.companies (name, timezone, industry, team_size, is_active)
  values (p_company_name, p_timezone, p_industry, p_team_size, true)
  returning company_id into v_company_id;

  -- 2. Profile (legacy sync — profiles still required by FK constraints)
  insert into public.profiles (user_id, company_id, name, role, is_active)
  values (p_user_id, v_company_id, p_user_name, 'owner', true)
  on conflict (user_id) do update set
    company_id = excluded.company_id,
    name       = coalesce(nullif(trim(profiles.name), ''), excluded.name),
    role       = 'owner',
    is_active  = true,
    deleted_at = null,
    updated_at = now();

  -- 3. Canonical membership
  insert into public.company_members (user_id, company_id, role, is_active)
  values (p_user_id, v_company_id, 'owner', true)
  on conflict (user_id, company_id) do update set
    role       = 'owner',
    is_active  = true,
    updated_at = now();

  -- 4. Default department
  insert into public.departments (company_id, name, type, is_active, created_by)
  values (v_company_id, 'General', 'custom', true, p_user_id)
  returning department_id into v_department_id;

  -- 5. Owner → department assignment
  insert into public.department_members (department_id, user_id, member_role, is_active)
  values (v_department_id, p_user_id, 'lead', true)
  on conflict (department_id, user_id) do nothing;

  -- 6. Starter metric so the daily-log form isn't empty
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
