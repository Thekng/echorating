'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

type Period = 'today' | 'current_week' | 'this_month' | 'last_week' | 'last_month' | 'custom'

type AgentsFiltersProps = {
  basePath: string
  departments: Array<{
    department_id: string
    name: string
  }>
  selectedDepartmentId: string
  showDepartment?: boolean
  period: Period
  startDate: string
  endDate: string
  status?: 'all' | 'active' | 'inactive'
  q?: string
  showStatus?: boolean
  showSearch?: boolean
  allowAllDepartment?: boolean
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function AgentsFilters({
  basePath,
  departments,
  selectedDepartmentId,
  showDepartment = true,
  period,
  startDate,
  endDate,
  status = 'active',
  q = '',
  showStatus = false,
  showSearch = false,
  allowAllDepartment = true,
}: AgentsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [search, setSearch] = useState(q)

  useEffect(() => {
    setSearch(q)
  }, [q])

  const hasDepartments = departments.length > 0

  const defaultCustomStart = useMemo(() => {
    if (startDate) {
      return startDate
    }
    return todayKey()
  }, [startDate])

  const defaultCustomEnd = useMemo(() => {
    if (endDate) {
      return endDate
    }
    return todayKey()
  }, [endDate])

  const pushWith = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value || value === 'all') {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    if (!showDepartment) {
      params.delete('departmentId')
    }

    const query = params.toString()
    router.push(query ? `${basePath}?${query}` : basePath)
  }

  return (
    <section className="rounded-xl border bg-card p-4">
      <div className={`grid gap-4 md:grid-cols-2 ${showDepartment ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
        {showDepartment ? (
          <div>
            <label htmlFor="agents-department" className="mb-1 block text-sm font-medium">
              Department
            </label>
            <select
              id="agents-department"
              value={selectedDepartmentId}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) =>
                pushWith({
                  departmentId: event.currentTarget.value,
                })
              }
              disabled={!hasDepartments}
            >
              {!hasDepartments ? <option value="">No departments found</option> : null}
              {allowAllDepartment ? <option value="all">All departments</option> : null}
              {departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="agents-period" className="mb-1 block text-sm font-medium">
            Time
          </label>
          <select
            id="agents-period"
            value={period}
            className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              const nextPeriod = event.currentTarget.value as Period
              if (nextPeriod === 'custom') {
                pushWith({
                  period: nextPeriod,
                  startDate: defaultCustomStart,
                  endDate: defaultCustomEnd,
                })
                return
              }

              pushWith({
                period: nextPeriod,
                startDate: null,
                endDate: null,
              })
            }}
          >
            <option value="today">Today</option>
            <option value="current_week">Current week</option>
            <option value="last_week">Last week</option>
            <option value="this_month">This month</option>
            <option value="last_month">Last month</option>
            <option value="custom">Customize</option>
          </select>
        </div>

        {period === 'custom' ? (
          <>
            <div>
              <label htmlFor="agents-start-date" className="mb-1 block text-sm font-medium">
                Start date
              </label>
              <input
                id="agents-start-date"
                type="date"
                value={startDate}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  pushWith({
                    startDate: event.currentTarget.value || null,
                  })
                }
              />
            </div>
            <div>
              <label htmlFor="agents-end-date" className="mb-1 block text-sm font-medium">
                End date
              </label>
              <input
                id="agents-end-date"
                type="date"
                value={endDate}
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  pushWith({
                    endDate: event.currentTarget.value || null,
                  })
                }
              />
            </div>
          </>
        ) : null}

        {showStatus ? (
          <div>
            <label htmlFor="agents-status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="agents-status"
              value={status}
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) =>
                pushWith({
                  status: event.currentTarget.value,
                })
              }
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        ) : null}
      </div>

      {showSearch ? (
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  pushWith({ q: search.trim() || null })
                }
              }}
              placeholder="Search agents by name..."
              className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            className="h-11 rounded-md border border-input px-4 text-sm font-medium hover:bg-muted/40 transition-colors"
            onClick={() => pushWith({ q: search.trim() || null })}
          >
            Search
          </button>
        </div>
      ) : null}
    </section>
  )
}
