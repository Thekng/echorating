'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  parseFormulaExpression,
  type FormulaToken,
  validateFormulaExpression,
} from '@/lib/metrics/formula'

type MetricOption = {
  metric_id: string
  name: string
  code: string
  department_name: string
}

type FormulaBuilderProps = {
  id: string
  name: string
  value: string
  required?: boolean
  currentMetricCode?: string
  metrics: MetricOption[]
  onChange: (next: string) => void
}

function appendToken(expression: string, token: string) {
  const trimmed = expression.trim()
  if (!trimmed) {
    return token
  }
  return `${trimmed} ${token}`
}

function tokenClass(token: FormulaToken) {
  if (token.type === 'metric') {
    return 'border-blue-200 bg-blue-50 text-blue-700'
  }

  if (token.type === 'operator') {
    return 'border-amber-200 bg-amber-50 text-amber-700'
  }

  if (token.type === 'number') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  return 'border-zinc-200 bg-zinc-100 text-zinc-700'
}

export function FormulaBuilder({
  id,
  name,
  value,
  required = false,
  currentMetricCode,
  metrics,
  onChange,
}: FormulaBuilderProps) {
  const [metricSearch, setMetricSearch] = useState('')
  const [numberInput, setNumberInput] = useState('')
  const [rawMode, setRawMode] = useState(() => {
    const initial = value.trim()
    if (!initial) {
      return false
    }
    return !parseFormulaExpression(initial).success
  })

  const knownCodes = useMemo(() => metrics.map((metric) => metric.code.toLowerCase()), [metrics])
  const validation = useMemo(
    () =>
      validateFormulaExpression(value, {
        knownMetricCodes: knownCodes,
        disallowMetricCodes: currentMetricCode ? [currentMetricCode.toLowerCase()] : [],
      }),
    [knownCodes, currentMetricCode, value],
  )

  useEffect(() => {
    if (!rawMode) {
      return
    }

    if (!value.trim()) {
      return
    }

    if (validation.success) {
      setRawMode(false)
    }
  }, [rawMode, validation.success, value])

  const filteredMetrics = useMemo(() => {
    const term = metricSearch.trim().toLowerCase()
    if (!term) {
      return metrics
    }

    return metrics.filter((metric) => {
      return (
        metric.name.toLowerCase().includes(term) ||
        metric.code.toLowerCase().includes(term) ||
        metric.department_name.toLowerCase().includes(term)
      )
    })
  }, [metricSearch, metrics])

  return (
    <div className="space-y-3">
      <input type="hidden" id={id} name={name} value={value} required={required} />

      {rawMode ? (
        <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs text-amber-700">
            Legacy formula format detected. Edit as raw text until it becomes valid.
          </p>
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            rows={3}
            className="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm"
            placeholder="e.g. sold_items / quoted_households"
          />
        </div>
      ) : (
        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
          <div className="space-y-2">
            <label htmlFor={`${id}-raw`} className="text-xs font-medium text-muted-foreground">
              Formula expression
            </label>
            <input
              id={`${id}-raw`}
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm"
              placeholder="e.g. sold_items / quoted_households"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {['+', '-', '*', '/', '(', ')'].map((operator) => (
              <button
                key={operator}
                type="button"
                onClick={() => onChange(appendToken(value, operator))}
                className="h-8 rounded-md border border-input bg-background px-3 font-mono text-xs hover:bg-muted"
              >
                {operator}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange(value.trim().split(/\s+/).slice(0, -1).join(' '))}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
            >
              Backspace
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
            >
              Clear
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              value={numberInput}
              onChange={(event) => setNumberInput(event.target.value)}
              placeholder="Number"
              className="h-8 w-28 rounded-md border border-input bg-background px-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => {
                const next = numberInput.trim()
                if (!next) {
                  return
                }
                if (!/^\d+(\.\d+)?$/.test(next)) {
                  return
                }
                onChange(appendToken(value, next))
                setNumberInput('')
              }}
              className="h-8 rounded-md border border-input bg-background px-3 text-xs hover:bg-muted"
            >
              Add number
            </button>
          </div>

          <div className="space-y-2">
            <input
              value={metricSearch}
              onChange={(event) => setMetricSearch(event.target.value)}
              placeholder="Search metric by name or code"
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs"
            />
            <div className="max-h-28 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2">
              {filteredMetrics.length === 0 ? (
                <p className="text-xs text-muted-foreground">No metric found.</p>
              ) : (
                filteredMetrics.slice(0, 12).map((metric) => (
                  <button
                    key={metric.metric_id}
                    type="button"
                    onClick={() => onChange(appendToken(value, metric.code.toLowerCase()))}
                    className="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs hover:bg-muted"
                  >
                    <span className="font-medium">
                      {metric.name} ({metric.code})
                    </span>
                    <span className="text-muted-foreground">{metric.department_name}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {validation.success ? (
            <div className="flex flex-wrap gap-2 rounded-md border border-emerald-200 bg-emerald-50/50 p-2">
              {validation.tokens.map((token, index) => (
                <span
                  key={`${token.value}-${index}`}
                  className={`rounded border px-2 py-1 font-mono text-xs ${tokenClass(token)}`}
                >
                  {token.value}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {!validation.success ? (
        <p className="text-xs text-destructive">{validation.error}</p>
      ) : (
        <p className="text-xs text-muted-foreground">Dependencies are derived automatically from metric codes.</p>
      )}
    </div>
  )
}
