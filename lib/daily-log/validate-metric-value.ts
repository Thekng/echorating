import { normalizeMetricSettings, booleanLabels, type MetricDataType, type MetricSettings } from '@/lib/metrics/data-types'

type ValidationResult =
  | { valid: true }
  | { valid: false; message: string }

export function validateMetricValue(
  dataType: MetricDataType,
  rawSettings: MetricSettings | null | undefined,
  rawValue: string,
): ValidationResult {
  const value = rawValue.trim()
  if (!value) {
    return { valid: true }
  }

  const settings = normalizeMetricSettings(dataType, rawSettings)

  if (dataType === 'boolean') {
    const labels = booleanLabels(settings)
    const lower = value.toLowerCase()
    if (lower !== 'true' && lower !== 'false' && lower !== labels.trueLabel.toLowerCase() && lower !== labels.falseLabel.toLowerCase()) {
      return { valid: false, message: 'Invalid boolean value.' }
    }
    return { valid: true }
  }

  if (dataType === 'duration') {
    const format = settings.durationFormat ?? 'hh_mm_ss'
    if (format === 'hh_mm_ss') {
      if (!/^\d{1,3}:\d{2}(:\d{2})?$/.test(value)) {
        return { valid: false, message: 'Expected format: HH:MM or HH:MM:SS.' }
      }
      return { valid: true }
    }
    // minutes, hours, days
    if (isNaN(Number(value)) || Number(value) < 0) {
      return { valid: false, message: 'Must be a non-negative number.' }
    }
    return { valid: true }
  }

  if (dataType === 'text') {
    if (settings.textFormat === 'email') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: 'Invalid email format.' }
      }
    }
    if (settings.textFormat === 'url') {
      try {
        new URL(value)
      } catch {
        return { valid: false, message: 'Invalid URL format.' }
      }
    }
    return { valid: true }
  }

  if (dataType === 'datetime') {
    if (settings.datetimeFormat === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return { valid: false, message: 'Invalid date format.' }
    }
    if (settings.datetimeFormat === 'time' && !/^\d{2}:\d{2}$/.test(value)) {
      return { valid: false, message: 'Invalid time format.' }
    }
    if (settings.datetimeFormat === 'datetime' && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value)) {
      return { valid: false, message: 'Invalid date/time format.' }
    }
    return { valid: true }
  }

  if (dataType === 'selection') {
    const options = settings.selectionOptions ?? []
    if (options.length === 0) {
      return { valid: true }
    }

    if (settings.selectionMode === 'multi') {
      let selected: string[] = []
      try {
        selected = JSON.parse(value) as string[]
      } catch {
        selected = value.split(',').map((s) => s.trim()).filter(Boolean)
      }
      const invalid = selected.find((item) => !options.includes(item))
      if (invalid) {
        return { valid: false, message: `Invalid selection: "${invalid}".` }
      }
      return { valid: true }
    }

    if (!options.includes(value)) {
      return { valid: false, message: 'Invalid selection option.' }
    }
    return { valid: true }
  }

  if (dataType === 'file') {
    try {
      new URL(value)
    } catch {
      return { valid: false, message: 'Invalid file URL.' }
    }
    return { valid: true }
  }

  // Numeric types: number, currency, percent
  const numericValue = Number(value)
  if (isNaN(numericValue)) {
    return { valid: false, message: 'Must be a valid number.' }
  }

  if (dataType === 'number' && settings.numberKind === 'integer' && !Number.isInteger(numericValue)) {
    return { valid: false, message: 'Only whole numbers are allowed.' }
  }

  return { valid: true }
}
