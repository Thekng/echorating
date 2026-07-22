import test from 'node:test'
import assert from 'node:assert/strict'
import {
  areMemberFiltersEqual,
  areMetricFiltersEqual,
  formatMemberDepartments,
} from '../../features/settings/helpers.ts'

test('areMetricFiltersEqual matches all filter fields', () => {
  assert.equal(
    areMetricFiltersEqual(
      {
        q: 'sales',
        departmentId: 'all',
        mode: 'manual',
        status: 'active',
      } as any,
      {
        q: 'sales',
        departmentId: 'all',
        mode: 'manual',
        status: 'active',
      } as any,
    ),
    true,
  )

  assert.equal(
    areMetricFiltersEqual(
      {
        q: 'sales',
        departmentId: 'all',
        mode: 'manual',
        status: 'active',
      } as any,
      {
        q: 'sales',
        departmentId: 'dept_1',
        mode: 'manual',
        status: 'active',
      } as any,
    ),
    false,
  )
})

test('areMemberFiltersEqual matches all filter fields', () => {
  assert.equal(
    areMemberFiltersEqual(
      {
        q: 'ana',
        role: 'manager',
        status: 'all',
      } as any,
      {
        q: 'ana',
        role: 'manager',
        status: 'all',
      } as any,
    ),
    true,
  )

  assert.equal(
    areMemberFiltersEqual(
      {
        q: 'ana',
        role: 'manager',
        status: 'all',
      } as any,
      {
        q: 'ana',
        role: 'member',
        status: 'all',
      } as any,
    ),
    false,
  )
})

test('formatMemberDepartments returns readable fallback and list', () => {
  assert.equal(formatMemberDepartments([]), 'No department')
  assert.equal(
    formatMemberDepartments([{ name: 'Sales' }, { name: 'Service' }]),
    'Sales, Service',
  )
})
