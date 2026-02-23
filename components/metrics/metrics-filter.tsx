'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Filter, RotateCcw, Search } from 'lucide-react'
import { ROUTES } from '@/lib/constants/routes'

type MetricsFilterProps = {
  departments: Array<{
    department_id: string
    name: string
  }>
  selectedDepartmentId: string
  query?: string
  mode?: string
}

export function MetricsFilter({
  departments,
  selectedDepartmentId,
  query = '',
  mode = 'all',
}: MetricsFilterProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const hasDepartments = departments.length > 0

  const handleDepartmentChange = (departmentId: string) => {
    const params = new URLSearchParams(searchParams)
    if (departmentId) {
      params.set('departmentId', departmentId)
    } else {
      params.delete('departmentId')
    }
    params.delete('q') // Reset search when changing department
    router.push(`?${params.toString()}`)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const params = new URLSearchParams()

    const departmentId = formData.get('departmentId') as string
    const q = formData.get('q') as string
    const modeValue = formData.get('mode') as string

    if (departmentId) {
      params.set('departmentId', departmentId)
    }
    if (q) {
      params.set('q', q)
    }
    if (modeValue && modeValue !== 'all') {
      params.set('mode', modeValue)
    }

    router.push(`?${params.toString()}`)
  }

  return (
    <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="departmentId" className="mb-1 block text-sm font-medium">
          Department
        </label>
        <select
          id="departmentId"
          name="departmentId"
          defaultValue={selectedDepartmentId || ''}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          onChange={(e) => handleDepartmentChange(e.target.value)}
          disabled={!hasDepartments}
        >
          {departments.length === 0 ? <option value="">No department</option> : null}
          {departments.map((department) => (
            <option key={department.department_id} value={department.department_id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div className="md:col-span-2">
        <label htmlFor="q" className="mb-1 block text-sm font-medium">
          Search
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Metric name, code or description"
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
            disabled={!hasDepartments}
          />
        </div>
      </div>

      <div>
        <label htmlFor="mode" className="mb-1 block text-sm font-medium">
          Mode
        </label>
        <select
          id="mode"
          name="mode"
          defaultValue={mode}
          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          disabled={!hasDepartments}
        >
          <option value="all">All</option>
          <option value="manual">Manual</option>
          <option value="calculated">Calculated</option>
        </select>
      </div>

      <div className="md:col-span-4 flex items-center justify-end gap-2">
        <button
          type="button"
          title="Reset filters"
          aria-label="Reset filters"
          className="inline-flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted/40 disabled:opacity-60"
          onClick={() => router.push(ROUTES.SETTINGS_METRICS)}
          disabled={!hasDepartments}
        >
          <RotateCcw className="size-4" />
        </button>
        <button
          type="submit"
          title="Apply filters"
          aria-label="Apply filters"
          className="inline-flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted/40"
          disabled={!hasDepartments}
        >
          <Filter className="size-4" />
        </button>
      </div>
    </form>
  )
}
