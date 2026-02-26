'use client'

import { useEffect, useMemo, useState, useTransition, type FormEvent } from 'react'
import {
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
  type DepartmentActionState,
} from '@/features/departments/actions'
import { listDepartments } from '@/features/departments/queries'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsError } from '@/components/settings/settings-error'
import { Button } from '@/components/ui/button'
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'

type Department = {
  department_id: string
  name: string
  type: 'sales' | 'service' | 'life' | 'marketing' | 'custom'
  is_active: boolean
  created_at: string
  updated_at: string
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

const INITIAL_ACTION_STATE: DepartmentActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
}

const DEPARTMENT_TYPES = [
  { value: 'sales', label: 'Sales' },
  { value: 'service', label: 'Service' },
  { value: 'life', label: 'Life' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'custom', label: 'Custom' },
] as const

const TYPE_LABELS: Record<Department['type'], string> = {
  sales: 'Sales',
  service: 'Service',
  life: 'Life',
  marketing: 'Marketing',
  custom: 'Custom',
}

export default function DepartmentsSettingsPage() {
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null)

  const [createState, setCreateState] = useState<DepartmentActionState>(INITIAL_ACTION_STATE)
  const [updateState, setUpdateState] = useState<DepartmentActionState>(INITIAL_ACTION_STATE)

  const [pendingCreate, startCreateTransition] = useTransition()
  const [pendingUpdate, startUpdateTransition] = useTransition()
  const [pendingDeleteDepartmentId, setPendingDeleteDepartmentId] = useState<string | null>(null)
  const [isDeleting, startDeleteTransition] = useTransition()

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.is_active),
    [departments],
  )
  const inactiveDepartments = useMemo(
    () => departments.filter((department) => !department.is_active),
    [departments],
  )

  async function fetchDepartments() {
    setLoading(true)
    setError(null)
    try {
      const result = await listDepartments({
        status: 'all',
      })

      if (!result.success) {
        setError(result.error || 'Failed to load departments.')
        return
      }

      setDepartments((result.data ?? []) as Department[])
    } catch {
      setError('An unexpected error occurred while loading departments.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDepartments()
  }, [])

  function closeCreateModal() {
    setCreateState(INITIAL_ACTION_STATE)
    setShowCreateModal(false)
  }

  function closeEditModal() {
    setUpdateState(INITIAL_ACTION_STATE)
    setEditingDepartment(null)
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setCreateState(INITIAL_ACTION_STATE)

    startCreateTransition(async () => {
      const nextState = await createDepartmentAction(INITIAL_ACTION_STATE, formData)
      setCreateState(nextState)

      if (nextState.status === 'success') {
        setFeedback({ tone: 'success', message: nextState.message })
        closeCreateModal()
        await fetchDepartments()
      } else {
        setFeedback({ tone: 'error', message: nextState.message })
      }
    })
  }

  function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    setUpdateState(INITIAL_ACTION_STATE)

    startUpdateTransition(async () => {
      const nextState = await updateDepartmentAction(INITIAL_ACTION_STATE, formData)
      setUpdateState(nextState)

      if (nextState.status === 'success') {
        setFeedback({ tone: 'success', message: nextState.message })
        closeEditModal()
        await fetchDepartments()
      } else {
        setFeedback({ tone: 'error', message: nextState.message })
      }
    })
  }

  function handleDeleteDepartment(department: Department) {
    const confirmed = window.confirm(
      `Delete "${department.name}"? This will also deactivate its metrics, targets, and member assignments.`,
    )
    if (!confirmed) {
      return
    }

    setPendingDeleteDepartmentId(department.department_id)
    startDeleteTransition(async () => {
      const formData = new FormData()
      formData.set('departmentId', department.department_id)
      const result = await deleteDepartmentAction(INITIAL_ACTION_STATE, formData)

      if (result.status === 'success') {
        setFeedback({ tone: 'success', message: result.message })
        await fetchDepartments()
      } else {
        setFeedback({ tone: 'error', message: result.message })
      }

      setPendingDeleteDepartmentId(null)
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Departments" description="Loading departments..." />
        <SettingsSurface>
          <p className="text-sm text-muted-foreground">Loading departments...</p>
        </SettingsSurface>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Departments" description="Create and manage teams within your organization." />
        <SettingsError error={error} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Departments"
        description="Create, edit, and remove teams within your organization."
        actions={
          <Button type="button" onClick={() => setShowCreateModal(true)}>
            <Plus className="size-4" />
            New Department
          </Button>
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

      {activeDepartments.length === 0 && inactiveDepartments.length === 0 ? (
        <SettingsSurface>
          <SettingsEmptyState
            message="No departments yet. Create your first team to organize members and metrics."
            icon={<FolderKanban className="mb-3 size-8 text-muted-foreground" />}
          />
        </SettingsSurface>
      ) : (
        <>
          <SettingsSurface>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Active Departments</h2>
              <span className="text-xs text-muted-foreground">{activeDepartments.length}</span>
            </div>

            {activeDepartments.length === 0 ? (
              <SettingsEmptyState message="No active departments." />
            ) : (
              <div className="space-y-2">
                {activeDepartments.map((department) => (
                  <div
                    key={department.department_id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{department.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[department.type]} · Updated{' '}
                        {new Date(department.updated_at).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        title={`Edit ${department.name}`}
                        aria-label={`Edit ${department.name}`}
                        onClick={() => {
                          setUpdateState(INITIAL_ACTION_STATE)
                          setEditingDepartment(department)
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>

                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        title={`Delete ${department.name}`}
                        aria-label={`Delete ${department.name}`}
                        className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => handleDeleteDepartment(department)}
                        disabled={
                          isDeleting && pendingDeleteDepartmentId === department.department_id
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSurface>

          <SettingsSurface>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Inactive Departments</h2>
              <span className="text-xs text-muted-foreground">{inactiveDepartments.length}</span>
            </div>

            {inactiveDepartments.length === 0 ? (
              <SettingsEmptyState message="No inactive departments." />
            ) : (
              <div className="space-y-2">
                {inactiveDepartments.map((department) => (
                  <div
                    key={department.department_id}
                    className="rounded-md border border-border px-3 py-2"
                  >
                    <p className="text-sm font-medium">{department.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {TYPE_LABELS[department.type]} · Updated{' '}
                      {new Date(department.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SettingsSurface>
        </>
      )}

      {showCreateModal ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={closeCreateModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Create Department</h2>
            <p className="mt-1 text-sm text-muted-foreground">Add a team to your company.</p>

            <form className="mt-4 space-y-4" onSubmit={handleCreateSubmit}>
              <div className="space-y-2">
                <label htmlFor="create-department-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="create-department-name"
                  name="name"
                  required
                  minLength={2}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                {createState.fieldErrors.name ? (
                  <p className="text-xs text-destructive">{createState.fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="create-department-type" className="text-sm font-medium">
                  Type
                </label>
                <select
                  id="create-department-type"
                  name="type"
                  defaultValue="sales"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENT_TYPES.map((departmentType) => (
                    <option key={departmentType.value} value={departmentType.value}>
                      {departmentType.label}
                    </option>
                  ))}
                </select>
                {createState.fieldErrors.type ? (
                  <p className="text-xs text-destructive">{createState.fieldErrors.type}</p>
                ) : null}
              </div>

              {createState.status === 'error' ? (
                <p className="text-sm text-destructive">{createState.message}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeCreateModal} disabled={pendingCreate}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pendingCreate}>
                  {pendingCreate ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editingDepartment ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={closeEditModal}
        >
          <div
            className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-card-foreground shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Edit Department</h2>
            <p className="mt-1 text-sm text-muted-foreground">Update team name and type.</p>

            <form className="mt-4 space-y-4" onSubmit={handleUpdateSubmit}>
              <input type="hidden" name="departmentId" value={editingDepartment.department_id} />

              <div className="space-y-2">
                <label htmlFor="edit-department-name" className="text-sm font-medium">
                  Name
                </label>
                <input
                  id="edit-department-name"
                  name="name"
                  required
                  minLength={2}
                  defaultValue={editingDepartment.name}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                {updateState.fieldErrors.name ? (
                  <p className="text-xs text-destructive">{updateState.fieldErrors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="edit-department-type" className="text-sm font-medium">
                  Type
                </label>
                <select
                  id="edit-department-type"
                  name="type"
                  defaultValue={editingDepartment.type}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DEPARTMENT_TYPES.map((departmentType) => (
                    <option key={departmentType.value} value={departmentType.value}>
                      {departmentType.label}
                    </option>
                  ))}
                </select>
                {updateState.fieldErrors.type ? (
                  <p className="text-xs text-destructive">{updateState.fieldErrors.type}</p>
                ) : null}
              </div>

              {updateState.status === 'error' ? (
                <p className="text-sm text-destructive">{updateState.message}</p>
              ) : null}

              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeEditModal} disabled={pendingUpdate}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pendingUpdate}>
                  {pendingUpdate ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
