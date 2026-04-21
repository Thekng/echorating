-- Minimal Supabase-compatible scaffolding so migrations can apply against a
-- plain postgres:17 CI container. Production uses real Supabase; CI only needs
-- enough of the auth schema to satisfy references in lib/db/migrations/.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
  language sql
  stable
as $$
  select current_setting('request.jwt.claim.sub', true)::uuid;
$$;

create or replace function auth.role() returns text
  language sql
  stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon');
$$;
