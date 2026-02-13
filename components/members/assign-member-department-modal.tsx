'use client'

import { useActionState, useEffect, useState } from 'react'
import { assignMemberDepartmentAction } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type AssignMemberDepartmentModalProps = {
  userId: string
  memberName: string
  currentDepartmentId?: string
  departments: Array<{
    department_id: string
    name: string
  }>
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

export function AssignMemberDepartmentModal({
  userId,
  memberName,
  currentDepartmentId,
  departments,
}: AssignMemberDepartmentModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(assignMemberDepartmentAction, INITIAL_STATE)

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
        title={`Assign department for ${memberName}`}
        aria-label={`Assign department for ${memberName}`}
      >
        <Building2 className="size-3.5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Assign Department</h2>
              <p className="text-sm text-muted-foreground">{memberName}</p>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="userId" value={userId} />

              <div className="space-y-2">
                <label htmlFor={`assign-department-${userId}`} className="text-sm font-medium">
                  Department
                </label>
                <select
                  id={`assign-department-${userId}`}
                  name="departmentId"
                  defaultValue={currentDepartmentId ?? ''}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.department_id} value={department.department_id}>
                      {department.name}
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
