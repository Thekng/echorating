'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { loginAction } from '@/features/auth/actions'

type LoginFormProps = {
  nextPath?: string
}

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(loginAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath ?? ''} />

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

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          minLength={8}
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
        {pending ? 'Signing in...' : 'Sign in'}
      </Button>

      <p className="text-sm text-muted-foreground">
        <Link href="/reset-password" className="underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
    </form>
  )
}
