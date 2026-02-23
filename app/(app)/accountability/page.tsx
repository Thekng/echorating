import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { formatDateShort } from '@/lib/utils/date-formatter'
import { AgentsFilters } from '@/components/agents/agents-filters'
import { listDepartments } from '@/features/departments/queries'
import { getDepartmentAggregateStats } from '@/features/departments/queries'

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

  const departmentsResult = await listDepartments({
    q: params.q,
    status: params.status ?? 'active',
  })

  if (!departmentsResult.success || !departmentsResult.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {departmentsResult.error}
      </div>
    )
  }

  // Get aggregated stats for each department
  const departmentsWithStats = await Promise.all(
    departmentsResult.data.map(async (dept) => {
      const statsResult = await getDepartmentAggregateStats(
        dept.department_id,
        params.period,
        params.startDate,
        params.endDate,
      )
      
      return {
        ...dept,
        stats: statsResult.data || {
          total_members: 0,
          submitted_count: 0,
          draft_count: 0,
          completion_rate: 0,
          last_entry_date: null,
          department_score: null,
        },
      }
    }),
  )

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accountability</h1>
        <p className="text-sm text-muted-foreground">View department performance and team accountability.</p>
      </div>

      <AgentsFilters
        basePath={ROUTES.ACCOUNTABILITY}
        departments={departmentsResult.data}
        selectedDepartmentId={params.departmentId ?? 'all'}
        period={(params.period as any) ?? 'today'}
        startDate={params.startDate ?? ''}
        endDate={params.endDate ?? ''}
        status={params.status ?? 'active'}
        q={params.q}
        showStatus
        showSearch
      />

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Departments Overview</p>
            <p className="text-xs text-muted-foreground">
              {departmentsWithStats.length} department{departmentsWithStats.length !== 1 ? 's' : ''}
            </p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Department</th>
                <th className="px-4 py-2 text-left font-medium">Members</th>
                <th className="px-4 py-2 text-left font-medium">Submitted</th>
                <th className="px-4 py-2 text-left font-medium">Draft</th>
                <th className="px-4 py-2 text-left font-medium">Completion</th>
                <th className="px-4 py-2 text-left font-medium">Score</th>
                <th className="px-4 py-2 text-left font-medium">Last Entry</th>
                <th className="px-4 py-2 text-right font-medium">View</th>
              </tr>
            </thead>
            <tbody>
              {departmentsWithStats.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No departments found.
                  </td>
                </tr>
              ) : null}

              {departmentsWithStats.map((dept) => (
                <tr key={dept.department_id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{dept.name}</td>
                  <td className="px-4 py-3">{dept.stats.total_members}</td>
                  <td className="px-4 py-3">{dept.stats.submitted_count}</td>
                  <td className="px-4 py-3">{dept.stats.draft_count}</td>
                  <td className="px-4 py-3">{dept.stats.completion_rate.toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    {dept.stats.department_score === null ? '-' : `${dept.stats.department_score.toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(dept.stats.last_entry_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`${ROUTES.ACCOUNTABILITY}/${dept.department_id}`}
                      className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                    >
                      View
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
