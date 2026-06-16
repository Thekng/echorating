import test from 'node:test'
import assert from 'node:assert/strict'
import { areMemberFiltersEqual, areMetricFiltersEqual, formatMemberDepartments } from '../../features/settings/helpers.ts'
test('areMetricFiltersEqual matches', () => {
  const a = { q: 's', departmentId: 'all', status: 'active' as const }
  assert.equal(areMetricFiltersEqual(a, a), true)
})
test('areMemberFiltersEqual matches', () => {
  const a = { q: 'a', role: 'manager' as const }
  assert.equal(areMemberFiltersEqual(a, a), true)
})
test('formatMemberDepartments', () => {
  assert.equal(formatMemberDepartments([]), 'No department')
  assert.equal(formatMemberDepartments([{ name: 'S' }]), 'S')
})
