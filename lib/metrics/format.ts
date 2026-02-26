import { formatSecondsToDuration } from '../daily-log/value-parser.ts'
import { booleanLabels, normalizeMetricSettings, type MetricDataType } from './data-types.ts'

type BooleanMode = 'label' | 'count'
type DurationStyle = 'timer' | 'compact'

type FormatMetricNumberOptions = {
  dataType: MetricDataType | string
  unit?: string | null
  settings?: unknown
  booleanMode?: BooleanMode
  durationStyle?: DurationStyle
}

function trimTrailingZeros(value: string) {
  return value.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1')
}

export function formatDecimal(value: number, maxDecimals = 1) {
  return trimTrailingZeros(value.toFixed(maxDecimals))
}

export function formatPercent(value: number, maxDecimals = 1) {
  return `${formatDecimal(value, maxDecimals)}%`
}

export function formatMetricNumber(value: number, options: FormatMetricNumberOptions) {
  const dataType = options.dataType as MetricDataType
  const settings = normalizeMetricSettings(dataType, options.settings)

  if (dataType === 'duration') {
    const rawUnit = String(options.unit ?? '').toLowerCase()
    const durationFormat =
      settings.durationFormat === 'minutes' ||
      settings.durationFormat === 'hours' ||
      settings.durationFormat === 'days' ||
      settings.durationFormat === 'hh_mm_ss'
        ? settings.durationFormat
        : rawUnit === 'minutes' || rawUnit === 'hours' || rawUnit === 'days'
          ? rawUnit
          : rawUnit === 'hh:mm:ss'
            ? 'hh_mm_ss'
            : 'hh_mm_ss'

    if (durationFormat === 'hh_mm_ss' || options.durationStyle === 'timer') {
      return formatSecondsToDuration(value) || '00:00:00'
    }

    const divisor =
      durationFormat === 'minutes' ? 60 : durationFormat === 'hours' ? 3600 : 86400
    const converted = value / divisor
    const compact = formatDecimal(converted, 1)

    if (durationFormat === 'minutes') {
      return `${compact}m`
    }
    if (durationFormat === 'hours') {
      return `${compact}h`
    }
    return `${compact}d`
  }

  if (dataType === 'currency') {
    const currencyCode = (settings.currencyCode || options.unit || 'USD').toUpperCase()
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    }).format(value)
  }

  if (dataType === 'percent') {
    return formatPercent(value, 1)
  }

  if (dataType === 'boolean') {
    if (options.booleanMode === 'count') {
      return formatDecimal(value, 1)
    }

    const labels = booleanLabels(settings)
    return value >= 0.5 ? labels.trueLabel : labels.falseLabel
  }

  if (dataType === 'number' && settings.numberKind === 'integer') {
    return String(Math.round(value))
  }

  // Precision policy: non-currency numeric values render with max 1 decimal.
  return formatDecimal(value, 1)
}
