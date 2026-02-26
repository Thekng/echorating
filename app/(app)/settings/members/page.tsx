'use client'

import { useEffect, useState, useTransition } from 'react'
import { listMembers } from '@/features/members/queries'
import { toggleMemberStatusAction } from '@/features/members/actions'
import { CreateMemberModal } from '@/components/members/create-member-modal'
import { EditMemberRoleModal } from '@/components/members/edit-member-role-modal'
import { AssignMemberDepartmentModal } from '@/components/members/assign-member-department-modal'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsError } from '@/components/settings/settings-error'
import { Button } from '@/components/ui/button'
import { areMemberFiltersEqual, formatMemberDepartments } from '@/features/settings/helpers'
import { Power, Users } from 'lucide-react'

type MemberDepartment = {
  departmentId: string
  name: string
}

type MemberRow = {
  userId: string
  name: string
  email: string
  role: 'owner' | 'manager' | 'member'
  isActive: boolean
  createdAt: string
  updatedAt: string
  departments: MemberDepartment[]
}

type DepartmentOption = {
  department_id: string
  name: string
}

type MemberFilters = {
  q: string
  role: 'all' | 'owner' | 'manager' | 'member'
  status: 'all' | 'active' | 'inactive'
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

const INITIAL_FILTERS: MemberFilters = {
  q: '',
  role: 'all',
  status: 'active',
}

const ROLE_LABELS: Record<MemberRow['role'], string> = {
  owner: 'Owner',
  manager: 'Manager',
  member: 'Member',
}

export default function MembersSettingsPage() {
  const [members, setMembers] = useState<MemberRow[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [viewerRole, setViewerRole] = useState<'owner' | 'manager' | 'member'>('member')

  const [queryFilters, setQueryFilters] = useState<MemberFilters>(INITIAL_FILTERS)
  const [formFilters, setFormFilters] = useState<MemberFilters>(INITIAL_FILTERS)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [pendingMemberId, setPendingMemberId] = useState<string | null>(null)
  const [isMutating, startMutationTransition] = useTransition()

  async function fetchMembers(filters: MemberFilters) {
    setLoading(true)
    setError(null)

    try {
      const result = await listMembers({
        q: filters.q || undefined,
        role: filters.role,
        status: filters.status,
      })

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load members.')
        return
      }

      const nextFilters: MemberFilters = {
        q: result.data.filters.q ?? '',
        role: result.data.filters.role,
        status: result.data.filters.status,
      }

      setMembers((result.data.members ?? []) as MemberRow[])
      setDepartments((result.data.departments ?? []) as DepartmentOption[])
      setViewerRole(result.data.viewerRole as 'owner' | 'manager' | 'member')

      if (!areMemberFiltersEqual(nextFilters, queryFilters)) {
        setQueryFilters(nextFilters)
        setFormFilters(nextFilters)
      }
    } catch {
      setError('An unexpected error occurred while loading members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers(queryFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters.q, queryFilters.role, queryFilters.status])

  function refreshMembers() {
    void fetchMembers(queryFilters)
  }

  function handleMemberSaved(message: string) {
    setFeedback({ tone: 'success', message })
    refreshMembers()
  }

  function handleToggleMember(member: MemberRow) {
    setPendingMemberId(member.userId)

    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('userId', member.userId)
      formData.set('nextStatus', member.isActive ? 'inactive' : 'active')

      const result = await toggleMemberStatusAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMembers(queryFilters)
      }

      setPendingMemberId(null)
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Members" description="Loading members..." />
        <SettingsSurface>
          <p className="text-sm text-muted-foreground">Loading members...</p>
        </SettingsSurface>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Members" description="Manage team members and invitations." />
        <SettingsError error={error} />
        <div>
          <Button type="button" variant="outline" onClick={() => fetchMembers(queryFilters)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  const canManageOwnerRole = viewerRole === 'owner'

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Members"
        description="Invite members, assign roles, and manage departments."
        actions={
          <CreateMemberModal
            departments={departments}
            canInviteOwner={canManageOwnerRole}
            onSaved={handleMemberSaved}
          />
        }
      />

      {feedback ? (
        <SettingsSurface
          className={
            feedback.tone === 'success'
              ? 'border-green-300 bg-green-50 text-green-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }
        >
          <p className="text-sm">{feedback.message}</p>
        </SettingsSurface>
      ) : null}

      <SettingsSurface>
        <form
          className="grid gap-3 md:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault()
            setQueryFilters(formFilters)
          }}
        >
          <div className="md:col-span-2">
            <label htmlFor="member-filter-q" className="mb-1 block text-sm font-medium">
              Search
            </label>
            <input
              id="member-filter-q"
              value={formFilters.q}
              onChange={(event) => setFormFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Name, email, or department"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="member-filter-role" className="mb-1 block text-sm font-medium">
              Role
            </label>
            <select
              id="member-filter-role"
              value={formFilters.role}
              onChange={(event) =>
                setFormFilters((current) => ({
                  ...current,
                  role: event.target.value as MemberFilters['role'],
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="owner">Owner</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
          </div>

          <div>
            <label htmlFor="member-filter-status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="member-filter-status"
              value={formFilters.status}
              onChange={(event) =>
                setFormFilters((current) => ({
                  ...current,
                  status: event.target.value as MemberFilters['status'],
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormFilters(INITIAL_FILTERS)}>
              Clear
            </Button>
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </SettingsSurface>

      {members.length === 0 ? (
        <SettingsSurface>
          <SettingsEmptyState
            message="No members found for the selected filters."
            icon={<Users className="mb-3 size-8 text-muted-foreground" />}
          />
        </SettingsSurface>
      ) : (
        <SettingsSurface>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Member</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const primaryDepartmentId = member.departments[0]?.departmentId
                  const departmentsText = formatMemberDepartments(member.departments)

                  const rowPending = isMutating && pendingMemberId === member.userId

                  return (
                    <tr key={member.userId} className="border-b align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email || '-'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            member.role === 'owner'
                              ? 'inline-block rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : member.role === 'manager'
                                ? 'inline-block rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700'
                                : 'inline-block rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700'
                          }
                        >
                          {ROLE_LABELS[member.role]}
                        </span>
                      </td>
                      <td className="px-3 py-3">{departmentsText}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            member.isActive
                              ? 'inline-block rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : 'inline-block rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700'
                          }
                        >
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <EditMemberRoleModal
                            userId={member.userId}
                            memberName={member.name}
                            currentRole={member.role}
                            canManageOwnerRole={canManageOwnerRole}
                            onSaved={handleMemberSaved}
                          />

                          <AssignMemberDepartmentModal
                            userId={member.userId}
                            memberName={member.name}
                            currentDepartmentId={primaryDepartmentId}
                            departments={departments}
                            onSaved={handleMemberSaved}
                          />

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={member.isActive ? `Deactivate ${member.name}` : `Activate ${member.name}`}
                            aria-label={member.isActive ? `Deactivate ${member.name}` : `Activate ${member.name}`}
                            onClick={() => handleToggleMember(member)}
                            disabled={rowPending}
                          >
                            <Power className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SettingsSurface>
      )}
    </div>
  )
}
