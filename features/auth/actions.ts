'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { loginSchema, signupSchema, resetPasswordSchema, createPasswordSchema } from './schemas'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'

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

  const { data: memberships } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', authData.user.id)

  const membershipCount = memberships?.length || 0

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
    return { status: 'error', message: error.message }
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
    return { status: 'error', message: error.message }
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
    .select('role')
    .eq('user_id', authData.user.id)
    .eq('company_id', companyId)
    .single()

  if (membershipError || !membership) {
    return { status: 'error', message: 'You are not a member of this company.' }
  }

  // Update profiles row directly through the raw client (using RLS self-update or admin override)
  // Since user updates their own profile, if RLS "profiles_update_self_or_admin" allows self-updating company_id
  // Let's check RLS: profiles_update_self_or_admin allows updating self IF company_id = current_company_id()
  // Wait, if they are switching companies, they are changing company_id. This might be blocked by RLS `with check (company_id = public.current_company_id())`! Next best is using admin client to safely perform the context switch.

  // We need to import createAdminClient, but it's not imported here yet. Let's do a raw import inside the function to avoid breaking standard client imports.
  const { createAdminClient } = await import('@/lib/supabase/admin')
  const admin = createAdminClient()

  const { error: profileError } = await admin
    .from('profiles')
    .update({
      company_id: companyId,
      role: membership.role,
    })
    .eq('user_id', authData.user.id)

  if (profileError) {
    return { status: 'error', message: 'Failed to switch company context.' }
  }

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
    return { status: 'error', message: updateError.message }
  }

  redirect(ROUTES.DASHBOARD)
}
