export type Role = 'admin' | 'manager' | 'agent'

export const roleHierarchy: Record<Role, number> = {
  admin: 3,
  manager: 2,
  agent: 1,
}

export function hasPermission(userRole: Role, requiredRole: Role): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole]
}
