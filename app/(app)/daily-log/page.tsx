import { DailyLogForm } from '@/components/daily-log/daily-log-form'
import { DailyLogFilters } from '@/components/daily-log/daily-log-filters'
import { HistoryColumnsConfig } from '@/components/daily-log/history-columns-config'
import { RecentLogsTable } from '@/components/daily-log/recent-logs-table'
import { getDailyLogFormData } from '@/features/daily-log/queries'

type DailyLogPageProps = {
  searchParams: Promise<{
    date?: string
    departmentId?: string
    userId?: string
  }>
}

export default async function DailyLogPage({ searchParams }: DailyLogPageProps) {
  const params = await searchParams
  const result = await getDailyLogFormData({
    date: params.date,
    departmentId: params.departmentId,
    userId: params.userId,
  })

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {result.error}
      </div>
    )
  }

  const {
    date,
    departments,
    selectedDepartmentId,
    selectedUserId,
    agentOptions,
    metrics,
    values,
    notes,
    existingEntry,
    keyMetrics,
    keyMetricsConfig,
    keyMetricCandidates,
    recentLogs,
    viewerRole,
  } = result.data

  const canManage = viewerRole === 'owner' || viewerRole === 'manager'
  const showDepartmentFilter = canManage || departments.length > 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Log</h1>
        <p className="text-sm text-muted-foreground">Manage performance with consistent daily inputs.</p>
      </div>

      {departments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No team available for your profile. Ask a manager to assign you to one.
        </div>
      ) : (
        <section className="space-y-5 rounded-2xl border bg-card p-6">
          <DailyLogFilters
            canManage={canManage}
            showDepartmentFilter={showDepartmentFilter}
            departments={departments}
            selectedDepartmentId={selectedDepartmentId}
            agentOptions={agentOptions}
            selectedUserId={selectedUserId}
            date={date}
          />

          {canManage && agentOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No active team members in this team yet.
            </div>
          ) : null}

          <DailyLogForm
            date={date}
            departmentId={selectedDepartmentId}
            userId={selectedUserId}
            metrics={metrics}
            initialValues={values}
            initialNotes={notes}
            existingEntry={existingEntry}
          />
        </section>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Recent Logs</h2>
        </div>

        <RecentLogsTable
          departmentId={selectedDepartmentId}
          logs={recentLogs}
          keyMetrics={keyMetrics}
          canDelete={true}
        />
      </section>

      {canManage ? (
        <details className="rounded-lg border bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">History columns (advanced)</summary>
          <div className="mt-3">
            <HistoryColumnsConfig
              departmentId={selectedDepartmentId}
              candidates={keyMetricCandidates}
              config={keyMetricsConfig}
            />
          </div>
        </details>
      ) : null}
    </div>
  )
}
