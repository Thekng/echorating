import React from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TourProvider } from '@/components/tour/tour-provider'
import { getSessionClaims } from '@/lib/supabase/session-claims'
import { hasPermission, isRole } from '@/lib/rbac/roles'
import { getTodaySubmissionStatus } from '@/features/daily-log/submission-status'

async function getSidebarData() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { name: null, role: 'member', userName: null, userEmail: null, hasSubmittedToday: undefined as boolean | undefined }
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { name: null, role: 'member', userName: null, userEmail: null, hasSubmittedToday: undefined as boolean | undefined }
  }

  const claims = getSessionClaims(user)

  if (!claims.active_organization_id) {
    return { name: null, role: 'member', userName: null, userEmail: user.email ?? null, hasSubmittedToday: undefined as boolean | undefined }
  }

  const [{ data: membership }, { data: organization }, { data: profile }] = await Promise.all([
    admin
      .from('organization_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', claims.active_organization_id)
      .maybeSingle(),
    admin
      .from('organizations')
      .select('name')
      .eq('id', claims.active_organization_id)
      .maybeSingle(),
    admin
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  if (!membership?.role) {
    return { name: null, role: 'member', userName: null, userEmail: user.email ?? null, hasSubmittedToday: undefined as boolean | undefined }
  }

  const role = membership.role || 'member'

  // For members, check if they submitted today's log
  let hasSubmittedToday: boolean | undefined = undefined
  if (isRole(role) && !hasPermission(role, 'manager')) {
    const status = await getTodaySubmissionStatus(admin, claims.active_organization_id, user.id)
    hasSubmittedToday = status.hasSubmittedToday
  }

  return {
    name: typeof organization?.name === 'string' ? organization.name : null,
    role,
    userName: typeof profile?.full_name === 'string' ? profile.full_name : null,
    userEmail: user.email ?? null,
    hasSubmittedToday,
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { name: companyName, role, userName, userEmail, hasSubmittedToday } = await getSidebarData()
  return (
    <TourProvider userRole={role}>
      <AppShell companyName={companyName} userRole={role} userName={userName} userEmail={userEmail} hasSubmittedToday={hasSubmittedToday}>{children}</AppShell>
    </TourProvider>
  )
}
