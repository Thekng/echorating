'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { companySchema, companyStatusSchema } from './schemas'
import { getActorContext } from '@/lib/supabase/actor-context'
import { requireRole } from '@/lib/rbac/guards'
import { ROUTES } from '@/lib/constants/routes'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { logAuditEvent } from '@/lib/audit/log'

type CompanyActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

function field(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === 'string' ? value : ''
}

function zodMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? 'Invalid data'
}


export async function updateCompanyAction(
  _prevState: CompanyActionState,
  formData: FormData,
): Promise<CompanyActionState> {
  const parsed = companySchema.safeParse({
    name: field(formData, 'name'),
    timezone: field(formData, 'timezone'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  try {
    requireRole(context.role, 'owner')
  } catch {
    return { status: 'error', message: 'Only owners can update company settings.' }
  }

  const { error } = await context.admin
    .from('companies')
    .update({
      name: parsed.data.name.trim(),
      timezone: parsed.data.timezone,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', context.companyId)

  if (error) {
    return { status: 'error', message: formatDatabaseError(error.message) }
  }

  logAuditEvent({
    organizationId: context.organizationId,
    userId: context.userId,
    action: 'company.updated',
    entityType: 'company',
    entityId: context.companyId,
    metadata: { name: parsed.data.name.trim(), timezone: parsed.data.timezone },
  })

  revalidatePath(ROUTES.SETTINGS_COMPANY)
  return { status: 'success', message: 'Company updated successfully.' }
}

export async function toggleCompanyStatusAction(formData: FormData) {
  const parsed = companyStatusSchema.safeParse({
    nextStatus: field(formData, 'nextStatus'),
  })

  if (!parsed.success) {
    return
  }

  const context = await getActorContext()
  if (!context.ok) {
    return
  }

  try {
    requireRole(context.role, 'owner')
  } catch {
    return
  }

  const nextActive = parsed.data.nextStatus === 'active'

  await context.admin
    .from('companies')
    .update({
      is_active: nextActive,
      deleted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', context.companyId)

  revalidatePath(ROUTES.SETTINGS_COMPANY)
}
