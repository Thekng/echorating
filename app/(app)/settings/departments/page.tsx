import Link from 'next/link'
import { CreateDepartmentModal } from '@/components/departments/create-department-modal'
import { EditDepartmentModal } from '@/components/departments/edit-department-modal'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsRow } from '@/components/settings/settings-row'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsError } from '@/components/settings/settings-error'
import { SettingsChip } from '@/components/settings/settings-chip'
import { toggleDepartmentStatusAction } from '@/features/departments/actions'
import { listDepartments } from '@/features/departments/queries'
import { ROUTES } from '@/lib/constants/routes'
import { Filter, Power, RotateCcw, Search } from 'lucide-react'

type DepartmentsPageProps = {
  searchParams: Promise<{
    q?: string
    type?: string
  }>
}

const TYPE_LABELS: Record<string, string> = {
  sales: 'Sales',
  service: 'Service',
  life: 'Life',
  marketing: 'Marketing',
  custom: 'Custom',
}

export default async function DepartmentsSettingsPage({ searchParams }: DepartmentsPageProps) {
  const params = await searchParams
  const result = await listDepartments({
    q: params.q,
    status: 'all',
    type: params.type,
  })

  if (!result.success) {
    return <SettingsError error={result.error || 'Failed to load departments'} />
  }

  const activeDepartments = result.data.filter((department) => department.is_active)
  const inactiveDepartments = result.data.filter((department) => !department.is_active)

  return (
    <div className="space-y-5">
      <SettingsPageHeader
        title="Departments"
        description="Manage active and inactive departments with quick actions."
        actions={<CreateDepartmentModal />}
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
              placeholder="Department name"
              className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            />
          </div>
        </div>

        <div>
          <label htmlFor="type" className="mb-1 block text-sm font-medium">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={params.type ?? 'all'}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="sales">Sales</option>
            <option value="service">Service</option>
            <option value="life">Life</option>
            <option value="marketing">Marketing</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="md:col-span-4 flex items-center justify-end gap-2">
          <Link
            href={ROUTES.SETTINGS_DEPARTMENTS}
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
        <h2 className="text-lg font-semibold">Active Departments ({activeDepartments.length})</h2>
        {activeDepartments.length === 0 ? (
          <SettingsEmptyState message="No active department found." />
        ) : (
          <div className="space-y-2">
            {activeDepartments.map((department) => (
              <SettingsRow
                key={department.department_id}
                title={department.name}
                subtitle={`Updated ${new Date(department.updated_at).toLocaleDateString()}`}
                meta={
                  <SettingsChip tone="success">
                    {TYPE_LABELS[department.type] ?? department.type}
                  </SettingsChip>
                }
                actions={
                  <>
                    <EditDepartmentModal
                      departmentId={department.department_id}
                      name={department.name}
                      type={department.type}
                    />
                    <form action={toggleDepartmentStatusAction}>
                      <input type="hidden" name="departmentId" value={department.department_id} />
                      <input type="hidden" name="nextStatus" value="inactive" />
                      <button
                        type="submit"
                        title={`Deactivate ${department.name}`}
                        aria-label={`Deactivate ${department.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                      >
                        <Power className="size-3.5" />
                      </button>
                    </form>
                  </>
                }
              />
            ))}
          </div>
        )}
      </SettingsSurface>

      <SettingsSurface>
        <details>
          <summary className="cursor-pointer list-none text-lg font-semibold">
            Inactive Departments ({inactiveDepartments.length})
          </summary>
          <div className="mt-3 space-y-2">
            {inactiveDepartments.length === 0 ? (
              <SettingsEmptyState message="No inactive department found." />
            ) : (
              inactiveDepartments.map((department) => (
                <SettingsRow
                  key={department.department_id}
                  title={department.name}
                  subtitle={`Updated ${new Date(department.updated_at).toLocaleDateString()}`}
                  meta={
                    <SettingsChip>
                      {TYPE_LABELS[department.type] ?? department.type}
                    </SettingsChip>
                  }
                  actions={
                    <form action={toggleDepartmentStatusAction}>
                      <input type="hidden" name="departmentId" value={department.department_id} />
                      <input type="hidden" name="nextStatus" value="active" />
                      <button
                        type="submit"
                        title={`Activate ${department.name}`}
                        aria-label={`Activate ${department.name}`}
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
