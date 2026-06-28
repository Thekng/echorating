'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateDepartmentAction, type DepartmentActionState } from '@/features/departments/actions'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

const INITIAL_STATE: DepartmentActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

type EditDepartmentModalProps = {
  departmentId: string
  name: string
  description: string | null
  onSaved?: (message: string) => void
}

export function EditDepartmentModal({ departmentId, name, description, onSaved }: EditDepartmentModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState<DepartmentActionState, FormData>(
    updateDepartmentAction,
    INITIAL_STATE,
  )

  useEffect(() => {
    if (state.status === 'success') {
      onSaved?.(state.message)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(false)
    }
  }, [state.status, state.message, onSaved])

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="size-8 p-0"
        onClick={() => setOpen(true)}
        title={`Edit ${name}`}
        aria-label={`Edit ${name}`}
      >
        <Pencil className="size-3.5" />
      </Button>

      {open ? (
      // eslint-disable-next-line react-hooks/set-state-in-effect
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Edit Department</h2>
              <p className="text-sm text-muted-foreground">Update department data.</p>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="departmentId" value={departmentId} />

              <div className="space-y-2">
                <label htmlFor={`edit-department-name-${departmentId}`} className="text-sm font-medium">
                  Name
                </label>
                <input
                  id={`edit-department-name-${departmentId}`}
                  name="name"
                  required
                  minLength={2}
                  defaultValue={name}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                {state.fieldErrors.name ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor={`edit-department-description-${departmentId}`} className="text-sm font-medium">
                  Description (optional)
                </label>
                <textarea
                  id={`edit-department-description-${departmentId}`}
                  name="description"
                  rows={2}
                  defaultValue={description ?? ''}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              {state.status !== 'idle' ? (
                <p className={state.status === 'error' ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                  {state.message}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
      // eslint-disable-next-line react-hooks/set-state-in-effect
                <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
