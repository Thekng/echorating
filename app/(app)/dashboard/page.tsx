import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { DashboardInteractive } from '@/components/dashboard/dashboard-interactive'
import { getDashboardData } from '@/features/dashboard/queries'

type DashboardPageProps = {
  searchParams: Promise<{
    departmentId?: string
    period?: 'today' | 'current_week' | 'this_month' | 'custom' | 'last_7_days' | 'last_30_days' | 'last_90_days'
    startDate?: string
    endDate?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams

  const result = await getDashboardData({
    departmentId: params.departmentId,
    period: params.period,
    startDate: params.startDate,
    endDate: params.endDate,
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
    selectedDepartmentId,
    period,
    startDate,
    endDate,
    windowDays,
    kpis,
    primaryMetric,
    metricTrends,
  } =
    result.data

  if (departments.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Performance overview by department and period.</p>
        </div>
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No department available for your profile. Ask a manager to assign you to one.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
        <p className="text-xs text-muted-foreground md:text-sm">Performance overview by department and period.</p>
      </div>

      <DashboardFilters
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        period={period}
        startDate={startDate}
        endDate={endDate}
      />

      {kpis.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No active metrics found for this department. Configure metrics in Settings first.
        </div>
      ) : (
        <DashboardInteractive
          kpis={kpis}
          metricTrends={metricTrends}
          primaryMetricId={primaryMetric?.metric_id ?? null}
          period={period}
          windowDays={windowDays}
        />
      )}
    </div>
  )
}
