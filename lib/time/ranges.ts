export const TIME_RANGE_PRESETS = {
  TODAY: { label: 'Today', days: 1 },
  THIS_WEEK: { label: 'This Week', days: 7 },
  THIS_MONTH: { label: 'This Month', days: 30 },
  LAST_3_MONTHS: { label: 'Last 3 Months', days: 90 },
  THIS_YEAR: { label: 'This Year', days: 365 },
}

export function getDateRange(days: number) {
  const end = new Date()
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000)
  return { start, end }
}
