import { APP_DATE_LOCALE } from '@/lib/utils'

export function formatDate(date: Date): string {
  return date.toLocaleDateString(APP_DATE_LOCALE, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(APP_DATE_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`
}

export function getDayOfWeek(date: Date): string {
  return date.toLocaleDateString(APP_DATE_LOCALE, { weekday: 'long' })
}
