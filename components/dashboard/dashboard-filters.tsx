'use client'

import { useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

type DashboardFiltersProps = {
  departments: Array<{
    department_id: string
    name: string
  }>
  selectedDepartmentId: string
  period: 'today' | 'current_week' | 'this_month' | 'custom'
  startDate: string
  endDate: string
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

export function DashboardFilters({
  departments,
  selectedDepartmentId,
  period,
  startDate,
  endDate,
}: DashboardFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const defaultStartDate = useMemo(() => startDate || todayKey(), [startDate])
  const defaultEndDate = useMemo(() => endDate || todayKey(), [endDate])

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    const query = params.toString()
    router.push(query ? `/dashboard?${query}` : '/dashboard')
  }

  return (
    <section className="rounded-xl border bg-card p-3 md:p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div>
          <label htmlFor="dashboard-department" className="mb-1 block text-sm font-medium">
            Team
          </label>
          <select
            id="dashboard-department"
            value={selectedDepartmentId}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) =>
              updateFilters({
                departmentId: event.currentTarget.value || null,
              })
            }
          >
            {departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="dashboard-period" className="mb-1 block text-sm font-medium">
            Time period
          </label>
          <select
            id="dashboard-period"
            value={period}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            onChange={(event) => {
              const nextPeriod = event.currentTarget.value as DashboardFiltersProps['period']
              if (nextPeriod === 'custom') {
                updateFilters({
                  period: nextPeriod,
                  startDate: defaultStartDate,
                  endDate: defaultEndDate,
                })
                return
              }

              updateFilters({
                period: nextPeriod,
                startDate: null,
                endDate: null,
              })
            }}
          >
            <option value="today">Today</option>
            <option value="current_week">Current week</option>
            <option value="this_month">This month</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {period === 'custom' ? (
          <>
            <div>
              <label htmlFor="dashboard-start-date" className="mb-1 block text-sm font-medium">
                Start date
              </label>
              <input
                id="dashboard-start-date"
                type="date"
                value={startDate}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  updateFilters({
                    startDate: event.currentTarget.value || null,
                  })
                }
              />
            </div>

            <div>
              <label htmlFor="dashboard-end-date" className="mb-1 block text-sm font-medium">
                End date
              </label>
              <input
                id="dashboard-end-date"
                type="date"
                value={endDate}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) =>
                  updateFilters({
                    endDate: event.currentTarget.value || null,
                  })
                }
              />
            </div>
          </>
        ) : null}
      </div>
    </section>
  )
}
