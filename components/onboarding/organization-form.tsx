'use client'

import { useActionState, useState } from 'react'
import { Button } from '@/components/ui/button'
import { completeOnboardingAction } from '@/features/onboarding/actions'

const TIMEZONES = ['UTC', 'America/Sao_Paulo', 'America/New_York', 'Europe/London']

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function OrganizationOnboardingForm() {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(completeOnboardingAction, initialState)
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!slugTouched) {
      setSlug(generateSlug(e.target.value))
    }
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="organizationName" className="text-sm font-medium">
          Organization name
        </label>
        <input
          id="organizationName"
          name="organizationName"
          type="text"
          required
          onChange={handleNameChange}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="slug" className="text-sm font-medium">
          URL slug
        </label>
        <input
          id="slug"
          name="slug"
          type="text"
          required
          value={slug}
          onChange={(e) => {
            setSlugTouched(true)
            setSlug(e.target.value)
          }}
          placeholder="my-organization"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only.
        </p>
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
        <label htmlFor="locationName" className="text-sm font-medium">
          First location name
        </label>
        <input
          id="locationName"
          name="locationName"
          type="text"
          required
          defaultValue="Main"
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        />
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
        {pending ? 'Creating organization...' : 'Create organization'}
      </Button>
    </form>
  )
}
