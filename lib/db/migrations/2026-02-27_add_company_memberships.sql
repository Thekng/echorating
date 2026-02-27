begin;

create table if not exists public.company_memberships (
  company_id uuid not null references public.companies(company_id) on delete cascade,
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'member')),
  is_active boolean not null default true,
  deleted_at timestamptz null,
  created_by uuid null references auth.users(id) on delete set null,
  updated_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (company_id, user_id),
  constraint chk_company_memberships_not_deleted check (
    (is_active = false) or (deleted_at is null)
  )
);

drop trigger if exists trg_company_memberships_updated_at on public.company_memberships;
create trigger trg_company_memberships_updated_at
  before update on public.company_memberships
  for each row execute function public.set_updated_at();

drop trigger if exists trg_company_memberships_audit on public.company_memberships;
create trigger trg_company_memberships_audit
  before insert or update on public.company_memberships
  for each row execute function public.set_audit_fields();

create index if not exists idx_company_memberships_user
  on public.company_memberships (user_id, is_active)
  where deleted_at is null;

create index if not exists idx_company_memberships_company_role
  on public.company_memberships (company_id, role, is_active)
  where deleted_at is null;

create or replace function public.sync_profile_to_company_memberships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.company_id is not null then
    insert into public.company_memberships (
      company_id,
      user_id,
      role,
      is_active,
      deleted_at,
      created_by,
      updated_by
    )
    values (
      new.company_id,
      new.user_id,
      new.role,
      new.is_active,
      new.deleted_at,
      new.created_by,
      new.updated_by
    )
    on conflict (company_id, user_id) do update
    set
      role = excluded.role,
      is_active = excluded.is_active,
      deleted_at = excluded.deleted_at,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists trg_profiles_sync_company_memberships on public.profiles;
create trigger trg_profiles_sync_company_memberships
  after insert or update on public.profiles
  for each row execute function public.sync_profile_to_company_memberships();

insert into public.company_memberships (
  company_id,
  user_id,
  role,
  is_active,
  deleted_at
)
select
  p.company_id,
  p.user_id,
  p.role,
  p.is_active,
  p.deleted_at
from public.profiles p
where p.company_id is not null
on conflict (company_id, user_id) do update
set
  role = excluded.role,
  is_active = excluded.is_active,
  deleted_at = excluded.deleted_at,
  updated_at = now();

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  with active_profile as (
    select p.company_id, p.role
    from public.profiles p
    where p.user_id = auth.uid()
      and p.is_active = true
      and p.deleted_at is null
    limit 1
  )
  select coalesce(
    (
      select cm.role
      from public.company_memberships cm
      join active_profile ap
        on ap.company_id = cm.company_id
      where cm.user_id = auth.uid()
        and cm.is_active = true
        and cm.deleted_at is null
      limit 1
    ),
    (select ap.role from active_profile ap limit 1)
  );
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
    from public.company_memberships cm
    where cm.user_id = auth.uid()
      and cm.company_id = target_company_id
      and cm.is_active = true
      and cm.deleted_at is null
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = target_company_id
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

grant execute on function public.current_user_role() to anon, authenticated, service_role;
grant execute on function public.is_owner_or_manager() to anon, authenticated, service_role;
grant execute on function public.is_same_company(uuid) to anon, authenticated, service_role;

commit;
