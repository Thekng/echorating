'use client'

import { useRouter, useSearchParams } from 'next/navigation'

type DailyLogFiltersProps = {
  canManage: boolean
  showDepartmentFilter: boolean
  departments: Array<{
    department_id: string
    name: string
  }>
  selectedDepartmentId: string
  agentOptions: Array<{
    user_id: string
    name: string
  }>
  selectedUserId: string
  date: string
}

export function DailyLogFilters({
  canManage,
  showDepartmentFilter,
  departments,
  selectedDepartmentId,
  agentOptions,
  selectedUserId,
  date,
}: DailyLogFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())

    for (const [key, value] of Object.entries(updates)) {
      if (!value) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }

    router.push(`/daily-log?${params.toString()}`)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {showDepartmentFilter ? (
        <div>
          <label htmlFor="daily-log-department" className="mb-1 block text-sm font-medium">
            Department
          </label>
          <select
            id="daily-log-department"
            name="departmentId"
            value={selectedDepartmentId}
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            onChange={(event) =>
              updateFilters({
                departmentId: event.currentTarget.value || null,
                userId: canManage ? null : selectedUserId || null,
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
      ) : (
        <input type="hidden" name="departmentId" value={selectedDepartmentId} />
      )}

      {canManage ? (
        <div>
          <label htmlFor="daily-log-user" className="mb-1 block text-sm font-medium">
            Agent
          </label>
          <select
            id="daily-log-user"
            name="userId"
            value={selectedUserId}
            className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
            disabled={agentOptions.length === 0}
            onChange={(event) =>
              updateFilters({
                userId: event.currentTarget.value || null,
              })
            }
          >
            {agentOptions.map((agent) => (
              <option key={agent.user_id} value={agent.user_id}>
                {agent.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="userId" value={selectedUserId} />
      )}

      <div>
        <label htmlFor="daily-log-date" className="mb-1 block text-sm font-medium">
          Date
        </label>
        <input
          id="daily-log-date"
          name="date"
          type="date"
          value={date}
          className="h-12 w-full rounded-md border border-input bg-background px-3 text-base"
          onChange={(event) =>
            updateFilters({
              date: event.currentTarget.value || null,
            })
          }
        />
      </div>
    </div>
  )
}
