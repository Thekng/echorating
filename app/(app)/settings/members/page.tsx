'use client'

import { useEffect, useState, useTransition } from 'react'
import { listMembers } from '@/features/members/queries'
import { removeMemberAction, deactivateMemberAction, reactivateMemberAction } from '@/features/members/actions'
import { EditMemberRoleModal } from '@/components/members/edit-member-role-modal'
import { AssignMemberDepartmentModal } from '@/components/members/assign-member-department-modal'
import { CreateMemberModal } from '@/components/members/create-member-modal'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsError } from '@/components/settings/settings-error'
import { Button } from '@/components/ui/button'
import { formatMemberDepartments } from '@/features/settings/helpers'
import { Trash2, Users, UserX, UserCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

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
  isActive: boolean
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

  const [showInactive, setShowInactive] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [pendingRowId, setPendingRowId] = useState<string | null>(null)
  const [isMutating, startMutationTransition] = useTransition()

  async function fetchMembers(filters: MemberFilters, includeInactive = false) {
    setLoading(true)
    setError(null)

    try {
      const result = await listMembers({
        q: filters.q || undefined,
        role: filters.role,
        showInactive: includeInactive,
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchMembers(queryFilters, showInactive)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters.q, queryFilters.role, showInactive])

  function refreshMembers() {
    void fetchMembers(queryFilters, showInactive)
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
        await fetchMembers(queryFilters, showInactive)
      }

      setPendingRowId(null)
    })
  }

  function handleDeactivateMember(member: MemberRow) {
    const confirmed = window.confirm(
      `Deactivate "${member.name}"? This member will be removed from all departments. Their historical data will be preserved.`,
    )
    if (!confirmed) return

    setPendingRowId(member.rowId)
    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('userId', member.userId)

      const result = await deactivateMemberAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMembers(queryFilters, showInactive)
      }

      setPendingRowId(null)
    })
  }

  function handleReactivateMember(member: MemberRow) {
    setPendingRowId(member.rowId)
    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('userId', member.userId)

      const result = await reactivateMemberAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMembers(queryFilters, showInactive)
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
      <div className="flex items-start justify-between gap-4">
        <SettingsHeader
          title="Members"
          description="Manage members, assign roles, and department assignments."
        />
        <CreateMemberModal
          departments={departments}
          viewerRole={viewerRole}
          onSaved={handleMemberSaved}
        />
      </div>

      {feedback ? (
        <SettingsSurface
          className={
            feedback.tone === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
              : 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400'
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

          <div className="md:col-span-3 flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showInactive}
                onChange={(event) => setShowInactive(event.target.checked)}
                className="rounded border-input"
              />
              Show inactive
            </label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" onClick={() => setFormFilters(INITIAL_FILTERS)}>
                Clear
              </Button>
              <Button type="submit">Apply Filters</Button>
            </div>
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
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className={
                              row.role === 'owner'
                                ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : row.role === 'admin'
                                  ? 'border-purple-200 bg-purple-100 text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                                  : row.role === 'manager'
                                    ? 'border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                    : ''
                            }
                          >
                            {ROLE_LABELS[row.role]}
                          </Badge>
                          {!row.isActive ? (
                            <Badge variant="outline" className="border-gray-200 bg-gray-100 text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                              Inactive
                            </Badge>
                          ) : null}
                        </div>
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

                          {row.isActive ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title={`Deactivate ${row.name}`}
                              aria-label={`Deactivate ${row.name}`}
                              onClick={() => handleDeactivateMember(row)}
                              disabled={rowPending}
                            >
                              <UserX className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              title={`Reactivate ${row.name}`}
                              aria-label={`Reactivate ${row.name}`}
                              onClick={() => handleReactivateMember(row)}
                              disabled={rowPending}
                            >
                              <UserCheck className="size-4" />
                            </Button>
                          )}

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
