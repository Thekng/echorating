'use client'

import React, { useMemo, useRef } from 'react'
import { evaluateFormulaExpression, type FormulaValueType } from '@/lib/metrics/formula'

type FormulaBuilderProps = {
  id?: string
  name?: string
  value: string
  metrics?: Array<{
    metric_id: string
    name: string
    code: string
    department_id: string
    department_name: string
    data_type?: string
  }>
  onChange: (value: string) => void
  required?: boolean
}

type FormulaTemplate = {
  id: string
  label: string
  expression: string
}

const ARITHMETIC_OPERATORS = ['-', '+', '/', '*', '(', ')'] as const
const COMPARISON_OPERATORS = ['>', '>=', '<', '<=', '=', '!='] as const
const LOGIC_TOKENS = ['AND', 'OR', ','] as const

function formulaValueTypeForMetric(dataType?: string): FormulaValueType | null {
  if (dataType === 'boolean') {
    return 'boolean'
  }

  if (dataType === 'number' || dataType === 'currency' || dataType === 'percent' || dataType === 'duration') {
    return 'number'
  }

  return null
}

function withSpacing(before: string, token: string, after: string) {
  const leftPad = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
  const rightPad = after.length > 0 && !/^\s/.test(after) ? ' ' : ''
  return {
    leftPad,
    text: `${leftPad}${token}${rightPad}`,
  }
}

function buildTemplates(metrics: FormulaBuilderProps['metrics'] = []): FormulaTemplate[] {
  const a = metrics[0]?.code ?? 'metric_a'
  const b = metrics[1]?.code ?? 'metric_b'
  const c = metrics[2]?.code ?? 'metric_c'

  const templates: FormulaTemplate[] = [
    {
      id: 'sum',
      label: 'Sum',
      expression: `${a} + ${b}`,
    },
    {
      id: 'avg',
      label: 'Average',
      expression: `(${a} + ${b}) / 2`,
    },
    {
      id: 'ratio_pct',
      label: 'Ratio %',
      expression: `IF(${b} = 0, 0, (${a} / ${b}) * 100)`,
    },
    {
      id: 'gap',
      label: 'Gap',
      expression: `${a} - ${b}`,
    },
    {
      id: 'if_gt',
      label: 'IF >',
      expression: `IF(${a} > ${b}, ${a}, ${b})`,
    },
    {
      id: 'goal_check',
      label: 'Goal Met',
      expression: `${a} >= ${b}`,
    },
    {
      id: 'logic_gate',
      label: 'AND Check',
      expression: `AND(${a} > 0, ${b} > 0)`,
    },
    {
      id: 'fallback',
      label: 'Fallback',
      expression: `IF(${a} != 0, ${a}, ${b})`,
    },
  ]

  templates.push({
    id: 'sum_three',
    label: 'Sum 3',
    expression: `${a} + ${b} + ${c}`,
  })

  return templates
}

export function FormulaBuilder({ id, name, value, metrics = [], onChange, required }: FormulaBuilderProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const templates = useMemo(() => buildTemplates(metrics), [metrics])
  const metricReturnTypes = useMemo(() => {
    const map = new Map<string, FormulaValueType>()

    for (const metric of metrics) {
      const type = formulaValueTypeForMetric(metric.data_type)
      if (!type) {
        continue
      }

      map.set(metric.code.toLowerCase(), type)
    }

    return map
  }, [metrics])
  const preview = useMemo(() => {
    const expression = value.trim()
    if (!expression) {
      return {
        state: 'idle' as const,
        samplePairs: [] as Array<{ code: string; sample: string }>,
      }
    }

    const samplePairs: Array<{ code: string; sample: string }> = []
    const metricValues: Record<string, number | boolean> = {}

    let numberSeed = 10
    let boolSeed = true
    for (const metric of metrics) {
      const type = formulaValueTypeForMetric(metric.data_type)
      if (!type) {
        continue
      }

      const code = metric.code.toLowerCase()
      if (type === 'boolean') {
        metricValues[code] = boolSeed
        samplePairs.push({ code, sample: boolSeed ? 'Yes' : 'No' })
        boolSeed = !boolSeed
      } else {
        metricValues[code] = numberSeed
        samplePairs.push({ code, sample: String(numberSeed) })
        numberSeed += 10
      }
    }

    const evaluated = evaluateFormulaExpression(expression, {
      metricValues,
      metricReturnTypes,
    })

    if (!evaluated.success) {
      return {
        state: 'error' as const,
        message: evaluated.error,
        samplePairs: samplePairs.slice(0, 6),
      }
    }

    const result =
      evaluated.value.kind === 'boolean'
        ? evaluated.value.value
          ? 'Yes'
          : 'No'
        : Number(evaluated.value.value.toFixed(2)).toString()

    return {
      state: 'ok' as const,
      result,
      returnType: evaluated.returnType,
      samplePairs: samplePairs.slice(0, 6),
    }
  }, [metrics, metricReturnTypes, value])

  function insertToken(token: string) {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value ? `${value} ${token}` : token)
      return
    }

    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const before = value.slice(0, start)
    const after = value.slice(end)
    const spaced = withSpacing(before, token, after)
    const nextValue = `${before}${spaced.text}${after}`
    onChange(nextValue)

    const nextCursor = before.length + spaced.leftPad.length + token.length
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(nextCursor, nextCursor)
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        rows={4}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          metrics.length
            ? `e.g. IF(${metrics[0].code} > ${metrics[1]?.code ?? 'metric_b'}, ${metrics[0].code}, 0)`
            : 'e.g. IF(metric_a > metric_b, metric_a, 0)'
        }
        required={required}
      />

      <p className="text-xs text-muted-foreground">
        Use metric codes, arithmetic, comparisons, AND/OR, and IF. Scroll and click to assemble formulas faster.
      </p>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,260px)_minmax(0,1fr)]">
        <section className="rounded-md border border-input p-3">
          <p className="text-xs font-medium text-muted-foreground">Metric Code List (Selected Department)</p>
          <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
            {metrics.length === 0 ? (
              <p className="text-xs text-muted-foreground">No metric codes available.</p>
            ) : (
              metrics.map((metric) => (
                <button
                  key={metric.metric_id}
                  type="button"
                  onClick={() => insertToken(metric.code)}
                  className="flex w-full items-center justify-between rounded-md border border-input bg-secondary/15 px-2 py-1.5 text-left text-xs hover:bg-secondary/25"
                  title={metric.name}
                >
                  <span className="font-mono">{metric.code}</span>
                  <span className="text-[10px] uppercase text-muted-foreground">{metric.data_type ?? 'metric'}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-md border border-input p-3">
          <p className="text-xs font-medium text-muted-foreground">Formula Helpers</p>
          <div className="mt-2 max-h-72 space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Arithmetic</p>
              <div className="flex flex-wrap gap-2">
                {ARITHMETIC_OPERATORS.map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    onClick={() => insertToken(operator)}
                    className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                  >
                    {operator}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Comparisons</p>
              <div className="flex flex-wrap gap-2">
                {COMPARISON_OPERATORS.map((operator) => (
                  <button
                    key={operator}
                    type="button"
                    onClick={() => insertToken(operator)}
                    className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                  >
                    {operator}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Logic + Functions</p>
              <div className="flex flex-wrap gap-2">
                {LOGIC_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() => insertToken(token)}
                    className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                  >
                    {token}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => insertToken('IF(')}
                  className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                >
                  IF(
                </button>
                <button
                  type="button"
                  onClick={() => insertToken('AND(')}
                  className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                >
                  AND(
                </button>
                <button
                  type="button"
                  onClick={() => insertToken('OR(')}
                  className="rounded-md border border-input px-2 py-1 text-xs font-mono hover:bg-muted/40"
                >
                  OR(
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Quick templates</p>
              <div className="flex flex-wrap gap-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => onChange(template.expression)}
                    className="rounded-md border border-input px-2 py-1 text-xs hover:bg-muted/40"
                    title={template.expression}
                  >
                    {template.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-md border border-input bg-muted/20 p-3">
        <p className="text-xs font-medium text-muted-foreground">Preview</p>

        {preview.state === 'idle' ? (
          <p className="mt-1 text-xs text-muted-foreground">Type a formula to preview the result format.</p>
        ) : null}

        {preview.state === 'error' ? (
          <p className="mt-1 text-xs text-destructive">{preview.message}</p>
        ) : null}

        {preview.state === 'ok' ? (
          <div className="mt-1 space-y-1">
            <p className="text-sm font-medium">
              Result ({preview.returnType}): <span className="font-mono">{preview.result}</span>
            </p>
            <p className="text-xs text-muted-foreground">Sample inputs:</p>
            <div className="flex flex-wrap gap-1">
              {preview.samplePairs.map((pair) => (
                <span key={pair.code} className="rounded-md border border-input bg-background px-2 py-0.5 text-[11px]">
                  <span className="font-mono">{pair.code}</span>={pair.sample}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  )
}
