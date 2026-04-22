insert into public.company_members (
  user_id,
  company_id,
  role,
  is_active
)
select distinct
  dm.user_id,
  d.company_id,
  'member',
  true
from public.department_members dm
join public.departments d
  on d.department_id = dm.department_id
left join public.company_members cm
  on cm.user_id = dm.user_id
 and cm.company_id = d.company_id
where dm.is_active = true
  and dm.deleted_at is null
  and d.is_active = true
  and d.deleted_at is null
  and cm.user_id is null
on conflict (user_id, company_id) do update
set
  is_active = true,
  updated_at = now();

create or replace function public.sync_department_member_to_company_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
begin
  if new.is_active = false or new.deleted_at is not null then
    return new;
  end if;

  select d.company_id
    into v_company_id
  from public.departments d
  where d.department_id = new.department_id
    and d.is_active = true
    and d.deleted_at is null;

  if v_company_id is null then
    return new;
  end if;

  insert into public.company_members (
    user_id,
    company_id,
    role,
    is_active
  )
  values (
    new.user_id,
    v_company_id,
    'member',
    true
  )
  on conflict (user_id, company_id) do update
  set
    is_active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists trg_department_members_sync_company_members on public.department_members;
create trigger trg_department_members_sync_company_members
  after insert or update on public.department_members
  for each row execute function public.sync_department_member_to_company_member();
