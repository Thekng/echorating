export const METRIC_DATA_TYPES = [
  'number',
  'currency',
  'percent',
  'boolean',
  'duration',
  'text',
  'datetime',
  'selection',
  'file',
] as const

export type MetricDataType = (typeof METRIC_DATA_TYPES)[number]

export const BOOLEAN_PRESETS = [
  'yes_no',
  'true_false',
  'active_inactive',
  'qualified_not_qualified',
  'completed_not_completed',
] as const

export type BooleanPreset = (typeof BOOLEAN_PRESETS)[number]

export const DURATION_FORMATS = ['hh_mm_ss', 'minutes', 'hours', 'days'] as const
export type DurationFormat = (typeof DURATION_FORMATS)[number]

export const NUMBER_KINDS = ['integer', 'decimal'] as const
export type NumberKind = (typeof NUMBER_KINDS)[number]

export const TEXT_FORMATS = ['short_text', 'long_text', 'email', 'phone', 'url'] as const
export type TextFormat = (typeof TEXT_FORMATS)[number]

export const DATETIME_FORMATS = ['date', 'datetime', 'time'] as const
export type DatetimeFormat = (typeof DATETIME_FORMATS)[number]

export const SELECTION_MODES = ['single', 'multi', 'radio'] as const
export type SelectionMode = (typeof SELECTION_MODES)[number]

export const FILE_KINDS = ['file', 'image'] as const
export type FileKind = (typeof FILE_KINDS)[number]

export type MetricSettings = {
  numberKind?: NumberKind
  currencyCode?: string
  booleanPreset?: BooleanPreset
  durationFormat?: DurationFormat
  textFormat?: TextFormat
  datetimeFormat?: DatetimeFormat
  selectionMode?: SelectionMode
  selectionOptions?: string[]
  fileKind?: FileKind
}

const BOOLEAN_PRESET_LABELS: Record<BooleanPreset, { trueLabel: string; falseLabel: string }> = {
  yes_no: { trueLabel: 'Yes', falseLabel: 'No' },
  true_false: { trueLabel: 'True', falseLabel: 'False' },
  active_inactive: { trueLabel: 'Active', falseLabel: 'Inactive' },
  qualified_not_qualified: { trueLabel: 'Qualified', falseLabel: 'Not Qualified' },
  completed_not_completed: { trueLabel: 'Completed', falseLabel: 'Not Completed' },
}

function asRecord(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {} as Record<string, unknown>
  }
  return value as Record<string, unknown>
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export function parseSelectionOptions(raw: string) {
  return Array.from(
    new Set(
      raw
        .split('\n')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  )
}

export function normalizeMetricSettings(dataType: MetricDataType, raw: unknown): MetricSettings {
  const value = asRecord(raw)

  if (dataType === 'number') {
    const numberKind = text(value.numberKind)
    return {
      numberKind: NUMBER_KINDS.includes(numberKind as NumberKind) ? (numberKind as NumberKind) : 'integer',
    }
  }

  if (dataType === 'currency') {
    const currencyCode = text(value.currencyCode).toUpperCase()
    return {
      currencyCode: currencyCode || 'USD',
    }
  }

  if (dataType === 'boolean') {
    const preset = text(value.booleanPreset)
    return {
      booleanPreset: BOOLEAN_PRESETS.includes(preset as BooleanPreset)
        ? (preset as BooleanPreset)
        : 'yes_no',
    }
  }

  if (dataType === 'duration') {
    const durationFormat = text(value.durationFormat)
    return {
      durationFormat: DURATION_FORMATS.includes(durationFormat as DurationFormat)
        ? (durationFormat as DurationFormat)
        : 'hh_mm_ss',
    }
  }

  if (dataType === 'text') {
    const textFormat = text(value.textFormat)
    return {
      textFormat: TEXT_FORMATS.includes(textFormat as TextFormat) ? (textFormat as TextFormat) : 'short_text',
    }
  }

  if (dataType === 'datetime') {
    const datetimeFormat = text(value.datetimeFormat)
    return {
      datetimeFormat: DATETIME_FORMATS.includes(datetimeFormat as DatetimeFormat)
        ? (datetimeFormat as DatetimeFormat)
        : 'date',
    }
  }

  if (dataType === 'selection') {
    const selectionMode = text(value.selectionMode)
    const selectionOptions = Array.isArray(value.selectionOptions)
      ? value.selectionOptions.map((item) => text(item)).filter(Boolean)
      : []

    return {
      selectionMode: SELECTION_MODES.includes(selectionMode as SelectionMode)
        ? (selectionMode as SelectionMode)
        : 'single',
      selectionOptions: Array.from(new Set(selectionOptions)),
    }
  }

  if (dataType === 'file') {
    const fileKind = text(value.fileKind)
    return {
      fileKind: FILE_KINDS.includes(fileKind as FileKind) ? (fileKind as FileKind) : 'file',
    }
  }

  return {}
}

export function booleanLabels(settings: MetricSettings) {
  const preset = settings.booleanPreset ?? 'yes_no'
  return BOOLEAN_PRESET_LABELS[preset]
}

export function isCalculatedSupportedType(dataType: MetricDataType) {
  return dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration'
}

