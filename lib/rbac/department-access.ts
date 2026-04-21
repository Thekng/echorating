import { createAdminClient } from '@/lib/supabase/admin'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { type Role } from './roles'

type Admin = ReturnType<typeof createAdminClient>

export type DepartmentOption = {
  department_id: string
  name: string
}

export type DepartmentIdsResult =
  | { ok: true; departmentIds: string[] }
  | { ok: false; message: string; departmentIds: [] }

export type DepartmentOptionsResult =
  | { ok: true; departments: DepartmentOption[] }
  | { ok: false; message: string; departments: [] }

async function listMembershipDepartmentIds(
  admin: Admin,
  userId: string,
): Promise<DepartmentIdsResult> {
  const { data, error } = await admin
    .from('department_members')
    .select('department_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    return { ok: false, message: formatDatabaseError(error.message), departmentIds: [] }
  }

  const ids = Array.from(
    new Set((data ?? []).map((row) => row.department_id as string).filter(Boolean)),
  )
  return { ok: true, departmentIds: ids }
}

export async function getAccessibleDepartmentIds(
  admin: Admin,
  companyId: string,
  userId: string,
  role: Role,
): Promise<DepartmentIdsResult> {
  if (role === 'owner' || role === 'manager') {
    const { data, error } = await admin
      .from('departments')
      .select('department_id')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)

    if (error) {
      return { ok: false, message: formatDatabaseError(error.message), departmentIds: [] }
    }

    return {
      ok: true,
      departmentIds: (data ?? []).map((row) => row.department_id as string),
    }
  }

  const memberships = await listMembershipDepartmentIds(admin, userId)
  if (!memberships.ok) return memberships
  if (memberships.departmentIds.length === 0) {
    return { ok: true, departmentIds: [] }
  }

  const { data, error } = await admin
    .from('departments')
    .select('department_id')
    .eq('company_id', companyId)
    .in('department_id', memberships.departmentIds)
    .eq('is_active', true)
    .is('deleted_at', null)

  if (error) {
    return { ok: false, message: formatDatabaseError(error.message), departmentIds: [] }
  }

  return {
    ok: true,
    departmentIds: (data ?? []).map((row) => row.department_id as string),
  }
}

export async function getAccessibleDepartments(
  admin: Admin,
  companyId: string,
  userId: string,
  role: Role,
): Promise<DepartmentOptionsResult> {
  if (role === 'owner' || role === 'manager') {
    const { data, error } = await admin
      .from('departments')
      .select('department_id, name')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .order('name', { ascending: true })

    if (error) {
      return { ok: false, message: formatDatabaseError(error.message), departments: [] }
    }

    return { ok: true, departments: (data ?? []) as DepartmentOption[] }
  }

  const memberships = await listMembershipDepartmentIds(admin, userId)
  if (!memberships.ok) {
    return { ok: false, message: memberships.message, departments: [] }
  }
  if (memberships.departmentIds.length === 0) {
    return { ok: true, departments: [] }
  }

  const { data, error } = await admin
    .from('departments')
    .select('department_id, name')
    .eq('company_id', companyId)
    .in('department_id', memberships.departmentIds)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name', { ascending: true })

  if (error) {
    return { ok: false, message: formatDatabaseError(error.message), departments: [] }
  }

  return { ok: true, departments: (data ?? []) as DepartmentOption[] }
}

export async function canAccessDepartment(
  admin: Admin,
  companyId: string,
  userId: string,
  role: Role,
  departmentId: string,
): Promise<{ ok: true; allowed: boolean } | { ok: false; message: string }> {
  const result = await getAccessibleDepartmentIds(admin, companyId, userId, role)
  if (!result.ok) {
    return { ok: false, message: result.message }
  }
  return { ok: true, allowed: result.departmentIds.includes(departmentId) }
}
