'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { completeOnboardingAction } from '@/features/onboarding/actions'

const TIMEZONES = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/London']

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export function CompanyOnboardingForm() {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(completeOnboardingAction, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="companyName" className="text-sm font-medium">
          Company name
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="industry" className="text-sm font-medium">
          Industry
        </label>
        <input
          id="industry"
          name="industry"
          type="text"
          required
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="teamSize" className="text-sm font-medium">
          Team size
        </label>
        <select
          id="teamSize"
          name="teamSize"
          required
          defaultValue=""
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="" disabled>
            Select team size
          </option>
          <option value="1-10">1-10</option>
          <option value="11-50">11-50</option>
          <option value="51-200">51-200</option>
          <option value="201+">201+</option>
        </select>
      </div>

      <div className="space-y-2">
        <label htmlFor="timezone" className="text-sm font-medium">
          Timezone
        </label>
        <select
          id="timezone"
          name="timezone"
          required
          defaultValue="UTC"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        >
          {TIMEZONES.map((timezone) => (
            <option key={timezone} value={timezone}>
              {timezone}
            </option>
          ))}
        </select>
      </div>

      {state.status !== 'idle' ? (
        <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Creating company...' : 'Create company'}
      </Button>
    </form>
  )
}
