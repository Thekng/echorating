-- Structured telemetry for every server action that runs through wrapAction.
-- Inserted asynchronously via `after()` so logging never pays the user's latency.
-- Query by (action_name, created_at desc) for p95 per endpoint; by
-- (outcome='unknown', created_at desc) to surface unexpected exceptions.

create table if not exists public.action_events (
  event_id       uuid primary key default gen_random_uuid(),
  action_name    text not null,
  outcome        text not null,      -- success | validation | auth | permission | database | unknown
  duration_ms    integer not null,
  user_id        uuid,
  company_id     uuid,
  error_message  text,
  commit_sha     text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_action_events_name_created_at
  on public.action_events (action_name, created_at desc);

create index if not exists idx_action_events_outcome_created_at
  on public.action_events (outcome, created_at desc);
