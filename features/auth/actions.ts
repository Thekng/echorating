'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { loginSchema, signupSchema, resetPasswordSchema, createPasswordSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ROUTES } from '@/lib/constants/routes'
import { syncSessionClaims } from '@/lib/supabase/session-claims'
import { type Role, isRole } from '@/lib/rbac/roles'

type AuthActionState = {
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

function sanitizeAuthError(rawMessage: string): string {
  const lower = rawMessage.toLowerCase()
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'An account with this email already exists. Try logging in instead.'
  }
  if (lower.includes('rate limit') || lower.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  if (lower.includes('password') && lower.includes('weak')) {
    return 'Password is too weak. Use at least 8 characters with a mix of letters and numbers.'
  }
  if (lower.includes('email') && lower.includes('not confirmed')) {
    return 'Please check your email and confirm your account before signing in.'
  }
  console.error('[AUTH_ERROR]', rawMessage)
  return 'Unable to complete this action. Please try again or contact support.'
}

function sanitizeRedirectPath(rawPath: string) {
  if (!rawPath.startsWith('/')) {
    return ROUTES.DASHBOARD
  }

  if (rawPath.startsWith('//')) {
    return ROUTES.DASHBOARD
  }

  return rawPath
}

export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: field(formData, 'email'),
    password: field(formData, 'password'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { status: 'error', message: 'Email or password is invalid.' }
  }

  const admin = createAdminClient()
  const { data: memberships } = await admin
    .from('company_members')
    .select('company_id, role')
    .eq('user_id', authData.user.id)
    .eq('is_active', true)

  const membershipCount = memberships?.length || 0
  await syncSessionClaims(authData.user.id)

  if (membershipCount > 1) {
    redirect(ROUTES.SELECT_COMPANY)
  }

  const nextPath = sanitizeRedirectPath(field(formData, 'next'))
  redirect(nextPath)
}

export async function signupAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signupSchema.safeParse({
    name: field(formData, 'name'),
    email: field(formData, 'email'),
    password: field(formData, 'password'),
    confirmPassword: field(formData, 'confirmPassword'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        name: parsed.data.name,
      },
    },
  })

  if (error) {
    return { status: 'error', message: sanitizeAuthError(error.message) }
  }

  if (data.session) {
    redirect(ROUTES.ONBOARDING_COMPANY)
  }

  redirect(`${ROUTES.VERIFY_EMAIL}?email=${encodeURIComponent(parsed.data.email)}`)
}

export async function resetPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    email: field(formData, 'email'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email)

  if (error) {
    return { status: 'error', message: sanitizeAuthError(error.message) }
  }

  return {
    status: 'success',
    message: 'If this email exists, we sent password reset instructions.',
  }
}

export async function selectCompanyAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const companyId = field(formData, 'companyId')
  if (!companyId) {
    return { status: 'error', message: 'No company selected.' }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { status: 'error', message: 'Authentication required.' }
  }

  const { data: membership, error: membershipError } = await supabase
    .from('company_members')
    .select('role, is_active')
    .eq('user_id', authData.user.id)
    .eq('company_id', companyId)
    .single()

  if (membershipError || !membership) {
    return { status: 'error', message: 'You are not a member of this company.' }
  }

  if (membership.is_active === false) {
    return { status: 'error', message: 'This membership is inactive.' }
  }

  const memberRole = isRole(membership.role) ? membership.role : 'member' as Role
  await syncSessionClaims(authData.user.id, companyId, memberRole)

  redirect(ROUTES.DASHBOARD)
}

export async function createPasswordAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = createPasswordSchema.safeParse({
    password: field(formData, 'password'),
    confirmPassword: field(formData, 'confirmPassword'),
  })

  if (!parsed.success) {
    return { status: 'error', message: zodMessage(parsed.error) }
  }

  const supabase = await createClient()
  const { data: authData, error: authError } = await supabase.auth.getUser()

  if (authError || !authData.user) {
    return { status: 'error', message: 'Authentication required. Your invite link may have expired.' }
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })

  if (updateError) {
    return { status: 'error', message: sanitizeAuthError(updateError.message) }
  }

  redirect(ROUTES.DASHBOARD)
}

export async function signOutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect(ROUTES.LOGIN)
}
