/* eslint-disable */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

type CliOptions = {
  companyId?: string
  json: boolean
  strict: boolean
}

type CompanyRow = {
  company_id: string
  name: string
  owner_user_id: string
  contact_email: string | null
  is_active: boolean
  deleted_at: string | null
}

type ProfileRelation =
  | {
      name: string | null
      is_active: boolean | null
      deleted_at: string | null
    }
  | Array<{
      name: string | null
      is_active: boolean | null
      deleted_at: string | null
    }>
  | null

type CompanyMemberRow = {
  company_id: string
  user_id: string
  role: 'owner' | 'manager' | 'member'
  is_active: boolean
  profiles: ProfileRelation
}

type DepartmentRow = {
  department_id: string
  company_id: string
  name: string
  is_active: boolean
  deleted_at: string | null
}

type DepartmentMemberRow = {
  department_id: string
  user_id: string
  member_role: 'lead' | 'member'
  is_active: boolean
  deleted_at: string | null
}

type DailyEntryRow = {
  entry_id: string
  company_id: string
  department_id: string
  user_id: string
  entry_date: string
  status: 'draft' | 'submitted'
}

type AuthUserSnapshot = {
  userId: string
  email: string | null
  name: string | null
}

type AuditSeverity = 'error' | 'warning'

type AuditIssue = {
  severity: AuditSeverity
  type: string
  companyId: string | null
  companyName: string | null
  userId?: string
  departmentId?: string
  entryId?: string
  detail: string
}

for (const envFile of ['.env.local', '.env']) {
  const envPath = resolve(process.cwd(), envFile)
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false })
  }
}

function requiredEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseOptions(): CliOptions {
  const options: CliOptions = {
    json: false,
    strict: false,
  }

  for (const arg of process.argv.slice(2)) {
    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--strict') {
      options.strict = true
      continue
    }

    if (arg.startsWith('--company-id=')) {
      options.companyId = arg.slice('--company-id='.length).trim() || undefined
    }
  }

  return options
}

async function fetchAll<T>(buildQuery: () => any, pageSize = 1000): Promise<T[]> {
  let from = 0
  const rows: T[] = []

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) {
      throw new Error(error.message)
    }

    const page = (data ?? []) as T[]
    rows.push(...page)

    if (page.length < pageSize) {
      break
    }

    from += pageSize
  }

  return rows
}

function normalizeProfileRelation(profile: ProfileRelation) {
  if (Array.isArray(profile)) {
    return profile[0] ?? null
  }

  return profile
}

function keyForCompanyUser(companyId: string, userId: string) {
  return `${companyId}:${userId}`
}

function keyForDepartmentUser(departmentId: string, userId: string) {
  return `${departmentId}:${userId}`
}

function lower(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

async function loadOwnerAuthSnapshots(admin: any, ownerUserIds: string[]) {
  const snapshots = new Map<string, AuthUserSnapshot>()

  await Promise.all(
    ownerUserIds.map(async (userId) => {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error) {
        snapshots.set(userId, { userId, email: null, name: null })
        return
      }

      const authUser = data.user
      const authName =
        typeof authUser?.user_metadata?.name === 'string' ? authUser.user_metadata.name.trim() : null

      snapshots.set(userId, {
        userId,
        email: authUser?.email?.trim() ?? null,
        name: authName,
      })
    }),
  )

  return snapshots
}

function printTextSummary(summary: {
  companies: CompanyRow[]
  companyMembers: CompanyMemberRow[]
  departments: DepartmentRow[]
  departmentMembers: DepartmentMemberRow[]
  dailyEntries: DailyEntryRow[]
  issues: AuditIssue[]
}) {
  const bySeverity = new Map<AuditSeverity, number>([
    ['error', 0],
    ['warning', 0],
  ])
  const byType = new Map<string, number>()
  const byCompany = new Map<string, number>()

  for (const issue of summary.issues) {
    bySeverity.set(issue.severity, (bySeverity.get(issue.severity) ?? 0) + 1)
    byType.set(issue.type, (byType.get(issue.type) ?? 0) + 1)
    const companyKey = issue.companyId ?? 'global'
    byCompany.set(companyKey, (byCompany.get(companyKey) ?? 0) + 1)
  }

  console.log('tenant integrity audit')
  console.log(`companies:          ${summary.companies.length}`)
  console.log(`company_members:    ${summary.companyMembers.length}`)
  console.log(`departments:        ${summary.departments.length}`)
  console.log(`department_members: ${summary.departmentMembers.length}`)
  console.log(`daily_entries:      ${summary.dailyEntries.length}`)
  console.log(`issues:             ${summary.issues.length}`)
  console.log(`  errors:           ${bySeverity.get('error') ?? 0}`)
  console.log(`  warnings:         ${bySeverity.get('warning') ?? 0}`)

  if (summary.issues.length === 0) {
    console.log('result: clean')
    return
  }

  console.log('')
  console.log('issue counts by type:')
  for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
    console.log(`  ${type}: ${count}`)
  }

  console.log('')
  console.log('issues:')
  for (const issue of summary.issues) {
    const scope = [
      issue.companyName ?? issue.companyId ?? 'global',
      issue.departmentId ? `department=${issue.departmentId}` : null,
      issue.userId ? `user=${issue.userId}` : null,
      issue.entryId ? `entry=${issue.entryId}` : null,
    ]
      .filter(Boolean)
      .join(' | ')

    console.log(`  [${issue.severity}] ${issue.type} :: ${scope} :: ${issue.detail}`)
  }
}

async function main() {
  const options = parseOptions()
  const admin = createClient(
    requiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const companies = await fetchAll<CompanyRow>(() => {
    let query = admin
      .from('companies')
      .select('company_id, name, owner_user_id, contact_email, is_active, deleted_at')
      .order('company_id', { ascending: true })

    if (options.companyId) {
      query = query.eq('company_id', options.companyId)
    }

    return query
  })

  if (companies.length === 0) {
    throw new Error(options.companyId ? `Company not found: ${options.companyId}` : 'No companies found.')
  }

  const companyMembers = await fetchAll<CompanyMemberRow>(() => {
    let query = admin
      .from('company_members')
      .select('company_id, user_id, role, is_active, profiles(name, is_active, deleted_at)')
      .order('company_id', { ascending: true })
      .order('user_id', { ascending: true })

    if (options.companyId) {
      query = query.eq('company_id', options.companyId)
    }

    return query
  })

  const departments = await fetchAll<DepartmentRow>(() => {
    let query = admin
      .from('departments')
      .select('department_id, company_id, name, is_active, deleted_at')
      .order('company_id', { ascending: true })
      .order('department_id', { ascending: true })

    if (options.companyId) {
      query = query.eq('company_id', options.companyId)
    }

    return query
  })

  const departmentIds = departments.map((department) => department.department_id)
  const departmentMembers =
    departmentIds.length === 0
      ? []
      : await fetchAll<DepartmentMemberRow>(() =>
          admin
            .from('department_members')
            .select('department_id, user_id, member_role, is_active, deleted_at')
            .in('department_id', departmentIds)
            .order('department_id', { ascending: true })
            .order('user_id', { ascending: true }),
        )

  const dailyEntries = await fetchAll<DailyEntryRow>(() => {
    let query = admin
      .from('daily_entries')
      .select('entry_id, company_id, department_id, user_id, entry_date, status')
      .order('company_id', { ascending: true })
      .order('entry_id', { ascending: true })

    if (options.companyId) {
      query = query.eq('company_id', options.companyId)
    }

    return query
  })

  const companyById = new Map(companies.map((company) => [company.company_id, company]))
  const departmentById = new Map(departments.map((department) => [department.department_id, department]))
  const activeCompanyMembershipByKey = new Map<string, CompanyMemberRow>()
  const activeOwnerMembershipsByCompany = new Map<string, CompanyMemberRow[]>()
  const activeDepartmentMembershipByKey = new Set<string>()
  const activeDepartmentMembershipCountByCompanyUser = new Map<string, number>()

  for (const membership of companyMembers) {
    if (!membership.is_active) continue
    activeCompanyMembershipByKey.set(keyForCompanyUser(membership.company_id, membership.user_id), membership)

    if (membership.role === 'owner') {
      const existing = activeOwnerMembershipsByCompany.get(membership.company_id) ?? []
      existing.push(membership)
      activeOwnerMembershipsByCompany.set(membership.company_id, existing)
    }
  }

  for (const membership of departmentMembers) {
    if (!membership.is_active || membership.deleted_at) continue
    activeDepartmentMembershipByKey.add(keyForDepartmentUser(membership.department_id, membership.user_id))

    const department = departmentById.get(membership.department_id)
    if (!department) continue

    const companyUserKey = keyForCompanyUser(department.company_id, membership.user_id)
    activeDepartmentMembershipCountByCompanyUser.set(
      companyUserKey,
      (activeDepartmentMembershipCountByCompanyUser.get(companyUserKey) ?? 0) + 1,
    )
  }

  const ownerAuthSnapshots = await loadOwnerAuthSnapshots(
    admin,
    [...new Set(companies.map((company) => company.owner_user_id))],
  )

  const issues: AuditIssue[] = []
  function pushIssue(issue: AuditIssue) {
    issues.push(issue)
  }

  for (const company of companies) {
    const companyName = company.name
    const ownerMemberships = activeOwnerMembershipsByCompany.get(company.company_id) ?? []
    const ownerMembership = activeCompanyMembershipByKey.get(keyForCompanyUser(company.company_id, company.owner_user_id))

    if (!ownerMembership) {
      pushIssue({
        severity: 'error',
        type: 'owner_missing_company_membership',
        companyId: company.company_id,
        companyName,
        userId: company.owner_user_id,
        detail: 'companies.owner_user_id has no active company_members row.',
      })
    } else if (ownerMembership.role !== 'owner') {
      pushIssue({
        severity: 'error',
        type: 'owner_membership_role_mismatch',
        companyId: company.company_id,
        companyName,
        userId: company.owner_user_id,
        detail: `Owner membership role is ${ownerMembership.role}, expected owner.`,
      })
    }

    if (ownerMemberships.length > 1) {
      pushIssue({
        severity: 'error',
        type: 'multiple_active_company_owners',
        companyId: company.company_id,
        companyName,
        detail: `Found ${ownerMemberships.length} active owner memberships for one company.`,
      })
    }

    const authSnapshot = ownerAuthSnapshots.get(company.owner_user_id)
    const ownerProfile = normalizeProfileRelation(ownerMembership?.profiles ?? null)

    if (!authSnapshot?.email) {
      pushIssue({
        severity: 'error',
        type: 'owner_missing_auth_user',
        companyId: company.company_id,
        companyName,
        userId: company.owner_user_id,
        detail: 'Owner auth user could not be loaded via service role.',
      })
    } else if (company.contact_email && lower(company.contact_email) !== lower(authSnapshot.email)) {
      pushIssue({
        severity: 'warning',
        type: 'company_contact_email_mismatch',
        companyId: company.company_id,
        companyName,
        userId: company.owner_user_id,
        detail: `companies.contact_email=${company.contact_email} but owner auth email=${authSnapshot.email}.`,
      })
    }

    if (ownerProfile?.name && authSnapshot?.name && lower(ownerProfile.name) !== lower(authSnapshot.name)) {
      pushIssue({
        severity: 'warning',
        type: 'owner_profile_name_mismatch',
        companyId: company.company_id,
        companyName,
        userId: company.owner_user_id,
        detail: `profiles.name=${ownerProfile.name} but auth metadata name=${authSnapshot.name}.`,
      })
    }
  }

  for (const membership of companyMembers) {
    if (!membership.is_active) continue

    const company = companyById.get(membership.company_id)
    const profile = normalizeProfileRelation(membership.profiles)
    if (!profile) {
      pushIssue({
        severity: 'error',
        type: 'company_member_missing_profile',
        companyId: membership.company_id,
        companyName: company?.name ?? null,
        userId: membership.user_id,
        detail: 'Active company member has no related profile row.',
      })
      continue
    }

    if (profile.deleted_at || profile.is_active === false) {
      pushIssue({
        severity: 'warning',
        type: 'company_member_profile_inactive',
        companyId: membership.company_id,
        companyName: company?.name ?? null,
        userId: membership.user_id,
        detail: 'Company member is active but related profile is inactive or soft-deleted.',
      })
    }

    if (membership.role === 'member') {
      const departmentCount =
        activeDepartmentMembershipCountByCompanyUser.get(keyForCompanyUser(membership.company_id, membership.user_id)) ?? 0
      if (departmentCount === 0) {
        pushIssue({
          severity: 'warning',
          type: 'member_without_department_assignment',
          companyId: membership.company_id,
          companyName: company?.name ?? null,
          userId: membership.user_id,
          detail: 'Active member has no active department membership.',
        })
      }
    }
  }

  for (const membership of departmentMembers) {
    if (!membership.is_active || membership.deleted_at) continue

    const department = departmentById.get(membership.department_id)
    if (!department) {
      pushIssue({
        severity: 'error',
        type: 'department_member_missing_department',
        companyId: null,
        companyName: null,
        userId: membership.user_id,
        departmentId: membership.department_id,
        detail: 'Active department membership points to a missing department.',
      })
      continue
    }

    const company = companyById.get(department.company_id)
    const companyMembership = activeCompanyMembershipByKey.get(keyForCompanyUser(department.company_id, membership.user_id))
    if (!companyMembership) {
      pushIssue({
        severity: 'error',
        type: 'department_member_missing_company_membership',
        companyId: department.company_id,
        companyName: company?.name ?? null,
        userId: membership.user_id,
        departmentId: membership.department_id,
        detail: `Department member belongs to ${department.name} but has no active company_members row.`,
      })
    }

    if (!department.is_active || department.deleted_at) {
      pushIssue({
        severity: 'warning',
        type: 'active_member_on_inactive_department',
        companyId: department.company_id,
        companyName: company?.name ?? null,
        userId: membership.user_id,
        departmentId: membership.department_id,
        detail: `Department membership is active while department ${department.name} is inactive or deleted.`,
      })
    }
  }

  for (const entry of dailyEntries) {
    const company = companyById.get(entry.company_id)
    const department = departmentById.get(entry.department_id)

    if (!department) {
      pushIssue({
        severity: 'error',
        type: 'daily_entry_missing_department',
        companyId: entry.company_id,
        companyName: company?.name ?? null,
        userId: entry.user_id,
        departmentId: entry.department_id,
        entryId: entry.entry_id,
        detail: `Daily entry ${entry.entry_date} points to a missing department.`,
      })
      continue
    }

    if (department.company_id !== entry.company_id) {
      pushIssue({
        severity: 'error',
        type: 'daily_entry_company_department_mismatch',
        companyId: entry.company_id,
        companyName: company?.name ?? null,
        userId: entry.user_id,
        departmentId: entry.department_id,
        entryId: entry.entry_id,
        detail: `Daily entry company_id does not match department.company_id (${department.company_id}).`,
      })
    }

    const companyMembership = activeCompanyMembershipByKey.get(keyForCompanyUser(entry.company_id, entry.user_id))
    if (!companyMembership) {
      pushIssue({
        severity: 'error',
        type: 'daily_entry_missing_company_membership',
        companyId: entry.company_id,
        companyName: company?.name ?? null,
        userId: entry.user_id,
        departmentId: entry.department_id,
        entryId: entry.entry_id,
        detail: `Daily entry ${entry.entry_date} belongs to a user with no active company_members row.`,
      })
    }

    if (!activeDepartmentMembershipByKey.has(keyForDepartmentUser(entry.department_id, entry.user_id))) {
      pushIssue({
        severity: 'warning',
        type: 'daily_entry_missing_department_membership',
        companyId: entry.company_id,
        companyName: company?.name ?? null,
        userId: entry.user_id,
        departmentId: entry.department_id,
        entryId: entry.entry_id,
        detail: `Daily entry ${entry.entry_date} belongs to a user with no active membership in the referenced department.`,
      })
    }
  }

  const summary = {
    companies,
    companyMembers,
    departments,
    departmentMembers,
    dailyEntries,
    issues: issues.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === 'error' ? -1 : 1
      }
      return `${a.companyName ?? ''}:${a.type}:${a.userId ?? ''}`.localeCompare(
        `${b.companyName ?? ''}:${b.type}:${b.userId ?? ''}`,
      )
    }),
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          summary: {
            companies: companies.length,
            companyMembers: companyMembers.length,
            departments: departments.length,
            departmentMembers: departmentMembers.length,
            dailyEntries: dailyEntries.length,
            issues: summary.issues.length,
          },
          issues: summary.issues,
        },
        null,
        2,
      ),
    )
  } else {
    printTextSummary(summary)
  }

  if (options.strict && summary.issues.length > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
