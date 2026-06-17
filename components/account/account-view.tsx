'use client'

import { useActionState } from 'react'
import { type AccountData } from '@/features/account/queries'
import { updateProfileAction, changePasswordAction } from '@/features/account/actions'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsFeedback } from '@/components/settings/settings-feedback'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

type ActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

const INITIAL_STATE: ActionState = { status: 'idle', message: '' }

export function AccountView({ data }: { data: AccountData }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, INITIAL_STATE)
  const [passwordState, passwordAction, passwordPending] = useActionState(changePasswordAction, INITIAL_STATE)

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="My Account"
        description="Manage your profile and security settings"
      />

      {/* Profile */}
      <form action={profileAction}>
        <SettingsSurface className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Profile</h2>
            <p className="text-sm text-muted-foreground">Your personal information.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="full_name" className="text-sm font-medium">
              Full name
            </label>
            <input
              id="full_name"
              name="full_name"
              defaultValue={data.fullName}
              minLength={2}
              maxLength={100}
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              Email
            </label>
            <p className="text-sm">{data.email}</p>
          </div>

          <div className="flex items-center justify-between">
            <SettingsFeedback status={profileState.status} message={profileState.message} />
            <Button type="submit" disabled={profilePending} size="sm">
              {profilePending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </SettingsSurface>
      </form>

      {/* Security */}
      <form action={passwordAction}>
        <SettingsSurface className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Security</h2>
            <p className="text-sm text-muted-foreground">Change your password.</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="currentPassword" className="text-sm font-medium">
              Current password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="newPassword" className="text-sm font-medium">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={8}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <SettingsFeedback status={passwordState.status} message={passwordState.message} />
            <Button type="submit" disabled={passwordPending} size="sm">
              {passwordPending ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </SettingsSurface>
      </form>

      {/* Organization Info */}
      <SettingsSurface className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Organization</h2>
          <p className="text-sm text-muted-foreground">Your current organization details.</p>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Organization</p>
            <p className="text-sm">{data.organizationName || 'N/A'}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Role</p>
            <Badge variant="secondary" className="mt-0.5 capitalize">{data.role}</Badge>
          </div>

          {data.departments.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Departments</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.departments.map((dept) => (
                  <Badge key={dept.id} variant="outline">{dept.name}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      </SettingsSurface>
    </div>
  )
}
