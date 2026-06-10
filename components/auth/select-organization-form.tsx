'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { selectOrganizationAction } from '@/features/auth/actions'

type OrganizationOption = {
  organization_id: string
  name: string
  role: string
}

type SelectOrganizationFormProps = {
  organizations: OrganizationOption[]
}

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export function SelectOrganizationForm({ organizations }: SelectOrganizationFormProps) {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(selectOrganizationAction, initialState)

  if (organizations.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        You don&apos;t belong to any organization yet. Please contact your administrator.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        {organizations.map((org) => (
          <label
            key={org.organization_id}
            className="flex cursor-pointer items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center h-5">
              <input
                type="radio"
                name="organizationId"
                value={org.organization_id}
                required
                className="h-4 w-4 border-primary text-primary focus:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{org.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{org.role} Role</span>
            </div>
          </label>
        ))}
      </div>

      {state.status !== 'idle' ? (
        <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
          {state.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? 'Continuing...' : 'Continue to Dashboard'}
      </Button>
    </form>
  )
}
