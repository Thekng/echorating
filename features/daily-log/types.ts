import { type MetricDataType, type MetricSettings } from '@/lib/metrics/data-types'

export type DailyLogMetricDataType = MetricDataType

export type DailyLogMetric = {
  id: string
  name: string
  code: string
  data_type: DailyLogMetricDataType
  unit: string
  settings: MetricSettings | null
  description: string | null
}

export type DailyLogEntryStatus = 'draft' | 'submitted'

export type DailyLogExistingEntry = {
  id: string
  status: DailyLogEntryStatus
  updated_at: string
  submitted_at: string | null
  notes: string | null
} | null

export type DailyLogAgentOption = {
  user_id: string
  name: string
  role: 'owner' | 'admin' | 'manager' | 'member'
}

export type DailyLogKeyMetricSlot = {
  slot: 1 | 2 | 3
  metric_id: string | null
}

export type DailyLogKeyMetric = {
  slot: 1 | 2 | 3
  id: string
  name: string
  code: string
  data_type: DailyLogMetricDataType
  unit: string
  settings: MetricSettings | null
}

export type DailyLogRecentMetricValue = {
  metric_id: string
  value_number: number | null
  value_text: string | null
  value_boolean: boolean | null
}

export type DailyLogRecentEntry = {
  id: string
  user_id: string
  user_name: string
  department_id: string
  report_date: string
  status: DailyLogEntryStatus
  notes: string | null
  updated_at: string
  key_metric_values: DailyLogRecentMetricValue[]
}

export type DailyLogActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
  intent: 'draft' | 'submit' | null
  entryStatus: DailyLogEntryStatus | null
  savedAt: string | null
  entryId: string | null
}

export const INITIAL_DAILY_LOG_ACTION_STATE: DailyLogActionState = {
  status: 'idle',
  message: '',
  intent: null,
  entryStatus: null,
  savedAt: null,
  entryId: null,
}

export type DailyLogKeyMetricsActionState = {
  status: 'idle' | 'success' | 'error'
  message: string
}

export const INITIAL_DAILY_LOG_KEY_METRICS_STATE: DailyLogKeyMetricsActionState = {
  status: 'idle',
  message: '',
}
