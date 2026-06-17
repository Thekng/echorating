'use client'

import { useActionState, useEffect, useState } from 'react'
import { createDepartmentAction, type DepartmentActionState } from '@/features/departments/actions'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

const INITIAL_STATE: DepartmentActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

export function CreateDepartmentModal({ onSaved }: { onSaved?: (message: string) => void }) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<DepartmentActionState, FormData>(
    createDepartmentAction,
    INITIAL_STATE,
  )

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (state.status === 'success') {
      onSaved?.(state.message)
      setOpen(false)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [state.status, state.message, onSaved])

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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create Department</h2>
              <p className="text-sm text-muted-foreground">Add a department to your organization.</p>
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
                {state.fieldErrors.name ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="create-department-description" className="text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id="create-department-description"
                  name="description"
                  rows={2}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
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
