'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { createMemberAction, type MemberActionState } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

type CreateMemberModalProps = {
  departments: Array<{ id: string; name: string }>
  viewerRole: 'owner' | 'admin' | 'manager' | 'member'
  onSaved?: (message: string) => void
}

const INITIAL_STATE: MemberActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

export function CreateMemberModal({ departments, viewerRole, onSaved }: CreateMemberModalProps) {
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<MemberActionState>(INITIAL_STATE)
  const [pending, startTransition] = useTransition()

  const canManageOwnerRole = viewerRole === 'owner'

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
      >
        <Plus className="mr-1.5 size-4" />
        Add Member
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Add Member</h2>
              <p className="text-sm text-muted-foreground">
                Add an existing user or send an invitation.
              </p>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label htmlFor="create-member-email" className="text-sm font-medium">
                  Email
                </label>
                <input
                  id="create-member-email"
                  name="email"
                  type="email"
                  required
                  placeholder="name@example.com"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                {state.fieldErrors.userId ? (
                  <p className="text-xs text-destructive">{state.fieldErrors.userId}</p>
                ) : null}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
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
                    {canManageOwnerRole ? <option value="owner">Owner</option> : null}
                    {canManageOwnerRole ? <option value="admin">Admin</option> : null}
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                  </select>
                  {state.fieldErrors.role ? (
                    <p className="text-xs text-destructive">{state.fieldErrors.role}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="create-member-department" className="text-sm font-medium">
                    Department (optional)
                  </label>
                  <select
                    id="create-member-department"
                    name="departmentId"
                    defaultValue=""
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">None</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
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
                  {pending ? 'Adding...' : 'Add Member'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  )
}
