-- Migration: Add Multi-Company Support via company_members

begin;

-- Create the company_members table to hold all affiliations for a user
create table if not exists public.company_members (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  company_id uuid not null references public.companies(company_id) on delete cascade,
  role text not null check (role in ('owner','manager','member')),
  
  -- Audit & basic fields
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  primary key (user_id, company_id)
);

-- Basic trigger to keep updated_at in sync
drop trigger if exists trg_company_members_updated_at on public.company_members;
create trigger trg_company_members_updated_at
  before update on public.company_members
  for each row execute function public.set_updated_at();

-- Migrate existing 1:1 data from profiles to company_members
insert into public.company_members (user_id, company_id, role, created_at, updated_at)
select user_id, company_id, role, created_at, updated_at
from public.profiles
where is_active = true and deleted_at is null
on conflict (user_id, company_id) do nothing;

-- RLS for company_members: users can see their own affiliations, or members of their active company
alter table public.company_members enable row level security;

drop policy if exists "company_members_select_own" on public.company_members;
create policy "company_members_select_own"
  on public.company_members for select
  using (user_id = auth.uid());

drop policy if exists "company_members_select_company" on public.company_members;
create policy "company_members_select_company"
  on public.company_members for select
  using (company_id = public.current_company_id());

commit;
