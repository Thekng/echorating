'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { departmentFilterSchema } from './schemas'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

async function getViewerContext() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false as const, message: 'SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { ok: false as const, message: 'Authentication required.' }
  }

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (profileError) {
    return { ok: false as const, message: formatDatabaseError(profileError.message) }
  }

  if (!profile?.company_id) {
    return { ok: false as const, message: 'Company profile not found.' }
  }

  return {
    ok: true as const,
    admin,
    companyId: profile.company_id as string,
  }
}

export async function listDepartments(rawFilters?: {
  q?: string
  status?: string
  type?: string
}) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: [], count: 0 }
  }

  const parsedFilters = departmentFilterSchema.safeParse({
    q: rawFilters?.q,
    status: rawFilters?.status,
    type: rawFilters?.type,
  })

  if (!parsedFilters.success) {
    return { success: false, error: 'Invalid filters.', data: [], count: 0 }
  }

  const filters = parsedFilters.data

  let query = context.admin
    .from('departments')
    .select('department_id, name, type, is_active, created_at, updated_at', { count: 'exact' })
    .eq('company_id', context.companyId)
    .order('created_at', { ascending: false })

  if (filters.q?.trim()) {
    query = query.ilike('name', `%${filters.q.trim()}%`)
  }

  if (filters.status !== 'all') {
    query = query.eq('is_active', filters.status === 'active')
  }

  if (filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }

  const { data, error: listError, count } = await query

  if (listError) {
    return { success: false, error: formatDatabaseError(listError.message), data: [], count: 0 }
  }

  return { success: true, data: data ?? [], count: count ?? 0, filters }
}

export async function getDepartmentById(id: string) {
  const context = await getViewerContext()
  if (!context.ok) {
    return { success: false, error: context.message, data: null }
  }

  const { data, error: queryError } = await context.admin
    .from('departments')
    .select('department_id, name, type, is_active, created_at, updated_at')
    .eq('department_id', id)
    .eq('company_id', context.companyId)
    .maybeSingle()

  if (queryError) {
    return { success: false, error: formatDatabaseError(queryError.message), data: null }
  }

  return { success: true, data }
}
