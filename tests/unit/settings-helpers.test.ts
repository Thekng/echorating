import test from 'node:test'
import assert from 'node:assert/strict'
import {
  areMemberFiltersEqual,
  areMetricFiltersEqual,
  formatMemberDepartments,
  type MetricFiltersState,
  type MemberFiltersState,
} from '../../features/settings/helpers.ts'

test('areMetricFiltersEqual matches all filter fields', () => {
  assert.equal(
    areMetricFiltersEqual(
      {
        q: 'sales',
        departmentId: 'all',
        mode: 'manual',
        status: 'active',
      } as unknown as MetricFiltersState,
      {
        q: 'sales',
        departmentId: 'all',
        mode: 'manual',
        status: 'active',
      } as unknown as MetricFiltersState,
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
      } as unknown as MetricFiltersState,
      {
        q: 'sales',
        departmentId: 'dept_1',
        mode: 'manual',
        status: 'active',
      } as unknown as MetricFiltersState,
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
      } as unknown as MemberFiltersState,
      {
        q: 'ana',
        role: 'manager',
        status: 'all',
      } as unknown as MemberFiltersState,
    ),
    true,
  )

  assert.equal(
    areMemberFiltersEqual(
      {
        q: 'ana',
        role: 'manager',
        status: 'all',
      } as unknown as MemberFiltersState,
      {
        q: 'ana',
        role: 'member',
        status: 'all',
      } as unknown as MemberFiltersState,
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
