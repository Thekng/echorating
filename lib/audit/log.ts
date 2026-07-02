import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuditEvent = {
  organizationId: string
  userId: string
  action: string
  entityType: string
  entityId: string
  metadata?: Record<string, unknown>
}

export function logAuditEvent(event: AuditEvent) {
  after(async () => {
    try {
      const admin = createAdminClient()
      await admin.from('audit_logs').insert({
        organization_id: event.organizationId,
        user_id: event.userId,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        metadata: event.metadata ?? {},
      })
    } catch (error) {
      console.error('[AUDIT_LOG_ERROR]', error instanceof Error ? error.message : error)
    }
  })
}
