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

drop trigger if exists trg_profiles_sync_company_memberships on public.profiles;
drop function if exists public.sync_profile_to_company_memberships();

update public.profiles p
set
  name = coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(u.email, '@', 1)), ''),
    p.name
  ),
  updated_at = now()
from auth.users u
join public.company_members cm
  on cm.user_id = u.id
 and cm.role = 'owner'
 and cm.is_active = true
where p.user_id = u.id
  and p.name is distinct from coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(trim(split_part(u.email, '@', 1)), ''),
    p.name
  );

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

  insert into public.departments (
    company_id,
    name,
    description,
    is_active
  ) values (
    v_company_id,
    'General',
    'Default department',
    true
  )
  returning department_id into v_department_id;

  insert into public.department_members (
    department_id,
    user_id,
    member_role,
    is_active
  ) values (
    v_department_id,
    p_user_id,
    'lead',
    true
  )
  on conflict (department_id, user_id) do update set
    member_role = 'lead',
    is_active = true,
    deleted_at = null,
    end_date = null,
    updated_at = now();

  insert into public.metrics (
    company_id,
    department_id,
    name,
    description,
    unit,
    direction,
    aggregation_type,
    is_active
  ) values (
    v_company_id,
    v_department_id,
    'Units Produced',
    'Starter metric',
    'count',
    'higher_is_better',
    'sum',
    true
  )
  on conflict do nothing;

  return v_company_id;
end;
$$;

grant execute on function public.provision_workspace(
  uuid, text, text, text, text, text
) to service_role;
