import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { getDepartmentProfile, listDepartments, getDepartmentAgentMetrics } from '@/features/departments/queries'
import { getAgentsList } from '@/features/agents/queries'
import { formatDateShort } from '@/lib/utils/date-formatter'
import { AgentsFilters } from '@/components/agents/agents-filters'

type DepartmentDetailPageProps = {
  params: Promise<{ departmentId: string }>
  searchParams: Promise<{
    period?: 'today' | 'current_week' | 'this_week' | 'this_month' | 'custom'
    startDate?: string
    endDate?: string
  }>
}

function formatDate(value: string | null) {
  if (!value) {
    return '-'
  }
  return formatDateShort(value)
}

export default async function DepartmentDetailPage({ params, searchParams }: DepartmentDetailPageProps) {
  const { departmentId } = await params
  const query = await searchParams

  const deptResult = await getDepartmentProfile(
    departmentId,
    query.period,
    query.startDate,
    query.endDate,
  )

  if (!deptResult.success || !deptResult.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {deptResult.error}
      </div>
    )
  }

  const { department, stats, metrics, recent_entries, members_count } = deptResult.data

  // departments for filters
  const allDepartmentsResult = await listDepartments()
  const allDepartments = allDepartmentsResult.success && allDepartmentsResult.data ? allDepartmentsResult.data : []

  // Get agents in this department for the team member list
  const agentsResult = await getAgentsList({
    departmentId,
    period: query.period,
    startDate: query.startDate,
    endDate: query.endDate,
  })

  // Get aggregated metrics for each agent in this period
  const agentMetricsResult = await getDepartmentAgentMetrics(
    departmentId,
    agentsResult.success && agentsResult.data ? agentsResult.data.rows.map(r => r.user_id) : [],
    deptResult.data.startDate,
    deptResult.data.endDate,
  )

  return (
    <div className="space-y-6">
      {/* Department Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{department.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Team performance overview</p>
        </div>
        <Link
          href={`${ROUTES.ACCOUNTABILITY}`}
          className="rounded-md border border-input px-3 py-1.5 text-sm hover:bg-muted/40"
        >
          ← Back
        </Link>
      </div>

      <AgentsFilters
        basePath={ROUTES.ACCOUNTABILITY}
        departments={allDepartments}
        selectedDepartmentId={department.department_id}
        period={(query.period as any) ?? 'today'}
        startDate={query.startDate ?? ''}
        endDate={query.endDate ?? ''}
        showStatus={false}
        showSearch={false}
        allowAllDepartment={false}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Members</p>
          <p className="mt-1 text-2xl font-bold">{members_count}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Submitted</p>
          <p className="mt-1 text-2xl font-bold">{stats.submitted_count}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Completion</p>
          <p className="mt-1 text-2xl font-bold">{stats.completion_rate.toFixed(1)}%</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Last Entry</p>
          <p className="mt-1 text-sm font-semibold">{formatDate(stats.last_entry_date)}</p>
        </div>
      </div>

      {/* Recent Logs */}
      <section className="rounded-xl border bg-card">
        <header className="border-b px-4 py-3">
          <p className="text-sm font-semibold">Recent Team Logs</p>
          <p className="text-xs text-muted-foreground">Last 20 submitted entries</p>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Date</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Notes</th>
                {metrics.slice(0, 5).map((metric) => (
                  <th key={metric.metric_id} className="px-4 py-2 text-left font-medium">
                    {metric.code}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent_entries.length === 0 ? (
                <tr>
                  <td colSpan={3 + Math.min(5, metrics.length)} className="px-4 py-8 text-center text-muted-foreground">
                    No entries found for this period.
                  </td>
                </tr>
              ) : null}
              {recent_entries.map((entry) => (
                <tr key={entry.entry_id} className="border-b last:border-b-0">
                  <td className="px-4 py-3">{formatDate(entry.entry_date)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        entry.status === 'submitted'
                          ? 'rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700'
                          : 'rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700'
                      }
                    >
                      {entry.status === 'submitted' ? 'Submitted' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{entry.notes || '-'}</td>
                  {entry.metric_values.slice(0, 5).map((mv) => (
                    <td key={mv.metric_id} className="px-4 py-3">
                      {mv.value_numeric !== null ? mv.value_numeric : mv.value_text || mv.value_bool || '-'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Team Members - Metrics Table */}
      {agentsResult.success && agentsResult.data && agentsResult.data.rows.length > 0 ? (
        <section className="rounded-xl border bg-card">
          <header className="border-b px-4 py-3">
            <p className="text-sm font-semibold">Team Members Performance</p>
            <p className="text-xs text-muted-foreground">Stats aggregated for selected period</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-4 py-2 text-left font-medium">Team Member</th>
                  <th className="px-4 py-2 text-left font-medium">Completion</th>
                  {metrics.slice(0, 5).map((metric) => (
                    <th key={metric.metric_id} className="px-4 py-2 text-left font-medium text-xs">
                      {metric.code}
                    </th>
                  ))}
                  <th className="px-4 py-2 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {agentsResult.data.rows.map((agent) => {
                  const agentMetrics = agentMetricsResult.success && agentMetricsResult.data
                    ? agentMetricsResult.data[agent.user_id] ?? {}
                    : {}

                  return (
                    <tr key={agent.user_id} className="border-b last:border-b-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium">{agent.name}</td>
                      <td className="px-4 py-3">{agent.completion_rate.toFixed(1)}%</td>
                      {metrics.slice(0, 5).map((metric) => {
                        const value = agentMetrics[metric.metric_id]
                        const displayValue = value !== undefined && value !== null
                          ? metric.data_type === 'number'
                            ? Math.round(value)
                            : value.toFixed(2)
                          : '-'

                        return (
                          <td key={metric.metric_id} className="px-4 py-3 text-sm text-muted-foreground">
                            {displayValue}
                          </td>
                        )
                      })}
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`${ROUTES.ACCOUNTABILITY}/${departmentId}/agent/${agent.user_id}`}
                          className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}
