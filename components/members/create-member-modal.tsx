'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { createMemberAction, type MemberActionState } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'

type CreateMemberModalProps = {
  departments: Array<{
    department_id: string
    name: string
  }>
  canInviteOwner: boolean
  onSaved?: (message: string) => void
}

const INITIAL_STATE: MemberActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

export function CreateMemberModal({ departments, canInviteOwner, onSaved }: CreateMemberModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MemberActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setState(INITIAL_STATE)
    startTransition(async () => {
      const nextState = await createMemberAction(INITIAL_STATE, formData)
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
        onClick={() => {
          setState(INITIAL_STATE)
          setOpen(true)
        }}
        title="Invite member"
        aria-label="Invite member"
        className="size-9 p-0"
      >
        <UserPlus className="size-4" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Invite Member</h2>
              <p className="text-sm text-muted-foreground">Create profile and send an invite email.</p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
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
                {state.fieldErrors.name ? <p className="text-xs text-destructive">{state.fieldErrors.name}</p> : null}
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
                {state.fieldErrors.email ? <p className="text-xs text-destructive">{state.fieldErrors.email}</p> : null}
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
                {state.fieldErrors.role ? <p className="text-xs text-destructive">{state.fieldErrors.role}</p> : null}
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
                  {pending ? 'Inviting...' : 'Send Invite'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
