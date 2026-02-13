export const PERMISSIONS = {
  // Company
  VIEW_COMPANY: 'view:company',
  EDIT_COMPANY: 'edit:company',

  // Members
  VIEW_MEMBERS: 'view:members',
  INVITE_MEMBER: 'invite:member',
  EDIT_MEMBER: 'edit:member',
  REMOVE_MEMBER: 'remove:member',

  // Departments
  VIEW_DEPARTMENTS: 'view:departments',
  CREATE_DEPARTMENT: 'create:department',
  EDIT_DEPARTMENT: 'edit:department',
  DELETE_DEPARTMENT: 'delete:department',

  // Metrics & Targets
  VIEW_METRICS: 'view:metrics',
  EDIT_METRICS: 'edit:metrics',
  VIEW_TARGETS: 'view:targets',
  EDIT_TARGETS: 'edit:targets',

  // Analytics
  VIEW_DASHBOARD: 'view:dashboard',
  VIEW_LEADERBOARD: 'view:leaderboard',
  VIEW_REPORTS: 'view:reports',
}

export const rolePermissions: Record<string, string[]> = {
  owner: Object.values(PERMISSIONS),
  manager: [
    PERMISSIONS.VIEW_COMPANY,
    PERMISSIONS.VIEW_MEMBERS,
    PERMISSIONS.VIEW_DEPARTMENTS,
    PERMISSIONS.VIEW_METRICS,
    PERMISSIONS.VIEW_TARGETS,
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LEADERBOARD,
    PERMISSIONS.VIEW_REPORTS,
  ],
  member: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_LEADERBOARD,
  ],
}
