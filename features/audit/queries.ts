'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { requireRole } from '@/lib/rbac/guards'

export type AuditLogEntry = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  user_id: string
  user_name: string | null
}

export type AuditLogFilters = {
  page?: number
  pageSize?: number
  action?: string
  entityType?: string
  startDate?: string
  endDate?: string
}

export type AuditLogResult =
  | { ok: true; entries: AuditLogEntry[]; totalCount: number }
  | { ok: false; message: string; entries: AuditLogEntry[]; totalCount: number }

export async function getAuditLogs(
  filters: AuditLogFilters = {},
): Promise<AuditLogResult> {
  const context = await getActorContext()
  if (!context.ok) {
    return { ok: false, message: context.message, entries: [], totalCount: 0 }
  }

  try {
    requireRole(context.role, 'manager')
  } catch {
    return { ok: false, message: 'Insufficient permissions.', entries: [], totalCount: 0 }
  }

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 25
  const offset = (page - 1) * pageSize

  let query = context.admin
    .from('audit_logs')
    .select('id, user_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' })
    .eq('organization_id', context.organizationId)
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1)

  if (filters.action) {
    query = query.eq('action', filters.action)
  }

  if (filters.entityType) {
    query = query.eq('entity_type', filters.entityType)
  }

  if (filters.startDate) {
    query = query.gte('created_at', `${filters.startDate}T00:00:00Z`)
  }

  if (filters.endDate) {
    query = query.lte('created_at', `${filters.endDate}T23:59:59Z`)
  }

  const { data, error, count } = await query

  if (error) {
    return { ok: false, message: formatDatabaseError(error.message), entries: [], totalCount: 0 }
  }

  const entries = (data ?? []) as Array<{
    id: string
    user_id: string
    action: string
    entity_type: string
    entity_id: string
    metadata: Record<string, unknown>
    created_at: string
  }>

  // Fetch user names
  const userIds = Array.from(new Set(entries.map((e) => e.user_id)))
  let nameByUserId = new Map<string, string | null>()

  if (userIds.length > 0) {
    const { data: profilesData } = await context.admin
      .from('organization_members')
      .select('user_id, profiles!inner(full_name)')
      .eq('organization_id', context.organizationId)
      .in('user_id', userIds)

    nameByUserId = new Map(
      ((profilesData ?? []) as Array<{
        user_id: string
        profiles: { full_name?: string | null } | Array<{ full_name?: string | null }> | null
      }>).map((p) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
        return [p.user_id, profile?.full_name ?? null] as const
      }),
    )
  }

  const result: AuditLogEntry[] = entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    metadata: entry.metadata,
    created_at: entry.created_at,
    user_id: entry.user_id,
    user_name: nameByUserId.get(entry.user_id) ?? null,
  }))

  return { ok: true, entries: result, totalCount: count ?? 0 }
}
