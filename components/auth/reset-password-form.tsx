'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { resetPasswordAction } from '@/features/auth/actions'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export function ResetPasswordForm() {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      {state.status !== 'idle' ? (
        <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Sending reset link...' : 'Send reset link'}
      </Button>
    </form>
  )
}
