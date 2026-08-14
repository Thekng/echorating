export type MetricFiltersState = {
  q: string
  departmentId: string
  mode?: string
  status: 'all' | 'active' | 'inactive'
}

export type MemberFiltersState = {
  q: string
  role: 'all' | 'owner' | 'admin' | 'manager' | 'member'
  status?: string
}

export function areMetricFiltersEqual(a: MetricFiltersState, b: MetricFiltersState) {
  return a.q === b.q && a.departmentId === b.departmentId && a.status === b.status
}

export function areMemberFiltersEqual(a: MemberFiltersState, b: MemberFiltersState) {
  return a.q === b.q && a.role === b.role
}

export function formatMemberDepartments(departments: Array<{ name: string }>) {
  if (!departments.length) {
    return 'No department'
  }

  return departments.map((department) => department.name).join(', ')
}
