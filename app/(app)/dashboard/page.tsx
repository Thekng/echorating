import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { getDashboardData } from '@/features/dashboard/queries'
import { DashboardView } from '@/components/dashboard/dashboard-view'

type DashboardPageProps = {
  searchParams: Promise<{
    departmentId?: string
    userId?: string
    period?: string
    startDate?: string
    endDate?: string
    metricId?: string
  }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const params = await searchParams

  const result = await getDashboardData({
    departmentId: params.departmentId,
    userId: params.userId,
    period: params.period as Parameters<typeof getDashboardData>[0] extends infer T
      ? T extends { period?: infer P } ? P : never
      : never,
    startDate: params.startDate,
    endDate: params.endDate,
    metricId: params.metricId,
  })

  if (!result.success || !result.data) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Performance overview</p>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {result.error ?? 'Failed to load dashboard data.'}
        </div>
      </div>
    )
  }

  return <DashboardView data={result.data} selectedMetricId={params.metricId} />
}
