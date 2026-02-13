'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { loginSchema, signupSchema, resetPasswordSchema } from './schemas'
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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    return { status: 'error', message: 'Email or password is invalid.' }
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
