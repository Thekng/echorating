'use client'

const HOURS = Array.from({ length: 100 }, (_, index) => String(index).padStart(2, '0'))
const MINUTES_SECONDS = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, '0'))

type DurationSelectorProps = {
  name: string
  value: string
  onChange: (nextValue: string) => void
  disabled?: boolean
  ariaLabel?: string
}

function parseValue(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!match) {
    return {
      hh: '',
      mm: '',
      ss: '',
    }
  }

  const hh = Number(match[1])
  const mm = Number(match[2])
  const ss = Number(match[3])

  if (hh < 0 || hh > 99 || mm < 0 || mm > 59 || ss < 0 || ss > 59) {
    return {
      hh: '',
      mm: '',
      ss: '',
    }
  }

  return {
    hh: String(hh).padStart(2, '0'),
    mm: String(mm).padStart(2, '0'),
    ss: String(ss).padStart(2, '0'),
  }
}

export function DurationSelector({
  name,
  value,
  onChange,
  disabled = false,
  ariaLabel,
}: DurationSelectorProps) {
  const parts = parseValue(value)

  const setPart = (part: 'hh' | 'mm' | 'ss', partValue: string) => {
    if (!partValue) {
      onChange('')
      return
    }

    const next = {
      hh: parts.hh || '00',
      mm: parts.mm || '00',
      ss: parts.ss || '00',
      [part]: partValue,
    }

    onChange(`${next.hh}:${next.mm}:${next.ss}`)
  }

  return (
    <div className="flex items-center gap-1">
      <input type="hidden" name={name} value={value} />

      <select
        value={parts.hh}
        onChange={(event) => setPart('hh', event.currentTarget.value)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} hours` : 'Hours'}
        className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">HH</option>
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </select>

      <span className="text-muted-foreground">:</span>

      <select
        value={parts.mm}
        onChange={(event) => setPart('mm', event.currentTarget.value)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} minutes` : 'Minutes'}
        className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">MM</option>
        {MINUTES_SECONDS.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </select>

      <span className="text-muted-foreground">:</span>

      <select
        value={parts.ss}
        onChange={(event) => setPart('ss', event.currentTarget.value)}
        disabled={disabled}
        aria-label={ariaLabel ? `${ariaLabel} seconds` : 'Seconds'}
        className="h-9 w-16 rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">SS</option>
        {MINUTES_SECONDS.map((second) => (
          <option key={second} value={second}>
            {second}
          </option>
        ))}
      </select>
    </div>
  )
}
