begin;

-- Ensure one active daily department target for each (company, department, metric).
with ranked as (
  select
    target_id,
    row_number() over (
      partition by company_id, department_id, metric_id
      order by updated_at desc nulls last, created_at desc, target_id desc
    ) as rn
  from public.targets
  where scope = 'department'
    and period = 'daily'
    and user_id is null
    and is_active = true
    and deleted_at is null
)
update public.targets t
set
  is_active = false,
  updated_at = now()
from ranked r
where t.target_id = r.target_id
  and r.rn > 1;

create unique index if not exists idx_targets_daily_dept_metric_active_unique
  on public.targets (company_id, department_id, metric_id)
  where scope = 'department'
    and period = 'daily'
    and user_id is null
    and is_active = true
    and deleted_at is null;

commit;
