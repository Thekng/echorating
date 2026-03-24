/**
 * Consistent date formatting across the system
 * All dates use mm/dd/yyyy format for clarity
 */

export const APP_DATE_LOCALE = 'en-US'

function coerceDate(date: Date | string | null | undefined): Date | null {
  if (!date) {
    return null
  }

  const value = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date
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
  return formatDateValue(date, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
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
