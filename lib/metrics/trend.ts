export function calcChangePct(currentValue: number, previousValue: number) {
  if (previousValue === 0 && currentValue === 0) {
    return 0
  }
  if (previousValue === 0) {
    return null
  }
  return Number((((currentValue - previousValue) / Math.abs(previousValue)) * 100).toFixed(1))
}

export type TrendDirection = 'up' | 'down' | 'flat' | 'none'

export function getTrendDirection(changePct: number | null): TrendDirection {
  if (changePct === null) {
    return 'none'
  }
  if (changePct > 0) {
    return 'up'
  }
  if (changePct < 0) {
    return 'down'
  }
  return 'flat'
}
