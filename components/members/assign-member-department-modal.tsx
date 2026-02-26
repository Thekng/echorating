'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { assignMemberDepartmentAction, type MemberActionState } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { Building2 } from 'lucide-react'

type AssignMemberDepartmentModalProps = {
  userId: string
  memberName: string
  currentDepartmentId?: string
  departments: Array<{
    department_id: string
    name: string
  }>
  onSaved?: (message: string) => void
}

const INITIAL_STATE: MemberActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

export function AssignMemberDepartmentModal({
  userId,
  memberName,
  currentDepartmentId,
  departments,
  onSaved,
}: AssignMemberDepartmentModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MemberActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setState(INITIAL_STATE)
    startTransition(async () => {
      const nextState = await assignMemberDepartmentAction(INITIAL_STATE, formData)
      setState(nextState)

      if (nextState.status === 'success') {
        onSaved?.(nextState.message)
        setOpen(false)
      }
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => {
          setState(INITIAL_STATE)
          setOpen(true)
        }}
        title={`Assign department for ${memberName}`}
        aria-label={`Assign department for ${memberName}`}
      >
        <Building2 className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Assign Department</h2>
              <p className="text-sm text-muted-foreground">{memberName}</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <input type="hidden" name="userId" value={userId} />

              <div className="space-y-2">
                <label htmlFor={`assign-member-department-${userId}`} className="text-sm font-medium">
                  Department
                </label>
                <select
                  id={`assign-member-department-${userId}`}
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
                {state.fieldErrors.departmentId ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.departmentId}</p>
                ) : null}
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
