'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateDepartmentAction } from '@/features/departments/actions'
import { Button } from '@/components/ui/button'
import { Pencil } from 'lucide-react'

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

type EditDepartmentModalProps = {
  departmentId: string
  name: string
  type: string
}

export function EditDepartmentModal({ departmentId, name, type }: EditDepartmentModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(updateDepartmentAction, INITIAL_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status])

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
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
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
              </div>

              <div className="space-y-2">
                <label htmlFor={`edit-department-type-${departmentId}`} className="text-sm font-medium">
                  Type
                </label>
                <select
                  id={`edit-department-type-${departmentId}`}
                  name="type"
                  defaultValue={type}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
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
