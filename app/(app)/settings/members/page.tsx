'use client'

import { useEffect, useState, useTransition } from 'react'
import { listMembers } from '@/features/members/queries'
import { removeMemberAction, type MemberActionState } from '@/features/members/actions'
import { EditMemberRoleModal } from '@/components/members/edit-member-role-modal'
import { AssignMemberDepartmentModal } from '@/components/members/assign-member-department-modal'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsError } from '@/components/settings/settings-error'
import { Button } from '@/components/ui/button'
import { formatMemberDepartments } from '@/features/settings/helpers'
import { Trash2, Users } from 'lucide-react'

type MemberDepartment = {
  departmentId: string
  name: string
}

type MemberRow = {
  type: 'member'
  rowId: string
  userId: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'manager' | 'member'
  createdAt: string
  updatedAt: string
  departments: MemberDepartment[]
}

type DepartmentOption = {
  id: string
  name: string
}

type MemberFilters = {
  q: string
  role: 'all' | 'owner' | 'admin' | 'manager' | 'member'
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

const INITIAL_FILTERS: MemberFilters = {
  q: '',
  role: 'all',
}

const ROLE_LABELS: Record<MemberRow['role'], string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Member',
}

export default function MembersSettingsPage() {
  const [rows, setRows] = useState<MemberRow[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [viewerRole, setViewerRole] = useState<'owner' | 'admin' | 'manager' | 'member'>('member')

  const [queryFilters, setQueryFilters] = useState<MemberFilters>(INITIAL_FILTERS)
  const [formFilters, setFormFilters] = useState<MemberFilters>(INITIAL_FILTERS)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [isMutating, startMutationTransition] = useTransition()

  async function fetchMembers(filters: MemberFilters) {
    setLoading(true)
    setError(null)

    try {
      const result = await listMembers({
        q: filters.q || undefined,
        role: filters.role,
      })

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load members.')
        return
      }

      setRows((result.data.rows ?? []) as MemberRow[])
      setDepartments((result.data.departments ?? []) as DepartmentOption[])
      setViewerRole(result.data.viewerRole as MemberRow['role'])
    } catch {
      setError('An unexpected error occurred while loading members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMembers(queryFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters.q, queryFilters.role])

  function refreshMembers() {
    void fetchMembers(queryFilters)
  }

  function handleMemberSaved(message: string) {
    setFeedback({ tone: 'success', message })
    refreshMembers()
  }

  function handleRemoveMember(member: MemberRow) {
    const confirmed = window.confirm(`Remove "${member.name}" from this organization?`)
    if (!confirmed) return

    setPendingRowId(member.rowId)
    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('userId', member.userId)

      const result = await removeMemberAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMembers(queryFilters)
      }

      setPendingRowId(null)
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
        <SettingsHeader title="Members" description="Manage team members and roles." />
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
        description="Manage members, assign roles, and department assignments."
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
          className="grid gap-3 md:grid-cols-3"
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
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="member">Member</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormFilters(INITIAL_FILTERS)}>
              Clear
            </Button>
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </SettingsSurface>

      {rows.length === 0 ? (
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
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const departmentsText = formatMemberDepartments(row.departments)
                  const rowPending = isMutating && pendingRowId === row.rowId
                  const primaryDepartmentId = row.departments[0]?.departmentId

                  return (
                    <tr key={row.rowId} className="border-b align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.email || '-'}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            row.role === 'owner'
                              ? 'inline-block rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : row.role === 'admin'
                                ? 'inline-block rounded-md bg-purple-100 px-2 py-1 text-xs font-medium text-purple-700'
                                : row.role === 'manager'
                                  ? 'inline-block rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700'
                                  : 'inline-block rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700'
                          }
                        >
                          {ROLE_LABELS[row.role]}
                        </span>
                      </td>
                      <td className="px-3 py-3">{departmentsText}</td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <EditMemberRoleModal
                            userId={row.userId}
                            memberName={row.name}
                            currentRole={row.role}
                            canManageOwnerRole={canManageOwnerRole}
                            onSaved={handleMemberSaved}
                          />

                          <AssignMemberDepartmentModal
                            userId={row.userId}
                            memberName={row.name}
                            currentDepartmentId={primaryDepartmentId}
                            departments={departments}
                            onSaved={handleMemberSaved}
                          />

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title={`Remove ${row.name}`}
                            aria-label={`Remove ${row.name}`}
                            onClick={() => handleRemoveMember(row)}
                            disabled={rowPending}
                          >
                            <Trash2 className="size-4" />
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
