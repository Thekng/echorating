'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { acceptInviteAction } from '@/features/members/actions'

type InviteAcceptFormProps = {
  invitationId: string
  companyName: string
  role: 'manager' | 'member'
}

export function InviteAcceptForm({ invitationId, companyName, role }: InviteAcceptFormProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'error'>('idle')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (password.length < 8) {
      setStatus('error')
      setMessage('Password must be at least 8 characters.')
      return
    }

    if (password !== confirmPassword) {
      setStatus('error')
      setMessage('Passwords do not match.')
      return
    }

    setStatus('idle')
    setMessage('')

    startTransition(async () => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        password,
      })

      if (error) {
        setStatus('error')
        setMessage(error.message)
        return
      }

      const acceptResult = await acceptInviteAction(invitationId)
      if (!acceptResult.success) {
        setStatus('error')
        setMessage(acceptResult.message)
        return
      }

      const { data: memberships, error: membershipsError } = await supabase
        .from('company_members')
        .select('company_id')
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')

      if (membershipsError) {
        setStatus('error')
        setMessage('Password set, but we could not load your company memberships.')
        return
      }

      if ((memberships?.length ?? 0) > 1) {
        router.push('/select-company')
        return
      }

      router.push('/dashboard')
    })
  }

  const roleLabel = role === 'manager' ? 'Manager' : 'Member'

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">
        {`You've been invited to join ${companyName} as ${roleLabel}`}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Set your password to continue and complete your invitation.
      </p>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="invite-password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="invite-confirm-password" className="text-sm font-medium">
            Confirm password
          </label>
          <input
            id="invite-confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        {status === 'error' ? <p className="text-sm text-destructive">{message}</p> : null}

        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Setting password...' : 'Set password and join'}
        </Button>
      </form>
    </section>
  )
}
