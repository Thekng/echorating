import { DashboardFilters } from '@/components/dashboard/dashboard-filters'
import { DashboardInteractive } from '@/components/dashboard/dashboard-interactive'
import { getDashboardData } from '@/features/dashboard/queries'
import Link from 'next/link'

type DashboardPageProps = {
  searchParams: Promise<{
    departmentId?: string
    userId?: string
    period?: 'today' | 'current_week' | 'this_month' | 'custom' | 'last_7_days' | 'last_30_days' | 'last_90_days'
    startDate?: string
    endDate?: string
  }>
}

import { Suspense } from 'react'

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2.5 overflow-x-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[180px] shrink-0 rounded-lg border bg-card p-3">
            <div className="mb-2 flex justify-between">
              <div className="h-4 w-4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-10 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="mt-2 h-7 w-20 rounded bg-muted animate-pulse" />
            <div className="mt-1.5 h-3 w-24 rounded bg-muted/60 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="h-[210px] w-full rounded-xl border bg-card/50 animate-pulse" />
    </div>
  )
}

async function DashboardContent({
  departmentId,
  userId,
  period,
  startDate,
  endDate,
}: {
  departmentId?: string
  userId?: string
  period?: 'today' | 'current_week' | 'this_month' | 'custom' | 'last_7_days' | 'last_30_days' | 'last_90_days'
  startDate?: string
  endDate?: string
}) {
  const result = await getDashboardData({
    departmentId,
    userId,
    period,
    startDate,
    endDate,
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
    agents,
    selectedUserId,
    period: resolvedPeriod,
    startDate: resolvedStartDate,
    endDate: resolvedEndDate,
    windowDays,
    elapsedDays,
    paceTotalUnits,
    paceElapsedUnits,
    paceUnitLabel,
    kpis,
    primaryMetric,
    metricTrends,
  } = result.data

  if (departments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No team available for your profile. Ask a manager to assign you to one.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <DashboardFilters
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        agents={agents}
        selectedUserId={selectedUserId}
        period={resolvedPeriod}
        startDate={resolvedStartDate}
        endDate={resolvedEndDate}
      />

      {kpis.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No active stats found for this team. Configure stats in Settings first.
        </div>
      ) : (
        <DashboardInteractive
          kpis={kpis}
          metricTrends={metricTrends}
          primaryMetricId={primaryMetric?.metric_id ?? null}
          period={resolvedPeriod}
          windowDays={windowDays}
          elapsedDays={elapsedDays}
          paceTotalUnits={paceTotalUnits}
          paceElapsedUnits={paceElapsedUnits}
          paceUnitLabel={paceUnitLabel}
        />
      )}
    </div>
  )
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Dashboard</h1>
          <p className="text-xs text-muted-foreground md:text-sm">Performance overview by team and period.</p>
        </div>
        <Link
          href="/daily-log"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Add Daily Log
        </Link>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent
          departmentId={params.departmentId}
          userId={params.userId}
          period={params.period}
          startDate={params.startDate}
          endDate={params.endDate}
        />
      </Suspense>
    </div>
  )
}
