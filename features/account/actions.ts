'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { updateProfileSchema, changePasswordSchema } from './schemas'
import { getActorContext } from '@/lib/supabase/actor-context'
import { createClient } from '@/lib/supabase/server'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

type AccountActionState = {
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

export async function updateProfileAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = updateProfileSchema.safeParse({
    full_name: field(formData, 'full_name'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const context = await getActorContext()
  if (!context.ok) {
    return { status: 'error', message: context.message }
  }

  const { error } = await context.admin
    .from('profiles')
    .update({ full_name: parsed.data.full_name })
    .eq('id', context.userId)

  if (error) {
    return { status: 'error', message: formatDatabaseError(error.message) }
  }

  revalidatePath('/account')
  revalidatePath('/', 'layout')
  return { status: 'success', message: 'Profile updated successfully.' }
}

export async function changePasswordAction(
  _prevState: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const parsed = changePasswordSchema.safeParse({
    currentPassword: field(formData, 'currentPassword'),
    newPassword: field(formData, 'newPassword'),
    confirmPassword: field(formData, 'confirmPassword'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return { status: 'error', message: 'Authentication required.' }
  }

  // Verify current password by attempting sign-in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.currentPassword,
  })

  if (signInError) {
    return { status: 'error', message: 'Current password is incorrect.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  })

  if (updateError) {
    return { status: 'error', message: updateError.message }
  }

  return { status: 'success', message: 'Password changed successfully.' }
}
