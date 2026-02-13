export type DailyLogMetricDataType = 'number' | 'currency' | 'percent' | 'boolean' | 'duration'

export type DailyLogMetric = {
  metric_id: string
  name: string
  code: string
  data_type: DailyLogMetricDataType
  unit: string
  description: string | null
}

export type DailyLogEntryStatus = 'draft' | 'submitted'

export type DailyLogExistingEntry = {
  entry_id: string
  status: DailyLogEntryStatus
  updated_at: string
  submitted_at: string | null
  notes: string | null
} | null

export type DailyLogAgentOption = {
  user_id: string
  name: string
  role: 'owner' | 'manager' | 'member'
}

export type DailyLogKeyMetricSlot = {
  slot: 1 | 2 | 3
  metric_id: string | null
}

export type DailyLogKeyMetric = {
  slot: 1 | 2 | 3
  metric_id: string
  name: string
  code: string
  data_type: DailyLogMetricDataType
  unit: string
}

export type DailyLogRecentMetricValue = {
  metric_id: string
  value_numeric: number | null
  value_bool: boolean | null
}

export type DailyLogRecentEntry = {
  entry_id: string
  user_id: string
  user_name: string
  department_id: string
  entry_date: string
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
