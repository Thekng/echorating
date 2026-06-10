import { createClient } from '@/lib/supabase/server'
import { getSessionClaims } from '@/lib/supabase/session-claims'
import { type Role, hasPermission, isRole } from '@/lib/rbac/roles'

export async function getCurrentUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ?? null
}

export async function getCurrentProfile() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile ?? null
}

export async function getCurrentOrganization() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const claims = getSessionClaims(user)
  if (!claims.active_organization_id) return null

  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', claims.active_organization_id)
    .single()

  return organization ?? null
}

export async function getCurrentMembership() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const claims = getSessionClaims(user)
  if (!claims.active_organization_id) return null

  const { data: membership } = await supabase
    .from('organization_members')
    .select('*')
    .eq('user_id', user.id)
    .eq('organization_id', claims.active_organization_id)
    .single()

  return membership ?? null
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Authentication required.')
  }
  return user
}

export async function requireOrganization() {
  const user = await requireAuth()
  const claims = getSessionClaims(user)

  if (!claims.active_organization_id) {
    throw new Error('No active organization. Complete onboarding or select an organization.')
  }

  const supabase = await createClient()
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', claims.active_organization_id)
    .single()

  if (!organization) {
    throw new Error('Active organization not found.')
  }

  return { user, organization, claims }
}

export async function requireRole(minRole: Role) {
  const { user, organization, claims } = await requireOrganization()

  if (!claims.active_role || !hasPermission(claims.active_role, minRole)) {
    throw new Error(`Insufficient permissions. Requires at least ${minRole} role.`)
  }

  return { user, organization, role: claims.active_role }
}

export async function isOwner() {
  const membership = await getCurrentMembership()
  return membership?.role === 'owner'
}

export async function isAdmin() {
  const membership = await getCurrentMembership()
  return membership?.role === 'admin' || membership?.role === 'owner'
}

export async function isManager() {
  const membership = await getCurrentMembership()
  return isRole(membership?.role) && hasPermission(membership.role, 'manager')
}

export async function isMember() {
  const membership = await getCurrentMembership()
  return membership !== null
}
