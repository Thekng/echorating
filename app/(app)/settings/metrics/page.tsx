import { CreateMetricModal } from '@/components/metrics/create-metric-modal'
import { EditMetricModal } from '@/components/metrics/edit-metric-modal'
import { deleteMetricAction, toggleMetricStatusAction } from '@/features/metrics/actions'
import { listMetrics } from '@/features/metrics/queries'
import { upsertDailyDepartmentTargetAction } from '@/features/targets/actions'
import { SettingsPageHeader } from '@/components/settings/settings-page-header'
import { Eraser, Filter, Power, Save, Trash2 } from 'lucide-react'

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
}

export default async function MetricsSettingsPage({ searchParams }: MetricsPageProps) {
  const params = await searchParams
  const result = await listMetrics({
    q: params.q,
    departmentId: params.departmentId,
    mode: params.mode,
    status: 'all',
  })

  if (!result.success || !result.data) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {result.error}
      </div>
    )
  }

  const { metrics, departments, dependencyMetrics } = result.data
  const selectedDepartmentId =
    departments.find((department) => department.department_id === params.departmentId)?.department_id ??
    departments[0]?.department_id ??
    ''

  const scopedMetrics = selectedDepartmentId
    ? metrics.filter((metric) => metric.department_id === selectedDepartmentId)
    : metrics
  const enabledMetrics = scopedMetrics.filter((metric) => metric.is_active)
  const availableMetrics = scopedMetrics.filter((metric) => !metric.is_active)
  const selectedDepartmentName =
    departments.find((department) => department.department_id === selectedDepartmentId)?.name ?? 'All departments'

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Metrics Studio"
        description="Enable KPIs, set daily targets and manage calculated formulas."
        actions={<CreateMetricModal departments={departments} dependencyMetrics={dependencyMetrics} />}
      />

      <form className="grid gap-3 rounded-lg border bg-card p-4 md:grid-cols-4">
        <div>
          <label htmlFor="departmentId" className="mb-1 block text-sm font-medium">
            Department
          </label>
          <select
            id="departmentId"
            name="departmentId"
            defaultValue={selectedDepartmentId || 'all'}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {departments.length === 0 ? <option value="all">No department</option> : null}
            {departments.map((department) => (
              <option key={department.department_id} value={department.department_id}>
                {department.name}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="q" className="mb-1 block text-sm font-medium">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={params.q ?? ''}
            placeholder="Metric name, code or description"
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </div>

        <div>
          <label htmlFor="mode" className="mb-1 block text-sm font-medium">
            Mode
          </label>
          <select
            id="mode"
            name="mode"
            defaultValue={params.mode ?? 'all'}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All</option>
            <option value="manual">Manual</option>
            <option value="calculated">Calculated</option>
          </select>
        </div>

        <div className="md:col-span-4 flex items-center justify-end">
          <button
            type="submit"
            title="Apply filters"
            aria-label="Apply filters"
            className="inline-flex size-9 items-center justify-center rounded-md border border-input hover:bg-muted/40"
          >
            <Filter className="size-4" />
          </button>
        </div>
      </form>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Enabled KPIs ({enabledMetrics.length})</h2>
          <p className="text-xs text-muted-foreground">{selectedDepartmentName}</p>
        </div>

        {enabledMetrics.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No enabled KPI for this department.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <div className="min-w-[1120px]">
              <div className="grid grid-cols-[minmax(240px,2fr)_140px_120px_150px_minmax(180px,2fr)_240px_180px] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>KPI</span>
                <span>Code</span>
                <span>Mode</span>
                <span>Type / Unit</span>
                <span>Formula</span>
                <span>Daily Target</span>
                <span className="text-right">Actions</span>
              </div>

              {enabledMetrics.map((metric) => (
                <div
                  key={metric.metric_id}
                  className="grid grid-cols-[minmax(240px,2fr)_140px_120px_150px_minmax(180px,2fr)_240px_180px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{metric.name}</p>
                    {metric.description ? (
                      <p className="truncate text-xs text-muted-foreground">{metric.description}</p>
                    ) : null}
                  </div>

                  <span className="truncate font-mono text-xs text-muted-foreground">{metric.code}</span>

                  <span className="text-xs text-muted-foreground">
                    {MODE_LABELS[metric.input_mode] ?? metric.input_mode}
                  </span>

                  <span className="text-xs text-muted-foreground">
                    {DATA_TYPE_LABELS[metric.data_type] ?? metric.data_type} / {metric.unit}
                  </span>

                  <span className="truncate font-mono text-xs text-muted-foreground">
                    {metric.input_mode === 'calculated' ? metric.formula_expression ?? '(no formula)' : '-'}
                  </span>

                  <div className="flex items-center gap-2">
                    <form action={upsertDailyDepartmentTargetAction} className="flex items-center gap-2">
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <input type="hidden" name="departmentId" value={metric.department_id} />
                      <input
                        name="value"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={metric.daily_target_value ?? ''}
                        placeholder="target"
                        className="h-8 w-24 rounded-md border border-input bg-background px-2 text-xs"
                      />
                      <button
                        type="submit"
                        title={`Save target for ${metric.name}`}
                        aria-label={`Save target for ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-muted/40"
                      >
                        <Save className="size-3.5" />
                      </button>
                    </form>

                    <form action={upsertDailyDepartmentTargetAction}>
                      <input type="hidden" name="metricId" value={metric.metric_id} />
                      <input type="hidden" name="departmentId" value={metric.department_id} />
                      <input type="hidden" name="value" value="" />
                      <button
                        type="submit"
                        title={`Clear target for ${metric.name}`}
                        aria-label={`Clear target for ${metric.name}`}
                        className="inline-flex size-8 items-center justify-center rounded-md border border-input text-muted-foreground hover:bg-muted/40"
                      >
                        <Eraser className="size-3.5" />
                      </button>
                    </form>
                  </div>

                  <div className="flex items-center justify-end gap-2">
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
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-semibold">Available to Add ({availableMetrics.length})</h2>
        {availableMetrics.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No inactive KPI available in this department.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <div className="min-w-[820px]">
              <div className="grid grid-cols-[minmax(260px,2fr)_170px_150px_180px] gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span>KPI</span>
                <span>Code</span>
                <span>Type / Unit</span>
                <span className="text-right">Action</span>
              </div>

              {availableMetrics.map((metric) => (
                <div
                  key={metric.metric_id}
                  className="grid grid-cols-[minmax(260px,2fr)_170px_150px_180px] items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="truncate font-medium">{metric.name}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{metric.code}</span>
                  <span className="text-xs text-muted-foreground">
                    {DATA_TYPE_LABELS[metric.data_type] ?? metric.data_type} / {metric.unit}
                  </span>
                  <div className="flex justify-end gap-2">
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
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
