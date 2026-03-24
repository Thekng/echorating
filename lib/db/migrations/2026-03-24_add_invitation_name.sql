begin;

alter table public.invitations
  add column if not exists name text null;

commit;
