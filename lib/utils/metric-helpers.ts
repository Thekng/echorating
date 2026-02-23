/**
 * Metric icon and display helpers
 * Provides consistent icons and formatting across the system
 */

export type MetricIcon = string

export function getMetricIcon(code: string): MetricIcon {
  const normalized = code.toLowerCase()

  // Time tracking
  if (normalized.includes('talk_time')) return '📞'
  if (normalized.includes('break')) return '☕'
  if (normalized.includes('after_call') || normalized.includes('acw')) return '✍️'
  if (normalized.includes('available')) return '⏰'

  // Sales & Revenue
  if (normalized.includes('premium')) return '💰'
  if (normalized.includes('revenue')) return '💵'
  if (normalized.includes('close') || normalized.includes('closed')) return '🎯'
  if (normalized.includes('policy') || normalized.includes('policies')) return '📋'
  if (normalized.includes('quote') || normalized.includes('quoted')) return '📊'

  // Customer & Interactions
  if (normalized.includes('household') || normalized.includes('hhld')) return '🏠'
  if (normalized.includes('conversation') || normalized.includes('call')) return '💬'
  if (normalized.includes('contact')) return '📞'
  if (normalized.includes('follow')) return '✅'

  // Quality & Performance
  if (normalized.includes('quality')) return '⭐'
  if (normalized.includes('satisfaction') || normalized.includes('nps')) return '😊'
  if (normalized.includes('accuracy')) return '🎯'
  if (normalized.includes('compliance')) return '✔️'

  // General
  if (normalized.includes('metric') || normalized.includes('kpi')) return '📈'
  return '📊'
}

export function getMetricColor(code: string): string {
  const normalized = code.toLowerCase()

  if (normalized.includes('talk_time') || normalized.includes('available')) return 'text-blue-600'
  if (normalized.includes('close') || normalized.includes('revenue')) return 'text-emerald-600'
  if (normalized.includes('break') || normalized.includes('after_call')) return 'text-amber-600'
  if (normalized.includes('quality') || normalized.includes('satisfaction')) return 'text-purple-600'

  return 'text-slate-600'
}
