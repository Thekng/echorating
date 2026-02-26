import test from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateFormulaExpression,
  validateFormulaExpression,
} from '../../lib/metrics/formula.ts'

test('formula engine respects arithmetic precedence', () => {
  const result = evaluateFormulaExpression('1 + 2 * 3')
  assert.equal(result.success, true)

  if (result.success) {
    assert.equal(result.returnType, 'number')
    assert.equal(result.value.kind, 'number')
    assert.equal(result.value.value, 7)
  }
})

test('formula engine evaluates IF + logical operators with typed metrics', () => {
  const result = evaluateFormulaExpression('IF(AND(a > 2, b <= 5), a + b, 0)', {
    metricValues: {
      a: 4,
      b: 3,
    },
    metricReturnTypes: {
      a: 'number',
      b: 'number',
    },
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.value.kind, 'number')
    assert.equal(result.value.value, 7)
  }
})

test('formula validator rejects IF branches with incompatible types', () => {
  const result = validateFormulaExpression('IF(flag, 1, true)', {
    metricReturnTypes: {
      flag: 'boolean',
    },
  })

  assert.equal(result.success, false)
  if (!result.success) {
    assert.match(result.error, /IF branches must return the same type/i)
  }
})

test('formula engine handles division by zero with stable fallback', () => {
  const result = evaluateFormulaExpression('sales / quota', {
    metricValues: {
      sales: 10,
      quota: 0,
    },
    metricReturnTypes: {
      sales: 'number',
      quota: 'number',
    },
  })

  assert.equal(result.success, true)
  if (result.success) {
    assert.equal(result.value.kind, 'number')
    assert.equal(result.value.value, 0)
  }
})
