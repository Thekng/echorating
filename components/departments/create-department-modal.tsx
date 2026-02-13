'use client'

import { useActionState, useEffect, useState } from 'react'
import { createDepartmentAction } from '@/features/departments/actions'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

const DEPARTMENT_TYPES = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'life', label: 'Life' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'custom', label: 'Custom' },
] as const

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

export function CreateDepartmentModal() {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createDepartmentAction, INITIAL_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status])

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        title="Create department"
        aria-label="Create department"
        className="size-9 p-0"
      >
        <Plus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create Department</h2>
              <p className="text-sm text-muted-foreground">Add a department to your company.</p>
            </div>

            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="create-department-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="create-department-name"
                  name="name"
                  required
                  minLength={2}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="create-department-type" className="text-sm font-medium">
                  Type
                </label>
                <select
                  id="create-department-type"
                  name="type"
                  defaultValue="sales"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {state.status !== 'idle' ? (
                <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
