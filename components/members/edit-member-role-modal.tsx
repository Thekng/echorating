'use client'

import { useActionState, useEffect, useState } from 'react'
import { updateMemberRoleAction } from '@/features/members/actions'
import { Button } from '@/components/ui/button'
import { ShieldCheck } from 'lucide-react'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

type EditMemberRoleModalProps = {
  userId: string
  memberName: string
  currentRole: 'owner' | 'manager' | 'member'
  canManageOwnerRole: boolean
}

const INITIAL_STATE: ActionState = {
  status: 'idle',
  message: '',
}

export function EditMemberRoleModal({
  userId,
  memberName,
  currentRole,
  canManageOwnerRole,
}: EditMemberRoleModalProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(updateMemberRoleAction, INITIAL_STATE)

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
        title={`Edit role for ${memberName}`}
        aria-label={`Edit role for ${memberName}`}
      >
        <ShieldCheck className="size-3.5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 text-card-foreground shadow-lg">
            <div className="mb-5">
              <h2 className="text-lg font-semibold">Edit Role</h2>
              <p className="text-sm text-muted-foreground">{memberName}</p>
            </div>

            <form action={formAction} className="space-y-4">
              <input type="hidden" name="userId" value={userId} />

              <div className="space-y-2">
                <label htmlFor={`edit-role-${userId}`} className="text-sm font-medium">
                  Role
                </label>
                <select
                  id={`edit-role-${userId}`}
                  name="role"
                  defaultValue={currentRole}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {canManageOwnerRole ? <option value="owner">Owner</option> : null}
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
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
