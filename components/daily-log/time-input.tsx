'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSecondsToDuration, parseDurationToSeconds } from '@/lib/daily-log/value-parser'

type TimeInputProps = {
  value?: string | null
  onChange: (value: string | null) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string
  label?: string
  placeholder?: string
  required?: boolean
}

/**
 * Time input component for HH:MM:SS format
 * 
 * Features:
 * - Auto-formatting while typing (HH:MM:SS)
 * - Arrow key increment/decrement
 * - Clear error states
 * - Validates on blur
 * - Supports paste operations
 * 
 * Usage:
 * <TimeInput
 *   value={time}
 *   onChange={(val) => setTime(val)}
 *   label="Talk Time"
 *   error={errors?.talkTime}
 * />
 */
export function TimeInput({
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  label,
  placeholder = 'HH:MM:SS',
  required = false,
}: TimeInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [displayValue, setDisplayValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Initialize display value
  useEffect(() => {
    if (value) {
      setDisplayValue(value)
    } else {
      setDisplayValue('')
    }
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let input = e.target.value

    // Allow clearing the field
    if (input === '') {
      setDisplayValue('')
      onChange(null)
      return
    }

    // Remove any non-digit characters
    const digits = input.replace(/\D/g, '')

    // Format as we type (auto-pad)
    let formatted = ''
    if (digits.length > 0) {
      const chars = digits.padEnd(6, '0').slice(0, 6)
      const hh = chars.slice(0, 2)
      const mm = chars.slice(2, 4)
      const ss = chars.slice(4, 6)
      formatted = `${hh}:${mm}:${ss}`
    }

    setDisplayValue(formatted)

    // Validate and propagate change
    if (formatted.length === 8) {
      const result = parseDurationToSeconds(formatted)
      if (result.ok) {
        onChange(formatted)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const result = parseDurationToSeconds(displayValue || '00:00:00')
    if (!result.ok) return

    let seconds = result.value || 0

    // Arrow up: +1 minute
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      seconds += 60
      const formatted = formatSecondsToDuration(seconds)
      setDisplayValue(formatted)
      onChange(formatted)
    }

    // Arrow down: -1 minute
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      seconds = Math.max(0, seconds - 60)
      const formatted = formatSecondsToDuration(seconds)
      setDisplayValue(formatted)
      onChange(formatted)
    }
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text')
    
    // Try to parse the pasted text
    const result = parseDurationToSeconds(text.trim())
    if (result.ok) {
      const formatted = formatSecondsToDuration(result.value || 0)
      setDisplayValue(formatted)
      onChange(formatted)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)

    // Validate on blur
    if (displayValue && displayValue.length === 8) {
      const result = parseDurationToSeconds(displayValue)
      if (!result.ok) {
        // Keep the invalid display but call onBlur hook
        onBlur?.()
        return
      }
    }

    onBlur?.()
  }

  const handleIncrement = (minutes: number) => {
    const current = parseDurationToSeconds(displayValue || '00:00:00')
    let seconds = (current.ok ? current.value : 0) || 0
    seconds = Math.max(0, seconds + minutes * 60)
    const formatted = formatSecondsToDuration(seconds)
    setDisplayValue(formatted)
    onChange(formatted)
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={cn(
        'relative flex items-center gap-2 rounded-md border bg-background px-3',
        error ? 'border-destructive bg-destructive/5' : 'border-input',
        disabled && 'opacity-50 cursor-not-allowed',
        isFocused && !error && 'ring-1 ring-ring border-ring'
      )}>
        <Clock className="size-4 text-muted-foreground flex-shrink-0" />

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="flex-1 bg-transparent py-2 outline-none text-sm font-mono placeholder:text-muted-foreground"
          maxLength={8}
        />

        {/* Quick increment buttons */}
        {isFocused && !disabled && (
          <div className="flex gap-1 border-l pl-2">
            <button
              type="button"
              onClick={() => handleIncrement(1)}
              title="Add 1 minute"
              className="text-xs font-medium px-1.5 py-0.5 rounded hover:bg-muted"
            >
              +1m
            </button>
            <button
              type="button"
              onClick={() => handleIncrement(-1)}
              title="Subtract 1 minute"
              className="text-xs font-medium px-1.5 py-0.5 rounded hover:bg-muted"
            >
              -1m
            </button>
          </div>
        )}

        {/* Clear button */}
        {displayValue && !disabled && (
          <button
            type="button"
            onClick={() => {
              setDisplayValue('')
              onChange(null)
              inputRef.current?.focus()
            }}
            className="text-muted-foreground hover:text-foreground"
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <p className="text-xs text-muted-foreground">
        Format: HH:MM:SS (e.g., 02:30:45) • Use ↑/↓ to adjust
      </p>
    </div>
  )
}

/**
 * Time range input (start and end times)
 * Useful for tracking call duration, break times, etc.
 */
export function TimeRangeInput({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  disabled = false,
  error,
  label,
}: {
  startValue?: string | null
  endValue?: string | null
  onStartChange: (value: string | null) => void
  onEndChange: (value: string | null) => void
  disabled?: boolean
  error?: string
  label?: string
}) {
  const handleEndChange = (value: string | null) => {
    // Validate that end >= start
    if (startValue && value) {
      const startResult = parseDurationToSeconds(startValue)
      const endResult = parseDurationToSeconds(value)
      
      if (startResult.ok && endResult.ok) {
        const startSecs = startResult.value || 0
        const endSecs = endResult.value || 0
        
        if (endSecs < startSecs) {
          // End time before start time - show error
          return
        }
      }
    }

    onEndChange(value)
  }

  return (
    <div className="space-y-3">
      {label && <label className="block text-sm font-medium">{label}</label>}

      <div className="flex items-end gap-3">
        <div className="flex-1">
          <TimeInput
            value={startValue}
            onChange={onStartChange}
            label="Start Time"
            disabled={disabled}
          />
        </div>

        <div className="text-muted-foreground">→</div>

        <div className="flex-1">
          <TimeInput
            value={endValue}
            onChange={handleEndChange}
            label="End Time"
            disabled={disabled}
            error={error}
          />
        </div>
      </div>

      {/* Auto-calculate duration */}
      {startValue && endValue && (
        <div className="text-sm text-muted-foreground">
          Duration:{' '}
          <span className="font-mono font-semibold">
            {(() => {
              const startResult = parseDurationToSeconds(startValue)
              const endResult = parseDurationToSeconds(endValue)
              if (startResult.ok && endResult.ok) {
                const duration = (endResult.value || 0) - (startResult.value || 0)
                return formatSecondsToDuration(Math.max(0, duration))
              }
              return '--:--:--'
            })()}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Time display component (read-only)
 * Shows a time value formatted as HH:MM:SS
 */
export function TimeDisplay({
  value,
  label,
  className,
}: {
  value?: number | null
  label?: string
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {label && <span className="text-sm text-muted-foreground">{label}:</span>}
      <span className="font-mono font-semibold">
        {formatSecondsToDuration(value)}
      </span>
    </div>
  )
}
