import test from 'node:test'
import assert from 'node:assert/strict'
import {
  formatDecimal,
  formatMetricNumber,
  formatPercent,
} from '../../lib/metrics/format.ts'

test('formatDecimal trims trailing zeros with max precision', () => {
  assert.equal(formatDecimal(12, 1), '12')
  assert.equal(formatDecimal(12.34, 1), '12.3')
  assert.equal(formatDecimal(0.04, 1), '0')
})

test('formatPercent applies max one decimal and trims zeros', () => {
  assert.equal(formatPercent(10, 1), '10%')
  assert.equal(formatPercent(10.36, 1), '10.4%')
})

test('formatMetricNumber applies precision policy by metric type', () => {
  assert.equal(
    formatMetricNumber(7.26, {
      dataType: 'number',
      settings: { numberKind: 'decimal' },
    }),
    '7.3',
  )

  assert.equal(
    formatMetricNumber(42.8, {
      dataType: 'number',
      settings: { numberKind: 'integer' },
    }),
    '43',
  )

  assert.equal(
    formatMetricNumber(85.55, {
      dataType: 'percent',
    }),
    '85.5%',
  )

  const currency = formatMetricNumber(1234.567, {
    dataType: 'currency',
    unit: 'USD',
  })

  const decimalMatch = currency.match(/[.,](\d+)\D*$/)
  assert.ok(!decimalMatch || decimalMatch[1].length <= 2, `expected <=2 decimals, got "${currency}"`)
})

test('boolean metrics are rendered as yes/no labels by default', () => {
  assert.equal(
    formatMetricNumber(1, {
      dataType: 'boolean',
    }),
    'Yes',
  )

  assert.equal(
    formatMetricNumber(0, {
      dataType: 'boolean',
    }),
    'No',
  )
})
