-- Per-save latency telemetry. Written asynchronously from the server action
-- via `after()` so the measurement doesn't pay the cost it is measuring.
-- Query p50/p95 grouped by commit_sha to verify architectural changes.

create table if not exists public.daily_log_save_metrics (
  metric_id              uuid primary key default gen_random_uuid(),
  company_id             uuid not null,
  department_id          uuid not null,
  entry_id               uuid,
  duration_ms            integer not null,
  manual_metric_count    integer not null default 0,
  calculated_metric_count integer not null default 0,
  had_calculated_enqueue boolean not null default false,
  commit_sha             text,
  outcome                text not null,           -- success | error
  created_at             timestamptz not null default now()
);

create index if not exists idx_save_metrics_created_at
  on public.daily_log_save_metrics (created_at desc);

create index if not exists idx_save_metrics_commit
  on public.daily_log_save_metrics (commit_sha, created_at desc);
