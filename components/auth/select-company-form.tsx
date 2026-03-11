'use client'

import { useActionState } from 'react'
import { Button } from '@/components/ui/button'
import { selectCompanyAction } from '@/features/auth/actions'

type CompanyOption = {
  company_id: string
  name: string
  role: string
}

type SelectCompanyFormProps = {
  companies: CompanyOption[]
}

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export function SelectCompanyForm({ companies }: SelectCompanyFormProps) {
  const initialState: ActionState = {
    status: 'idle',
    message: '',
  }

  const [state, formAction, pending] = useActionState(selectCompanyAction, initialState)

  if (companies.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
        You don't belong to any company yet. Please contact your administrator.
      </div>
    )
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-3">
        {companies.map((company) => (
          <label
            key={company.company_id}
            className="flex cursor-pointer items-start space-x-3 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center h-5">
              <input
                type="radio"
                name="companyId"
                value={company.company_id}
                required
                className="h-4 w-4 border-primary text-primary focus:ring-primary"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium">{company.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{company.role} Role</span>
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
