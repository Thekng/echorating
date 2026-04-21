import { createAdminClient } from '@/lib/supabase/admin'
import { getActorContext } from '@/lib/supabase/actor-context'

type AdminClient = ReturnType<typeof createAdminClient>

export async function getPendingCalculatedJobCount(
  admin: AdminClient,
  companyId: string,
  departmentIds?: string[],
): Promise<number> {
  let query = admin
    .from('calculated_value_jobs')
    .select('job_id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .in('status', ['pending', 'processing'])

  if (departmentIds && departmentIds.length > 0) {
    query = query.in('department_id', departmentIds)
  }

  const { count, error } = await query

  if (error) {
    return 0
  }

  return count ?? 0
}

export async function getPendingCalculatedCountForViewer(
  departmentIds?: string[],
): Promise<number> {
  const context = await getActorContext()
  if (!context.ok) {
    return 0
  }
  return getPendingCalculatedJobCount(context.admin, context.companyId, departmentIds)
}
