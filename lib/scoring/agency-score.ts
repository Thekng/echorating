export type ScoreStatus = 'healthy' | 'watch' | 'at_risk' | 'no_data'

const WEIGHTS = {
  completion: 0.35,
  targetPerformance: 0.40,
  consistency: 0.15,
  trend: 0.10,
} as const

/**
 * Completion score: what fraction of expected logs were submitted.
 * Returns 0-100.
 */
export function computeCompletionScore(submittedLogs: number, expectedLogs: number): number {
  if (expectedLogs <= 0) return 0
  return clamp((submittedLogs / expectedLogs) * 100)
}

/**
 * Target performance: average of (actual / target) across metrics.
 * Each metric is capped at 100 (exceeding target still counts as 100).
 * Returns 0-100.
 */
export function computeTargetPerformanceScore(
  metricValues: Array<{ actual: number; target: number }>,
): number {
  const withTargets = metricValues.filter((m) => m.target > 0)
  if (withTargets.length === 0) return 0

  let totalAchievement = 0
  for (const { actual, target } of withTargets) {
    totalAchievement += Math.min(actual / target, 1)
  }

  return clamp((totalAchievement / withTargets.length) * 100)
}

/**
 * Consistency score: fraction of days in the window that have submissions.
 * Returns 0-100.
 */
export function computeConsistencyScore(submittedDaysCount: number, windowDays: number): number {
  if (windowDays <= 0) return 0
  return clamp((submittedDaysCount / windowDays) * 100)
}

/**
 * Trend score: how current period compares to previous period.
 * Returns 0-100. 50 = same, >50 = improving, <50 = declining.
 */
export function computeTrendScore(currentValue: number, previousValue: number): number {
  if (previousValue === 0 && currentValue === 0) return 50
  if (previousValue === 0) return 100

  const ratio = currentValue / previousValue
  // Map ratio to 0-100: ratio=0.5 → 25, ratio=1.0 → 50, ratio=1.5 → 75, ratio>=2.0 → 100
  return clamp(ratio * 50)
}

/**
 * Weighted agency score combining all components.
 * Returns 0-100 or null if no data.
 */
export function computeAgencyScore(
  completionScore: number,
  targetPerformanceScore: number,
  consistencyScore: number,
  trendScore: number,
  hasData: boolean,
): number | null {
  if (!hasData) return null

  // If no targets are set, redistribute target weight to completion
  const hasTargets = targetPerformanceScore > 0
  let score: number

  if (hasTargets) {
    score =
      completionScore * WEIGHTS.completion +
      targetPerformanceScore * WEIGHTS.targetPerformance +
      consistencyScore * WEIGHTS.consistency +
      trendScore * WEIGHTS.trend
  } else {
    // No targets: 55% completion, 0% target, 30% consistency, 15% trend
    score =
      completionScore * 0.55 +
      consistencyScore * 0.30 +
      trendScore * 0.15
  }

  return clamp(score)
}

/**
 * Get score status label.
 */
export function getScoreStatus(score: number | null): ScoreStatus {
  if (score === null) return 'no_data'
  if (score >= 80) return 'healthy'
  if (score >= 60) return 'watch'
  return 'at_risk'
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10
}
