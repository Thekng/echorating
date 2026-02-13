import { AssignMemberDepartmentModal } from '@/components/members/assign-member-department-modal'
import { CreateMemberModal } from '@/components/members/create-member-modal'
import { EditMemberRoleModal } from '@/components/members/edit-member-role-modal'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { toggleMemberStatusAction } from '@/features/members/actions'
import { listMembers } from '@/features/members/queries'
import { Filter, Power } from 'lucide-react'

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
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {result.error}
      </div>
    )
  }

  const { members, departments, viewerRole } = result.data
  const canManageOwnerRole = viewerRole === 'owner'
  const activeMembers = members.filter((member) => member.isActive)
  const inactiveMembers = members.filter((member) => !member.isActive)

  return (
    <div className="space-y-5">
      <SettingsPageHeader
        title="Members"
        description="Manage role permissions, active roster and department assignments."
        actions={<CreateMemberModal departments={departments} canInviteOwner={canManageOwnerRole} />}
      />

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div className="md:col-span-3">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Name, email or department"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
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

        <div className="md:col-span-4 flex items-center justify-end">
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
                  subtitle={`${member.email || '-'} · ${member.departments.map((department) => department.name).join(', ') || 'No department'}`}
                  meta={
                    <span
                      className={
                        member.role === 'owner'
                          ? 'rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700'
                          : member.role === 'manager'
                            ? 'rounded-full bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-700'
                            : 'rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700'
                      }
                    >
                      {ROLE_LABELS[member.role] ?? member.role}
                    </span>
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

      <SettingsSurface className="space-y-3">
        <h2 className="text-lg font-semibold">Inactive Members ({inactiveMembers.length})</h2>
        {inactiveMembers.length === 0 ? (
          <SettingsEmptyState message="No inactive member found." />
        ) : (
          <div className="space-y-2">
            {inactiveMembers.map((member) => (
              <SettingsRow
                key={member.userId}
                title={member.name}
                subtitle={`${member.email || '-'} · ${member.departments.map((department) => department.name).join(', ') || 'No department'}`}
                meta={
                  <span className="rounded-full bg-zinc-200 px-2 py-1 text-xs font-semibold text-zinc-700">
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                }
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
            ))}
          </div>
        )}
      </SettingsSurface>
    </div>
  )
}
