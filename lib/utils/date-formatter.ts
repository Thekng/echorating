/**
 * Consistent date formatting across the system
 * All dates use mm/dd/yyyy format for clarity
 */

export function formatDateShort(date: Date | string | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date
  if (Number.isNaN(d.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export function formatDateRange(start: Date | string | null, end: Date | string | null): string {
  const startStr = formatDateShort(start)
  const endStr = formatDateShort(end)

  if (startStr === endStr) return startStr
  return `${startStr} - ${endStr}`
}

export function formatDateFull(date: Date | string | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(`${date}T00:00:00Z`) : date
  if (Number.isNaN(d.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d)
}
