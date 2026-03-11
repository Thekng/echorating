import { ROUTES } from '@/lib/constants/routes'
import { formatPercent } from '@/lib/metrics/format'
import { formatDateShort } from '@/lib/utils/date-formatter'
import { AgentsFilters } from '@/components/agents/agents-filters'
import { listDepartments } from '@/features/departments/queries'
import { getAgentsList } from '@/features/agents/queries'
import Link from 'next/link'
import { Trophy } from 'lucide-react'

type AccountabilityPageProps = {
  searchParams: Promise<{
    departmentId?: string
    period?: 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom'
    startDate?: string
    endDate?: string
    q?: string
    status?: 'all' | 'active' | 'inactive'
  }>
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }

  return formatDateShort(value)
}

export default async function AccountabilityPage({ searchParams }: AccountabilityPageProps) {
  const params = await searchParams
  const filterPeriod: 'today' | 'current_week' | 'this_month' | 'custom' =
    params.period === 'current_week' || params.period === 'this_month' || params.period === 'custom'
      ? params.period
      : params.period === 'this_week'
        ? 'current_week'
        : 'today'

  const departmentsResult = await listDepartments({
    status: 'active',
  })

  if (!departmentsResult.success || !departmentsResult.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {departmentsResult.error}
      </div>
    )
  }

  if (departmentsResult.data.length === 0) {
    return (
      <div className="rounded-lg border border-muted/40 bg-card p-4 text-sm text-muted-foreground">
        No active departments found.
      </div>
    )
  }

  const requestedDepartmentId =
    params.departmentId && params.departmentId !== 'all'
      ? params.departmentId
      : null
  const selectedDepartmentId = departmentsResult.data.some((department) => department.department_id === requestedDepartmentId)
    ? (requestedDepartmentId as string)
    : departmentsResult.data[0].department_id

  const selectedDepartment = departmentsResult.data.find((department) => department.department_id === selectedDepartmentId)

  const agentsResult = await getAgentsList({
    departmentId: selectedDepartmentId,
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
    q: params.q,
    status: params.status,
  })

  if (!agentsResult.success || !agentsResult.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {agentsResult.error}
      </div>
    )
  }

  const rows = agentsResult.data.rows

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground">Select a team to view live agent submission performance.</p>
        </div>
        <Link
          href="/leaderboard"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-muted"
        >
          <Trophy className="size-4 text-amber-500" />
          <span>Leaderboard</span>
        </Link>
      </div>

      <AgentsFilters
        basePath={ROUTES.ACCOUNTABILITY}
        departments={departmentsResult.data}
        selectedDepartmentId={selectedDepartmentId}
        period={filterPeriod}
        startDate={params.startDate ?? ''}
        endDate={params.endDate ?? ''}
        status={params.status ?? 'active'}
        q={params.q}
        showStatus
        showSearch
        allowAllDepartment={false}
      />

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Agent Performance</p>
            <p className="text-xs text-muted-foreground">
              {selectedDepartment?.name ?? 'Selected team'} · {rows.length} agent{rows.length !== 1 ? 's' : ''}
            </p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Team Member</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Submitted</th>
                <th className="px-4 py-2 text-left font-medium">Draft</th>
                <th className="px-4 py-2 text-left font-medium">Completion</th>
                <th className="px-4 py-2 text-left font-medium">Last Entry</th>
                <th className="px-4 py-2 text-right font-medium">Profile</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No agents found for this filter.
                  </td>
                </tr>
              ) : null}

              {rows.map((row) => (
                <tr key={row.user_id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 capitalize">{row.role}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.is_active
                          ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                          : 'rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs text-slate-700'
                      }
                    >
                      {row.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">{row.submitted_count}</td>
                  <td className="px-4 py-3">{row.draft_count}</td>
                  <td className="px-4 py-3">{formatPercent(row.completion_rate, 1)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(row.last_entry_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${ROUTES.ACCOUNTABILITY}/${selectedDepartmentId}/agent/${row.user_id}`}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
