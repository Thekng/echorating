import { getActorContext } from '@/lib/supabase/actor-context'
import { requireRole } from '@/lib/rbac/guards'
import { formatDatabaseError } from '@/lib/supabase/error-messages'
import { formatMetricNumber } from '@/lib/metrics/format'
import { normalizeMetricSettings, booleanLabels, type MetricDataType } from '@/lib/metrics/data-types'

function escapeCsv(value: string) {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCsvValue(
  dataType: MetricDataType,
  settings: unknown,
  unit: string | null,
  row: { value_number: number | null; value_text: string | null; value_boolean: boolean | null },
) {
  const normalizedSettings = normalizeMetricSettings(dataType, settings)

  if (dataType === 'boolean') {
    if (row.value_boolean === null) return ''
    const labels = booleanLabels(normalizedSettings)
    return row.value_boolean ? labels.trueLabel : labels.falseLabel
  }

  if (dataType === 'text' || dataType === 'datetime' || dataType === 'selection' || dataType === 'file') {
    return row.value_text ?? ''
  }

  if (row.value_number === null) return ''

  return formatMetricNumber(row.value_number, {
    dataType,
    unit,
    settings,
  })
}

export async function GET(req: Request) {
  try {
    const context = await getActorContext()
    if (!context.ok) {
      return new Response(JSON.stringify({ error: context.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    try {
      requireRole(context.role, 'manager')
    } catch {
      return new Response(JSON.stringify({ error: 'Insufficient permissions.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url = new URL(req.url)
    const departmentId = url.searchParams.get('departmentId')
    const startDate = url.searchParams.get('startDate')
    const endDate = url.searchParams.get('endDate')

    if (!departmentId) {
      return new Response(JSON.stringify({ error: 'departmentId is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Fetch metrics for this department
    const { data: metricsData, error: metricsError } = await context.admin
      .from('metrics')
      .select('id, name, data_type, unit, settings')
      .eq('organization_id', context.organizationId)
      .eq('department_id', departmentId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })

    if (metricsError) {
      return new Response(JSON.stringify({ error: formatDatabaseError(metricsError.message) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const metrics = (metricsData ?? []) as Array<{
      id: string
      name: string
      data_type: MetricDataType
      unit: string | null
      settings: unknown
    }>

    // Fetch daily reports
    let reportsQuery = context.admin
      .from('daily_reports')
      .select('id, user_id, report_date, status, notes')
      .eq('organization_id', context.organizationId)
      .eq('department_id', departmentId)
      .order('report_date', { ascending: true })

    if (startDate) {
      reportsQuery = reportsQuery.gte('report_date', startDate)
    }
    if (endDate) {
      reportsQuery = reportsQuery.lte('report_date', endDate)
    }

    const { data: reportsData, error: reportsError } = await reportsQuery

    if (reportsError) {
      return new Response(JSON.stringify({ error: formatDatabaseError(reportsError.message) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const reports = (reportsData ?? []) as Array<{
      id: string
      user_id: string
      report_date: string
      status: string
      notes: string | null
    }>

    if (reports.length === 0) {
      const headerRow = ['Date', 'Agent', ...metrics.map((m) => m.name), 'Notes', 'Status']
      const csv = headerRow.map(escapeCsv).join(',') + '\n'
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="daily-logs-export.csv"',
        },
      })
    }

    // Fetch profiles + values in parallel
    const reportIds = reports.map((r) => r.id)
    const userIds = Array.from(new Set(reports.map((r) => r.user_id)))
    const metricIds = metrics.map((m) => m.id)

    const [profilesResult, valuesResult] = await Promise.all([
      context.admin
        .from('organization_members')
        .select('user_id, profiles!inner(full_name)')
        .eq('organization_id', context.organizationId)
        .in('user_id', userIds),
      metricIds.length > 0
        ? context.admin
            .from('daily_report_values')
            .select('daily_report_id, metric_id, value_number, value_text, value_boolean')
            .in('daily_report_id', reportIds)
            .in('metric_id', metricIds)
        : Promise.resolve({ data: [], error: null }),
    ])

    const nameByUserId = new Map(
      ((profilesResult.data ?? []) as Array<{
        user_id: string
        profiles: { full_name?: string | null } | Array<{ full_name?: string | null }> | null
      }>).map((p) => {
        const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles
        return [p.user_id, profile?.full_name ?? 'Unknown'] as const
      }),
    )

    // Index values by report_id -> metric_id
    const valuesIndex = new Map<string, Map<string, { value_number: number | null; value_text: string | null; value_boolean: boolean | null }>>()
    for (const row of (valuesResult.data ?? []) as Array<{
      daily_report_id: string
      metric_id: string
      value_number: number | null
      value_text: string | null
      value_boolean: boolean | null
    }>) {
      let reportMap = valuesIndex.get(row.daily_report_id)
      if (!reportMap) {
        reportMap = new Map()
        valuesIndex.set(row.daily_report_id, reportMap)
      }
      reportMap.set(row.metric_id, {
        value_number: row.value_number,
        value_text: row.value_text,
        value_boolean: row.value_boolean,
      })
    }

    // Build CSV
    const headerRow = ['Date', 'Agent', ...metrics.map((m) => m.name), 'Notes', 'Status']
    const lines: string[] = [headerRow.map(escapeCsv).join(',')]

    for (const report of reports) {
      const reportValues = valuesIndex.get(report.id)
      const cells = [
        report.report_date,
        nameByUserId.get(report.user_id) ?? 'Unknown',
        ...metrics.map((metric) => {
          const val = reportValues?.get(metric.id)
          if (!val) return ''
          return formatCsvValue(metric.data_type, metric.settings, metric.unit, val)
        }),
        report.notes?.replace(/\n/g, ' ') ?? '',
        report.status,
      ]
      lines.push(cells.map(escapeCsv).join(','))
    }

    const csv = lines.join('\n') + '\n'

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="daily-logs-export.csv"',
      },
    })
  } catch (error: unknown) {
    console.error('[API_ERROR] /api/export/daily-logs:', error instanceof Error ? error.message : error)
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
