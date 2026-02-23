import { CreateMetricModal } from '@/components/metrics/create-metric-modal'
import { EditMetricModal } from '@/components/metrics/edit-metric-modal'
import { MetricsFilter } from '@/components/metrics/metrics-filter'
import { MetricTargetControl } from '@/components/metrics/metric-target-control'
import { deleteMetricAction, toggleMetricStatusAction } from '@/features/metrics/actions'
import { listMetrics } from '@/features/metrics/queries'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { SettingsError } from '@/components/settings/settings-error'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsChip } from '@/components/settings/settings-chip'
import { Power, Trash2 } from 'lucide-react'

type MetricsPageProps = {
  searchParams: Promise<{
    q?: string
    departmentId?: string
    mode?: string
  }>
}

const MODE_LABELS: Record<string, string> = {
  manual: 'Manual',
  calculated: 'Calculated',
}

const DATA_TYPE_LABELS: Record<string, string> = {
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  boolean: 'Boolean',
  duration: 'Duration',
  text: 'Text',
  datetime: 'Date & Time',
  selection: 'Selection',
  file: 'File',
}

const TARGET_SUPPORTED_TYPES = new Set(['number', 'currency', 'percent', 'duration'])

export default async function MetricsSettingsPage({ searchParams }: MetricsPageProps) {
  const params = await searchParams
  const result = await listMetrics({
    q: params.q,
    departmentId: params.departmentId,
    mode: params.mode,
    status: 'all',
  })

  if (!result.success || !result.data) {
    return <SettingsError error={result.error || 'Failed to load metrics'} />
  }

  const { metrics, departments, dependencyMetrics, filters } = result.data
  const selectedDepartmentId = filters.departmentId === 'all' ? '' : filters.departmentId

  const scopedMetrics = selectedDepartmentId
    ? metrics.filter((metric) => metric.department_id === selectedDepartmentId)
    : metrics
  const enabledMetrics = scopedMetrics.filter((metric) => metric.is_active)
  const availableMetrics = scopedMetrics.filter((metric) => !metric.is_active)
  const selectedDepartmentName =
    departments.find((department) => department.department_id === selectedDepartmentId)?.name ?? 'No department'

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Metrics Studio"
        description="Enable KPIs, set daily targets and manage calculated formulas."
        actions={<CreateMetricModal departments={departments} dependencyMetrics={dependencyMetrics} />}
      />

      <MetricsFilter
        departments={departments}
        selectedDepartmentId={selectedDepartmentId}
        query={filters.q}
        mode={filters.mode}
      />

      <SettingsSurface className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Enabled KPIs ({enabledMetrics.length})</h2>
          <p className="text-sm text-muted-foreground">{selectedDepartmentName}</p>
        </div>

        {enabledMetrics.length === 0 ? (
          <SettingsEmptyState message="No enabled KPI for this department." />
        ) : (
          <div className="space-y-2">
            {enabledMetrics.map((metric) => (
              <article key={metric.metric_id} className="rounded-md border bg-background p-3">
                <div className="flex flex-col">
                  <p className="font-medium">{metric.name}</p>
                </div>

                {metric.description ? (
                  <p className="mt-2 text-xs text-muted-foreground">{metric.description}</p>
                ) : null}

                {metric.input_mode === 'calculated' ? (
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {metric.formula_expression ?? '(no formula)'}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
                  {TARGET_SUPPORTED_TYPES.has(metric.data_type) ? (
                    <MetricTargetControl
                      metricId={metric.metric_id}
                      departmentId={metric.department_id}
                      metricName={metric.name}
                      metricDataType={metric.data_type}
                      metricSettings={metric.settings}
                      initialValue={metric.daily_target_value}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground">No numeric target for this data type.</p>
                  )}

                  <div className="flex items-center gap-2">
                    <EditMetricModal
                      metric={metric}
                      departments={departments}
                      dependencyMetrics={dependencyMetrics}
                    />
                    <form action={toggleMetricStatusAction}>
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <input type="hidden" name="nextStatus" value="inactive" />
                      <button
                        type="submit"
                        title={`Disable ${metric.name}`}
                        aria-label={`Disable ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                      >
                        <Power className="size-3.5" />
                      </button>
                    </form>
                    <form action={deleteMetricAction}>
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <button
                        type="submit"
                        title={`Delete ${metric.name}`}
                        aria-label={`Delete ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SettingsSurface>

      <SettingsSurface>
        <details>
          <summary className="cursor-pointer list-none text-lg font-semibold">
            Available to Add ({availableMetrics.length})
          </summary>
          <div className="mt-3 space-y-2">
            {availableMetrics.length === 0 ? (
              <SettingsEmptyState message="No inactive KPI available in this department." />
            ) : (
              availableMetrics.map((metric) => (
                <article
                  key={metric.metric_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-background p-3"
                >
                    <div className="flex flex-col">
                      <span className="font-medium">{metric.name}</span>
                    </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleMetricStatusAction}>
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <input type="hidden" name="nextStatus" value="active" />
                      <button
                        type="submit"
                        title={`Enable ${metric.name}`}
                        aria-label={`Enable ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                      >
                        <Power className="size-3.5" />
                      </button>
                    </form>
                    <form action={deleteMetricAction}>
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <button
                        type="submit"
                        title={`Delete ${metric.name}`}
                        aria-label={`Delete ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-destructive/30 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </form>
                  </div>
                </article>
              ))
            )}
          </div>
        </details>
      </SettingsSurface>
    </div>
  )
}
