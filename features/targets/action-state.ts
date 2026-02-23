export type UpsertDailyDepartmentTargetState = {
  status: 'idle' | 'success' | 'error'
  message: string
  value: number | null
}

export const INITIAL_UPSERT_DAILY_TARGET_STATE: UpsertDailyDepartmentTargetState = {
  status: 'idle',
  message: '',
  value: null,
}
