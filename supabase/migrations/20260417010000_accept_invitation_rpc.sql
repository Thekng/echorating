-- Transactional invitation acceptance: validate + profile + company_members
-- + department_members + invitation status in one boundary. Replaces the
-- hand-rolled rollback in acceptInviteAction, which could leave orphaned
-- profile updates if company_members insert failed mid-flow.

create or replace function public.accept_invitation(
  p_user_id        uuid,
  p_invitation_id  uuid,
  p_fallback_name  text
)
returns table (company_id uuid, role text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation record;
  v_existing_profile_name text;
  v_profile_name text;
  v_now timestamptz := now();
begin
  -- 1. Load + validate invitation (row-locked to prevent concurrent accepts)
  select
    i.invitation_id, i.company_id, i.email, i.role,
    i.department_id, i.status, i.expires_at, i.auth_user_id
  into v_invitation
  from public.invitations i
  where i.invitation_id = p_invitation_id
  for update;

  if not found then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  if v_invitation.auth_user_id is not null and v_invitation.auth_user_id <> p_user_id then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  if v_invitation.status = 'revoked' then
    raise exception 'This invite has been revoked.';
  end if;

  if v_invitation.status <> 'pending' or v_invitation.expires_at <= v_now then
    raise exception 'This invite link has expired. Please ask to be invited again.';
  end if;

  -- 2. Profile upsert (legacy sync — keep name if already set)
  select p.name into v_existing_profile_name
  from public.profiles p
  where p.user_id = p_user_id;

  v_profile_name := coalesce(
    nullif(trim(v_existing_profile_name), ''),
    nullif(trim(p_fallback_name), ''),
    v_invitation.email
  );

  insert into public.profiles (
    user_id, company_id, name, role, is_active, deleted_at, updated_at
  ) values (
    p_user_id, v_invitation.company_id, v_profile_name, v_invitation.role,
    true, null, v_now
  )
  on conflict (user_id) do update set
    company_id = excluded.company_id,
    name       = excluded.name,
    role       = excluded.role,
    is_active  = true,
    deleted_at = null,
    updated_at = v_now;

  -- 3. Canonical membership
  insert into public.company_members (
    user_id, company_id, role, is_active, updated_at
  ) values (
    p_user_id, v_invitation.company_id, v_invitation.role, true, v_now
  )
  on conflict (user_id, company_id) do update set
    role       = excluded.role,
    is_active  = true,
    updated_at = v_now;

  -- 4. Department membership (optional)
  if v_invitation.department_id is not null then
    insert into public.department_members (
      department_id, user_id, member_role, is_active,
      deleted_at, end_date, updated_at
    ) values (
      v_invitation.department_id, p_user_id, 'member', true,
      null, null, v_now
    )
    on conflict (department_id, user_id) do update set
      member_role = 'member',
      is_active   = true,
      deleted_at  = null,
      end_date    = null,
      updated_at  = v_now;
  end if;

  -- 5. Mark invitation accepted
  update public.invitations set
    status        = 'accepted',
    accepted_at   = v_now,
    auth_user_id  = p_user_id,
    updated_at    = v_now
  where invitation_id = v_invitation.invitation_id;

  return query select v_invitation.company_id, v_invitation.role::text;
end;
$$;

grant execute on function public.accept_invitation(uuid, uuid, text) to service_role;
