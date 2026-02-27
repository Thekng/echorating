'use client'

import { useEffect, useState, useTransition } from 'react'
import { listMetrics } from '@/features/metrics/queries'
import { deleteMetricAction, reorderMetricAction, toggleMetricStatusAction } from '@/features/metrics/actions'
import { SettingsHeader } from '@/components/settings/settings-header'
import { SettingsSurface } from '@/components/settings/settings-surface'
import { SettingsEmptyState } from '@/components/settings/settings-empty-state'
import { SettingsError } from '@/components/settings/settings-error'
import { CreateMetricModal } from '@/components/metrics/create-metric-modal'
import { EditMetricModal } from '@/components/metrics/edit-metric-modal'
import { Button } from '@/components/ui/button'
import { areMetricFiltersEqual } from '@/features/settings/helpers'
import { ArrowDown, ArrowUp, Gauge, Power, Trash2 } from 'lucide-react'

type MetricSettings = Record<string, unknown> | null

type MetricListItem = {
  metric_id: string
  department_id: string
  department_name: string
  name: string
  code: string
  description: string | null
  data_type: 'number' | 'currency' | 'percent' | 'boolean' | 'duration' | 'text' | 'datetime' | 'selection' | 'file'
  unit: string
  settings: MetricSettings
  input_mode: 'manual' | 'calculated'
  sort_order: number | null
  is_active: boolean
  formula_expression: string | null
  created_at: string
  updated_at: string
}

type DepartmentOption = {
  department_id: string
  name: string
}

type DependencyMetric = {
  metric_id: string
  name: string
  code: string
  department_id: string
  department_name: string
  data_type: MetricListItem['data_type']
}

type MetricFilters = {
  q: string
  departmentId: string
  mode: string
  status: 'all' | 'active' | 'inactive'
}

type Feedback = {
  tone: 'success' | 'error'
  message: string
}

const DATA_TYPE_LABELS: Record<MetricListItem['data_type'], string> = {
  number: 'Number',
  currency: 'Currency',
  percent: 'Percent',
  boolean: 'Yes / No',
  duration: 'Duration',
  text: 'Text',
  datetime: 'Date & Time',
  selection: 'Selection',
  file: 'File',
}

const INITIAL_FILTERS: MetricFilters = {
  q: '',
  departmentId: 'all',
  mode: 'all',
  status: 'active',
}

export default function MetricsSettingsPage() {
  const [metrics, setMetrics] = useState<MetricListItem[]>([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [dependencyMetrics, setDependencyMetrics] = useState<DependencyMetric[]>([])

  const [queryFilters, setQueryFilters] = useState<MetricFilters>(INITIAL_FILTERS)
  const [formFilters, setFormFilters] = useState<MetricFilters>(INITIAL_FILTERS)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const [pendingAction, setPendingAction] = useState<{
    metricId: string
    type: 'toggle' | 'delete' | 'move-up' | 'move-down'
  } | null>(null)
  const [isMutating, startMutationTransition] = useTransition()

  async function fetchMetrics(filters: MetricFilters) {
    setLoading(true)
    setError(null)

    try {
      const result = await listMetrics({
        q: filters.q || undefined,
        departmentId: filters.departmentId,
        mode: filters.mode,
        status: filters.status,
      })

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to load metrics.')
        return
      }

      const nextFilters: MetricFilters = {
        q: result.data.filters.q ?? '',
        departmentId: result.data.filters.departmentId,
        mode: result.data.filters.mode,
        status: result.data.filters.status,
      }

      setMetrics((result.data.metrics ?? []) as MetricListItem[])
      setDepartments((result.data.departments ?? []) as DepartmentOption[])
      setDependencyMetrics((result.data.dependencyMetrics ?? []) as DependencyMetric[])

      if (!areMetricFiltersEqual(nextFilters, queryFilters)) {
        setQueryFilters(nextFilters)
        setFormFilters(nextFilters)
      }
    } catch {
      setError('An unexpected error occurred while loading metrics.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics(queryFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryFilters.departmentId, queryFilters.mode, queryFilters.q, queryFilters.status])

  function refreshMetrics() {
    void fetchMetrics(queryFilters)
  }

  function handleMetricSaved(message: string) {
    setFeedback({ tone: 'success', message })
    refreshMetrics()
  }

  function handleToggleMetric(metric: MetricListItem) {
    setPendingAction({ metricId: metric.metric_id, type: 'toggle' })

    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('metricId', metric.metric_id)
      formData.set('nextStatus', metric.is_active ? 'inactive' : 'active')

      const result = await toggleMetricStatusAction(formData)

      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMetrics(queryFilters)
      }

      setPendingAction(null)
    })
  }

  function handleDeleteMetric(metric: MetricListItem) {
    const confirmed = window.confirm(
      `Delete "${metric.name}"? This will disable targets and remove it from active metric lists.`,
    )
    if (!confirmed) {
      return
    }

    setPendingAction({ metricId: metric.metric_id, type: 'delete' })

    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('metricId', metric.metric_id)

      const result = await deleteMetricAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMetrics(queryFilters)
      }

      setPendingAction(null)
    })
  }

  function handleReorderMetric(metric: MetricListItem, direction: 'up' | 'down') {
    setPendingAction({ metricId: metric.metric_id, type: direction === 'up' ? 'move-up' : 'move-down' })

    startMutationTransition(async () => {
      const formData = new FormData()
      formData.set('metricId', metric.metric_id)
      formData.set('direction', direction)

      const result = await reorderMetricAction(formData)
      setFeedback({
        tone: result.status === 'success' ? 'success' : 'error',
        message: result.message,
      })

      if (result.status === 'success') {
        await fetchMetrics(queryFilters)
      }

      setPendingAction(null)
    })
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Metrics" description="Loading metrics..." />
        <SettingsSurface>
          <p className="text-sm text-muted-foreground">Loading metrics...</p>
        </SettingsSurface>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <SettingsHeader title="Metrics" description="Define and manage KPIs with formulas and data types." />
        <SettingsError error={error} />
        <div>
          <Button type="button" variant="outline" onClick={() => fetchMetrics(queryFilters)}>
            Retry
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <SettingsHeader
        title="Metrics"
        description="Define and manage KPIs with formulas, data types, and activation status."
        actions={
          <CreateMetricModal
            departments={departments}
            dependencyMetrics={dependencyMetrics}
            onSaved={handleMetricSaved}
          />
        }
      />

      {feedback ? (
        <SettingsSurface
          className={
            feedback.tone === 'success'
              ? 'border-green-300 bg-green-50 text-green-900'
              : 'border-red-300 bg-red-50 text-red-900'
          }
        >
          <p className="text-sm">{feedback.message}</p>
        </SettingsSurface>
      ) : null}

      <SettingsSurface>
        {queryFilters.departmentId === 'all' ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Select a specific department to reorder metrics.
          </p>
        ) : null}
        <form
          className="grid gap-3 md:grid-cols-5"
          onSubmit={(event) => {
            event.preventDefault()
            setQueryFilters(formFilters)
          }}
        >
          <div className="md:col-span-2">
            <label htmlFor="metric-filter-q" className="mb-1 block text-sm font-medium">
              Search
            </label>
            <input
              id="metric-filter-q"
              value={formFilters.q}
              onChange={(event) => setFormFilters((current) => ({ ...current, q: event.target.value }))}
              placeholder="Metric name or code"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <div>
            <label htmlFor="metric-filter-department" className="mb-1 block text-sm font-medium">
              Department
            </label>
            <select
              id="metric-filter-department"
              value={formFilters.departmentId}
              onChange={(event) => setFormFilters((current) => ({ ...current, departmentId: event.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All departments</option>
              {departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="metric-filter-mode" className="mb-1 block text-sm font-medium">
              Mode
            </label>
            <select
              id="metric-filter-mode"
              value={formFilters.mode}
              onChange={(event) => setFormFilters((current) => ({ ...current, mode: event.target.value }))}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All</option>
              <option value="manual">Manual</option>
              <option value="calculated">Calculated</option>
            </select>
          </div>

          <div>
            <label htmlFor="metric-filter-status" className="mb-1 block text-sm font-medium">
              Status
            </label>
            <select
              id="metric-filter-status"
              value={formFilters.status}
              onChange={(event) =>
                setFormFilters((current) => ({
                  ...current,
                  status: event.target.value as MetricFilters['status'],
                }))
              }
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="md:col-span-5 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setFormFilters(INITIAL_FILTERS)}>
              Clear
            </Button>
            <Button type="submit">Apply Filters</Button>
          </div>
        </form>
      </SettingsSurface>

      {metrics.length === 0 ? (
        <SettingsSurface>
          <SettingsEmptyState
            message="No metrics found for the current filters."
            icon={<Gauge className="mb-3 size-8 text-muted-foreground" />}
          />
        </SettingsSurface>
      ) : (
        <SettingsSurface>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Metric</th>
                  <th className="px-3 py-2 font-medium">Department</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Mode</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => {
                  const rowPending = isMutating && pendingAction?.metricId === metric.metric_id
                  const togglePending = rowPending && pendingAction?.type === 'toggle'
                  const deletePending = rowPending && pendingAction?.type === 'delete'
                  const moveUpPending = rowPending && pendingAction?.type === 'move-up'
                  const moveDownPending = rowPending && pendingAction?.type === 'move-down'
                  const reorderEnabled = queryFilters.departmentId !== 'all'

                  return (
                    <tr key={metric.metric_id} className="border-b align-top">
                      <td className="px-3 py-3">
                        <p className="font-medium">{metric.name}</p>
                        <p className="text-xs text-muted-foreground">{metric.code}</p>
                        {metric.description ? (
                          <p className="mt-1 text-xs text-muted-foreground">{metric.description}</p>
                        ) : null}
                        {metric.input_mode === 'calculated' && metric.formula_expression ? (
                          <p className="mt-1 truncate text-xs font-mono text-muted-foreground">
                            {metric.formula_expression}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3">{metric.department_name}</td>
                      <td className="px-3 py-3">{DATA_TYPE_LABELS[metric.data_type]}</td>
                      <td className="px-3 py-3">{metric.input_mode === 'manual' ? 'Manual' : 'Calculated'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={
                            metric.is_active
                              ? 'inline-block rounded-md bg-green-100 px-2 py-1 text-xs font-medium text-green-700'
                              : 'inline-block rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700'
                          }
                        >
                          {metric.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={`Move ${metric.name} up`}
                            aria-label={`Move ${metric.name} up`}
                            onClick={() => handleReorderMetric(metric, 'up')}
                            disabled={!reorderEnabled || moveUpPending || index === 0}
                          >
                            <ArrowUp className="size-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={`Move ${metric.name} down`}
                            aria-label={`Move ${metric.name} down`}
                            onClick={() => handleReorderMetric(metric, 'down')}
                            disabled={!reorderEnabled || moveDownPending || index === metrics.length - 1}
                          >
                            <ArrowDown className="size-4" />
                          </Button>

                          <EditMetricModal
                            metric={metric}
                            departments={departments}
                            dependencyMetrics={dependencyMetrics}
                            onSaved={handleMetricSaved}
                          />

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            title={metric.is_active ? `Deactivate ${metric.name}` : `Activate ${metric.name}`}
                            aria-label={metric.is_active ? `Deactivate ${metric.name}` : `Activate ${metric.name}`}
                            onClick={() => handleToggleMetric(metric)}
                            disabled={togglePending}
                          >
                            <Power className="size-4" />
                          </Button>

                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                            title={`Delete ${metric.name}`}
                            aria-label={`Delete ${metric.name}`}
                            onClick={() => handleDeleteMetric(metric)}
                            disabled={deletePending}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </SettingsSurface>
      )}
    </div>
  )
}
