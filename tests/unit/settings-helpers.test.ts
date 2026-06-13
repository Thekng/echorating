import test from 'node:test'
import assert from 'node:assert/strict'
import {
  areMemberFiltersEqual,
  areMetricFiltersEqual,
  formatMemberDepartments,
} from '../../features/settings/helpers'

test('areMetricFiltersEqual matches all filter fields', () => {
  assert.equal(
    areMetricFiltersEqual(
      {
        q: 'sales',
        departmentId: 'all',
        status: 'active',
      },
      {
        q: 'sales',
        departmentId: 'all',
        status: 'active',
      },
    ),
    true,
  )

  assert.equal(
    areMetricFiltersEqual(
      {
        q: 'sales',
        departmentId: 'all',
        status: 'active',
      },
      {
        q: 'sales',
        departmentId: 'dept_1',
        status: 'active',
      },
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
      },
      {
        q: 'ana',
        role: 'manager',
      },
    ),
    true,
  )

  assert.equal(
    areMemberFiltersEqual(
      {
        q: 'ana',
        role: 'manager',
      },
      {
        q: 'ana',
        role: 'member',
      },
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
