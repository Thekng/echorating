begin;

create table public.invitations (
  invitation_id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(company_id),
  email text not null,
  role text not null check (role in ('manager', 'member')),
  department_id uuid references public.departments(department_id),
  invited_by uuid not null references auth.users(id),
  auth_user_id uuid references auth.users(id),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  last_sent_at timestamptz,
  resent_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index invitations_company_email_active
  on public.invitations (company_id, lower(email))
  where status = 'pending';

alter table public.invitations enable row level security;

create policy "invitations_select_owner_manager"
on public.invitations for select
using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = invitations.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager')
  )
);

create policy "invitations_insert_owner_manager"
on public.invitations for insert
with check (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = invitations.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager')
  )
);

create policy "invitations_update_owner_manager"
on public.invitations for update
using (
  exists (
    select 1 from public.company_members cm
    where cm.company_id = invitations.company_id
      and cm.user_id = auth.uid()
      and cm.role in ('owner', 'manager')
  )
);

commit;
