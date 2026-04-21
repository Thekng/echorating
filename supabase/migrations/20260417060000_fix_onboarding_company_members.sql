begin;

-- Fix: create_company_with_owner_profile was not inserting into company_members,
-- so the owner had no membership row after onboarding. This broke login routing
-- (which checks company_members) and all membership-based queries.

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
    -- Ensure company_members row exists for idempotency
    insert into public.company_members (user_id, company_id, role)
    values (p_user_id, v_company_id, 'owner')
    on conflict (user_id, company_id) do nothing;

    return v_company_id;
  end if;

  insert into public.companies (
    name,
    timezone,
    industry,
    team_size,
    is_active
  ) values (
    p_company_name,
    p_timezone,
    p_industry,
    p_team_size,
    true
  )
  returning company_id into v_company_id;

  insert into public.profiles (
    user_id,
    company_id,
    name,
    role,
    is_active
  ) values (
    p_user_id,
    v_company_id,
    p_user_name,
    'owner',
    true
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

commit;
