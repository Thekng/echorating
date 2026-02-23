import Link from 'next/link'
import { AssignMemberDepartmentModal } from '@/components/members/assign-member-department-modal'
import { CreateMemberModal } from '@/components/members/create-member-modal'
import { EditMemberRoleModal } from '@/components/members/edit-member-role-modal'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsError } from '@/components/settings/settings-error'
import { SettingsChip } from '@/components/settings/settings-chip'
import { toggleMemberStatusAction } from '@/features/members/actions'
import { listMembers } from '@/features/members/queries'
import { ROUTES } from '@/lib/constants/routes'
import { Filter, Power, RotateCcw, Search } from 'lucide-react'

type MembersPageProps = {
  searchParams: Promise<{
    q?: string
    role?: string
  }>
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
}

export default async function MembersSettingsPage({ searchParams }: MembersPageProps) {
  const params = await searchParams
  const result = await listMembers({
    q: params.q,
    role: params.role,
    status: 'all',
  })

  if (!result.success || !result.data) {
    return <SettingsError error={result.error || 'Failed to load members'} />
  }

  const { members, departments, viewerRole } = result.data
  const canManageOwnerRole = viewerRole === 'owner'
  const activeMembers = members.filter((member) => member.isActive)
  const inactiveMembers = members.filter((member) => !member.isActive)

  return (
    <div className="space-y-5">
      <SettingsPageHeader
        title="Members"
        description="Manage role permissions, active roster and team assignments."
        actions={<CreateMemberModal departments={departments} canInviteOwner={canManageOwnerRole} />}
      />

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div className="md:col-span-3">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="q"
              name="q"
              defaultValue={params.q ?? ''}
              placeholder="Name, email or team"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={params.role ?? 'all'}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="member">Member</option>
          </select>
        </div>

        <div className="md:col-span-4 flex items-center justify-end gap-2">
          <Link
            href={ROUTES.SETTINGS_MEMBERS}
            title="Reset filters"
            aria-label="Reset filters"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted/40"
          >
            <RotateCcw className="size-4" />
          </Link>
          <button
            type="submit"
            title="Apply filters"
            aria-label="Apply filters"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted/40"
          >
            <Filter className="size-4" />
          </button>
        </div>
      </form>

      <SettingsSurface className="space-y-3">
        <h2 className="text-lg font-semibold">Active Members ({activeMembers.length})</h2>
        {activeMembers.length === 0 ? (
          <SettingsEmptyState message="No active member found." />
        ) : (
          <div className="space-y-2">
            {activeMembers.map((member) => {
              const primaryDepartment = member.departments[0]
              return (
                <SettingsRow
                  key={member.userId}
                  title={member.name}
                  subtitle={`${member.email || '-'} · ${member.departments.map((department) => department.name).join(', ') || 'No team'}`}
                  meta={
                    <SettingsChip
                      tone={
                        member.role === 'owner' ? 'success' : member.role === 'manager' ? 'info' : 'neutral'
                      }
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </SettingsChip>
                  }
                  actions={
                    <>
                      <EditMemberRoleModal
                        userId={member.userId}
                        memberName={member.name}
                        currentRole={member.role}
                        canManageOwnerRole={canManageOwnerRole}
                      />
                      <AssignMemberDepartmentModal
                        userId={member.userId}
                        memberName={member.name}
                        currentDepartmentId={primaryDepartment?.departmentId}
                        departments={departments}
                      />
                      <form action={toggleMemberStatusAction}>
                        <input type="hidden" name="userId" value={member.userId} />
                        <input type="hidden" name="nextStatus" value="inactive" />
                        <button
                          type="submit"
                          title={`Deactivate ${member.name}`}
                          aria-label={`Deactivate ${member.name}`}
                          className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                        >
                          <Power className="size-3.5" />
                        </button>
                      </form>
                    </>
                  }
                />
              )
            })}
          </div>
        )}
      </SettingsSurface>

      <SettingsSurface>
        <details>
          <summary className="cursor-pointer list-none text-lg font-semibold">
            Inactive Members ({inactiveMembers.length})
          </summary>
          <div className="mt-3 space-y-2">
            {inactiveMembers.length === 0 ? (
              <SettingsEmptyState message="No inactive member found." />
            ) : (
              inactiveMembers.map((member) => (
                <SettingsRow
                  key={member.userId}
                  title={member.name}
                  subtitle={`${member.email || '-'} · ${member.departments.map((department) => department.name).join(', ') || 'No team'}`}
                  meta={<SettingsChip>{ROLE_LABELS[member.role] ?? member.role}</SettingsChip>}
                  actions={
                    <form action={toggleMemberStatusAction}>
                      <input type="hidden" name="userId" value={member.userId} />
                      <input type="hidden" name="nextStatus" value="active" />
                      <button
                        type="submit"
                        title={`Activate ${member.name}`}
                        aria-label={`Activate ${member.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                      >
                        <Power className="size-3.5" />
                      </button>
                    </form>
                  }
                />
              ))
            )}
          </div>
        </details>
      </SettingsSurface>
    </div>
  )
}
