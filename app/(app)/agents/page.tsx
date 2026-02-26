import Link from 'next/link'
import { ROUTES } from '@/lib/constants/routes'
import { formatPercent } from '@/lib/metrics/format'
import { formatDateShort } from '@/lib/utils/date-formatter'
import { AgentsFilters } from '@/components/agents/agents-filters'
import { getAgentsList } from '@/features/agents/queries'

type AgentsPageProps = {
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

export default async function AgentsPage({ searchParams }: AgentsPageProps) {
  const params = await searchParams

  const result = await getAgentsList({
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
    q: params.q,
    status: params.status,
  })

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {result.error}
      </div>
    )
  }

  const {
    departments,
    period,
    startDate,
    endDate,
    q,
    status,
    rows,
  } = result.data

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
        <p className="text-sm text-muted-foreground">Manage roster and track daily performance consistency.</p>
      </div>

      <AgentsFilters
        basePath={ROUTES.AGENTS}
        departments={departments}
        selectedDepartmentId="all"
        showDepartment={false}
        period={period}
        startDate={startDate}
        endDate={endDate}
        status={status}
        q={q}
        showStatus
        showSearch
      />

      <section className="rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Team Member Roster</p>
            <p className="text-xs text-muted-foreground">
              Showing members for the selected period.
            </p>
          </div>
        </header>

        <div className="overflow-x-auto">
          <table className="min-w-[980px] w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-2 text-left font-medium">Team Member</th>
                <th className="px-4 py-2 text-left font-medium">Role</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Submitted</th>
                <th className="px-4 py-2 text-left font-medium">Draft</th>
                <th className="px-4 py-2 text-left font-medium">Completion</th>
                <th className="px-4 py-2 text-left font-medium">Last Log</th>
                <th className="px-4 py-2 text-right font-medium">Profile</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                    No team members found for this filter.
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
                      href={`${ROUTES.AGENTS}/${row.user_id}`}
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
