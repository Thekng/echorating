'use client'

import { useActionState, useEffect, useState } from 'react'
import { createMemberAction } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type CreateMemberModalProps = {
  departments: Array<{
    department_id: string
    name: string
  }>
  canInviteOwner: boolean
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

export function CreateMemberModal({ departments, canInviteOwner }: CreateMemberModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(createMemberAction, INITIAL_STATE)

  useEffect(() => {
    if (state.status === 'success') {
      setOpen(false)
    }
  }, [state.status])

  return (
    <>
      <Button
        type="button"
        onClick={() => setOpen(true)}
        title="Create member"
        aria-label="Create member"
        className="size-9 p-0"
      >
        <UserPlus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Create Member</h2>
              <p className="text-sm text-muted-foreground">
                Create profile and send invite email.
              </p>
            </div>

            <form action={formAction} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="create-member-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="create-member-name"
                  name="name"
                  required
                  minLength={2}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="create-member-email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="create-member-email"
                  name="email"
                  type="email"
                  required
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="create-member-role" className="text-sm font-medium">
                  Role
                </label>
                <select
                  id="create-member-role"
                  name="role"
                  defaultValue="member"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {canInviteOwner ? <option value="owner">Owner</option> : null}
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="create-member-department" className="text-sm font-medium">
                  Department
                </label>
                <select
                  id="create-member-department"
                  name="departmentId"
                  defaultValue=""
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
