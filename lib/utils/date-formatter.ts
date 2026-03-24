/**
 * Consistent date formatting across the system
 * Short dates use MM/DD/YYYY format for clarity
 */

export const APP_DATE_LOCALE = 'en-US'
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function coerceDate(date: Date | string | null | undefined): Date | null {
  if (!date) {
    return null
  }

  let value: Date

  if (typeof date === 'string') {
    if (DATE_ONLY_PATTERN.test(date)) {
      const [year, month, day] = date.split('-').map(Number)
      value = new Date(year, month - 1, day, 12, 0, 0)
    } else {
      value = new Date(date)
    }
  } else {
    value = date
  }

  return Number.isNaN(value.getTime()) ? null : value
}

function formatDateValue(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const value = coerceDate(date)
  if (!value) return '-'

  return new Intl.DateTimeFormat(APP_DATE_LOCALE, options).format(value)
}

export function formatDateShort(date: Date | string | null | undefined): string {
  const value = coerceDate(date)
  if (!value) return '-'

  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  const year = String(value.getFullYear())

  return `${month}/${day}/${year}`
}

export function formatDateRange(start: Date | string | null, end: Date | string | null): string {
  const startStr = formatDateShort(start)
  const endStr = formatDateShort(end)

  if (startStr === endStr) return startStr
  return `${startStr} - ${endStr}`
}

export function formatDateFull(date: Date | string | null | undefined): string {
  return formatDateValue(date, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateMedium(date: Date | string | null | undefined): string {
  return formatDateValue(date, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}

export function formatDateMonthDay(date: Date | string | null | undefined): string {
  return formatDateValue(date, {
    month: 'short',
    day: 'numeric',
  })
}
