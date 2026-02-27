begin;

alter table if exists public.metrics
  add column if not exists sort_order integer;

with ranked as (
  select
    metric_id,
    row_number() over (
      partition by department_id
      order by coalesce(sort_order, 2147483647), created_at, metric_id
    ) as next_sort_order
  from public.metrics
  where deleted_at is null
)
update public.metrics m
set sort_order = ranked.next_sort_order
from ranked
where ranked.metric_id = m.metric_id
  and (m.sort_order is null or m.sort_order <> ranked.next_sort_order);

create index if not exists idx_metrics_department_sort_order
  on public.metrics (department_id, sort_order)
  where deleted_at is null;

commit;
