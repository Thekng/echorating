-- Queue for deferred calculated-metric recomputation.
-- Save flow enqueues a job row; a worker route drains the queue out-of-band
-- so the user's save response no longer pays for O(n_metrics * formula_eval).

create table if not exists public.calculated_value_jobs (
  job_id         uuid primary key default gen_random_uuid(),
  entry_id       uuid not null,
  company_id     uuid not null,
  department_id  uuid not null,
  status         text not null default 'pending',    -- pending | processing | completed | failed
  attempts       integer not null default 0,
  last_error     text,
  created_at     timestamptz not null default now(),
  claimed_at     timestamptz,
  completed_at   timestamptz,
  constraint calculated_value_jobs_entry_fk
    foreign key (entry_id) references public.daily_entries(entry_id) on delete cascade
);

-- Fast scan for the worker claiming jobs.
create index if not exists idx_calc_value_jobs_pending
  on public.calculated_value_jobs (created_at)
  where status in ('pending', 'failed');

-- Collapse duplicate enqueues for the same entry while a prior job is in flight.
create unique index if not exists idx_calc_value_jobs_unique_active
  on public.calculated_value_jobs (entry_id)
  where status in ('pending', 'processing');

-- Enqueue: idempotent per entry — if a pending/processing job already exists, reuse it.
create or replace function public.enqueue_calculated_recompute_job(
  p_entry_id      uuid,
  p_company_id    uuid,
  p_department_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  insert into public.calculated_value_jobs (entry_id, company_id, department_id)
  values (p_entry_id, p_company_id, p_department_id)
  on conflict (entry_id) where status in ('pending', 'processing')
  do update set
    company_id    = excluded.company_id,
    department_id = excluded.department_id
  returning job_id into v_job_id;

  return v_job_id;
end;
$$;

-- Claim: atomically grabs up to N pending jobs (SKIP LOCKED so parallel workers
-- don't fight for the same rows). Returns the claimed rows to the caller.
create or replace function public.claim_calculated_recompute_jobs(
  p_limit integer,
  p_max_attempts integer default 5
)
returns table (
  job_id        uuid,
  entry_id      uuid,
  company_id    uuid,
  department_id uuid,
  attempts      integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select j.job_id
    from public.calculated_value_jobs j
    where j.status in ('pending', 'failed')
      and j.attempts < p_max_attempts
    order by j.created_at
    for update skip locked
    limit p_limit
  )
  update public.calculated_value_jobs j
     set status     = 'processing',
         attempts   = j.attempts + 1,
         claimed_at = now()
    from claimed
   where j.job_id = claimed.job_id
   returning j.job_id, j.entry_id, j.company_id, j.department_id, j.attempts;
end;
$$;

-- Complete: mark success (row is removed) or failure (row kept for retry, with error captured).
create or replace function public.complete_calculated_recompute_job(
  p_job_id   uuid,
  p_error    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_error is null then
    delete from public.calculated_value_jobs where job_id = p_job_id;
  else
    update public.calculated_value_jobs set
      status       = 'failed',
      last_error   = p_error,
      completed_at = now()
    where job_id = p_job_id;
  end if;
end;
$$;

grant execute on function public.enqueue_calculated_recompute_job(uuid, uuid, uuid) to service_role;
grant execute on function public.claim_calculated_recompute_jobs(integer, integer) to service_role;
grant execute on function public.complete_calculated_recompute_job(uuid, text) to service_role;
