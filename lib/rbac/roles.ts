export type Role = 'owner' | 'admin' | 'manager' | 'member'

export const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  manager: 2,
  member: 1,
}

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}

export function isRole(value: unknown): value is Role {
  return value === 'owner' || value === 'admin' || value === 'manager' || value === 'member'
}
