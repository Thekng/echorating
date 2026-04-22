-- Loosen can_write_daily_log so any active company member can save their own
-- daily log in any department of their company — the dept_members requirement
-- is dropped for self-logs. Cross-user writes (logging on behalf of another
-- member) still require the existing ladder: owner/manager anywhere; dept
-- lead within their dept and only for dept members.

create or replace function public.can_write_daily_log(
  target_department_id uuid,
  target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with current_company as (
    select public.current_company_id() as company_id
  ),
  viewer_in_company as (
    select exists (
      select 1
      from public.company_members cm
      join current_company cc on cc.company_id = cm.company_id
      where cm.user_id = auth.uid()
        and cm.is_active = true
    ) as ok
  ),
  target_in_company as (
    select exists (
      select 1
      from public.company_members cm
      join current_company cc on cc.company_id = cm.company_id
      where cm.user_id = target_user_id
        and cm.is_active = true
    ) as ok
  ),
  department_in_company as (
    select exists (
      select 1
      from public.departments d
      join current_company cc on cc.company_id = d.company_id
      where d.department_id = target_department_id
        and d.is_active = true
        and d.deleted_at is null
    ) as ok
  ),
  target_in_department as (
    select exists (
      select 1
      from public.department_members dm
      where dm.department_id = target_department_id
        and dm.user_id = target_user_id
        and dm.is_active = true
        and dm.deleted_at is null
    ) as ok
  )
  select
    (select ok from viewer_in_company)
    and (select ok from target_in_company)
    and (select ok from department_in_company)
    and (
      -- Self-log: any active company member, no dept_members requirement.
      auth.uid() = target_user_id
      -- Owner/manager: anywhere in company, but target must be in the target dept.
      or (
        public.is_owner_or_manager()
        and (select ok from target_in_department)
      )
      -- Dept lead: within the dept, target must be in the dept too.
      or (
        public.is_department_lead(target_department_id)
        and (select ok from target_in_department)
      )
    );
$$;

grant execute on function public.can_write_daily_log(uuid, uuid) to anon, authenticated, service_role;
