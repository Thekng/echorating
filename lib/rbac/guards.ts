import { Role, hasPermission } from './roles'

export function requireRole(userRole: Role, requiredRole: Role) {
  if (!hasPermission(userRole, requiredRole)) {
    throw new Error('Insufficient permissions')
  }
}

export function requireCompanyAccess(userCompanyId: string, resourceCompanyId: string) {
  if (userCompanyId !== resourceCompanyId) {
    throw new Error('Access denied')
  }
}
