import { DailyLogForm } from '@/components/daily-log/daily-log-form'
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

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Daily Log</h1>
        <p className="text-sm text-muted-foreground">Record department performance and review recent entries.</p>
      </div>

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div>
          <label htmlFor="daily-log-department" className="mb-1 block text-sm font-medium">
            Department
          </label>
          <select
            id="daily-log-department"
            name="departmentId"
            defaultValue={selectedDepartmentId}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            disabled={departments.length === 0}
          >
            {departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        {canManage ? (
          <div>
            <label htmlFor="daily-log-user" className="mb-1 block text-sm font-medium">
              Agent
            </label>
            <select
              id="daily-log-user"
              name="userId"
              defaultValue={selectedUserId}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={agentOptions.length === 0}
            >
              {agentOptions.map((agent) => (
                <option key={agent.user_id} value={agent.user_id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div>
          <label htmlFor="daily-log-date" className="mb-1 block text-sm font-medium">
            Date
          </label>
          <input
            id="daily-log-date"
            name="date"
            type="date"
            defaultValue={date}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-muted/40"
          >
            Load
          </button>
        </div>
      </form>

      {departments.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          No department available for your profile. Ask a manager to assign you to one.
        </div>
      ) : (
        <>
          {canManage && agentOptions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No active agents in this department yet.
            </div>
          ) : null}

          {canManage ? (
            <HistoryColumnsConfig
              departmentId={selectedDepartmentId}
              candidates={keyMetricCandidates}
              config={keyMetricsConfig}
            />
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

          <section className="space-y-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Recent Logs</h2>
              <p className="text-sm text-muted-foreground">Latest entries for current department and filter.</p>
            </div>

            <RecentLogsTable
              departmentId={selectedDepartmentId}
              logs={recentLogs}
              keyMetrics={keyMetrics}
              canDelete={true}
            />
          </section>
        </>
      )}
    </div>
  )
}
