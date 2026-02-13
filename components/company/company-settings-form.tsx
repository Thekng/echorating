'use client'

import { useActionState } from 'react'
import { updateCompanyAction } from '@/features/company/actions'
import { Button } from '@/components/ui/button'
import { SettingsSurface } from '@/components/settings/settings-surface'

const TIMEZONES = [
  'UTC',
  'America/Sao_Paulo',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
] as const

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

type CompanySettingsFormProps = {
  name: string
  timezone: string
  canEdit: boolean
}

export function CompanySettingsForm({ name, timezone, canEdit }: CompanySettingsFormProps) {
  const [state, formAction, pending] = useActionState(updateCompanyAction, INITIAL_STATE)

  return (
    <form action={formAction}>
      <SettingsSurface className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Company Profile</h2>
          <p className="text-sm text-muted-foreground">Update main organization data.</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="company-name" className="text-sm font-medium">
            Company name
          </label>
          <input
            id="company-name"
            name="name"
            defaultValue={name}
            minLength={2}
            required
            disabled={!canEdit}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="company-timezone" className="text-sm font-medium">
            Timezone
          </label>
          <select
            id="company-timezone"
            name="timezone"
            defaultValue={timezone}
            disabled={!canEdit}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm disabled:opacity-60"
          >
            {!TIMEZONES.includes(timezone as (typeof TIMEZONES)[number]) ? (
              <option value={timezone}>{timezone}</option>
            ) : null}
            {TIMEZONES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {state.status !== 'idle' ? (
          <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
            {state.message}
          </p>
        ) : null}

        {canEdit ? (
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving...' : 'Save changes'}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">Only owners can edit company settings.</p>
        )}
      </SettingsSurface>
    </form>
  )
}
