import { Role, hasPermission, isRole } from './roles'

export function requireRole(userRole: Role | string, requiredRole: Role): asserts userRole is Role {
  if (!isRole(userRole)) {
    throw new Error('Invalid role')
  }

  if (!hasPermission(userRole, requiredRole)) {
    throw new Error('Insufficient permissions')
  }
}

export function requireCompanyAccess(userCompanyId: string, resourceCompanyId: string) {
  if (userCompanyId !== resourceCompanyId) {
    throw new Error('Access denied')
  }
}
