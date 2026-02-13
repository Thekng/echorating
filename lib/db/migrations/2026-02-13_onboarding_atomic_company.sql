begin;

-- Persist additional onboarding fields.
alter table public.companies
  add column if not exists industry text null,
  add column if not exists team_size text null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_companies_team_size'
  ) then
    alter table public.companies
      add constraint chk_companies_team_size
      check (
        team_size is null
        or team_size in ('1-10', '11-50', '51-200', '201+')
      );
  end if;
end;
$$;

-- Atomic onboarding write: create company + assign owner profile in one transaction.
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

  return v_company_id;
end;
$$;

grant execute on function public.create_company_with_owner_profile(
  uuid,
  text,
  text,
  text,
  text,
  text
) to service_role;

commit;
