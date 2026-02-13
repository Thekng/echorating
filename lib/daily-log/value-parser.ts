export type DurationParseResult =
  | { ok: true; value: number | null }
  | { ok: false; message: string }

function padTwo(value: number) {
  return String(value).padStart(2, '0')
}

export function parseDurationToSeconds(raw: string): DurationParseResult {
  const value = raw.trim()
  if (!value) {
    return { ok: true, value: null }
  }

  const match = value.match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return { ok: false, message: 'Duration must be in HH:MM:SS format.' }
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])

  if (minutes > 59 || seconds > 59) {
    return { ok: false, message: 'Duration minutes/seconds must be between 00 and 59.' }
  }

  return {
    ok: true,
    value: hours * 3600 + minutes * 60 + seconds,
  }
}

export function formatSecondsToDuration(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return ''
  }

  const total = Math.max(0, Math.floor(Number(value)))
  if (!Number.isFinite(total)) {
    return ''
  }

  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60

  return `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`
}

export function parseBooleanInput(raw: string | null): boolean | null {
  if (!raw) {
    return null
  }

  const value = raw.trim().toLowerCase()
  if (['true', '1', 'yes', 'y', 'on'].includes(value)) {
    return true
  }

  if (['false', '0', 'no', 'n', 'off'].includes(value)) {
    return false
  }

  return null
}
