import test from 'node:test'
import assert from 'node:assert/strict'
import { booleanLabels, normalizeMetricSettings } from '../../lib/metrics/data-types.ts'

test('normalizeMetricSettings always uses yes/no preset for boolean type', () => {
  assert.deepEqual(
    normalizeMetricSettings('boolean', {
      booleanPreset: 'true_false',
    }),
    { booleanPreset: 'yes_no' },
  )
})

test('booleanLabels always returns Yes/No labels', () => {
  assert.deepEqual(
    booleanLabels({
      booleanPreset: 'completed_not_completed',
    }),
    {
      trueLabel: 'Yes',
      falseLabel: 'No',
    },
  )
})
