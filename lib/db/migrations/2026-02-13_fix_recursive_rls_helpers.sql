begin;

-- Fix recursive RLS evaluation:
-- profiles policies call helper functions that previously selected from profiles
-- under invoker security, which re-entered the same policies.
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id
  from public.profiles
  where user_id = auth.uid()
    and is_active = true
    and deleted_at is null
  limit 1;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where user_id = auth.uid()
    and is_active = true
    and deleted_at is null
  limit 1;
$$;

create or replace function public.is_owner_or_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = auth.uid()
      and role in ('owner', 'manager')
      and is_active = true
      and deleted_at is null
  );
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
    from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = target_company_id
      and p.is_active = true
      and p.deleted_at is null
  );
$$;

grant execute on function public.current_company_id() to anon, authenticated, service_role;
grant execute on function public.current_user_role() to anon, authenticated, service_role;
grant execute on function public.is_owner_or_manager() to anon, authenticated, service_role;
grant execute on function public.is_same_company(uuid) to anon, authenticated, service_role;

commit;
