const PALETTE = [
  'oklch(0.62 0.19 255)',
  'oklch(0.70 0.17 160)',
  'oklch(0.72 0.18 55)',
  'oklch(0.64 0.22 15)',
  'oklch(0.60 0.20 305)',
  'oklch(0.68 0.15 195)',
  'oklch(0.74 0.16 95)',
  'oklch(0.58 0.18 340)',
]

function hashString(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0
  }
  return Math.abs(hash)
}

export function colorForMetric(metricId: string, fallbackIndex = 0) {
  if (!metricId) {
    return PALETTE[fallbackIndex % PALETTE.length]
  }
  return PALETTE[hashString(metricId) % PALETTE.length]
}

export function buildMetricColorMap(metricIds: string[]) {
  const used = new Set<string>()
  const map = new Map<string, string>()

  for (const metricId of metricIds) {
    let color = colorForMetric(metricId)
    if (used.has(color)) {
      const fallback = PALETTE.find((candidate) => !used.has(candidate))
      if (fallback) {
        color = fallback
      }
    }
    used.add(color)
    map.set(metricId, color)
  }

  return map
}
