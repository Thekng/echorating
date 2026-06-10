import React from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TourProvider } from '@/components/tour/tour-provider'
import { getSessionClaims } from '@/lib/supabase/session-claims'

async function getSidebarData() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { name: null, role: 'member' }
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { name: null, role: 'member' }
  }

  const claims = getSessionClaims(user)

  if (!claims.active_organization_id) {
    return { name: null, role: 'member' }
  }

  const { data: membership } = await admin
    .from('organization_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', claims.active_organization_id)
    .maybeSingle()

  if (!membership?.role) {
    return { name: null, role: 'member' }
  }

  const { data: organization } = await admin
    .from('organizations')
    .select('name')
    .eq('id', claims.active_organization_id)
    .maybeSingle()

  return {
    name: typeof organization?.name === 'string' ? organization.name : null,
    role: membership.role || 'member'
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { name: companyName, role } = await getSidebarData()
  return (
    <TourProvider userRole={role}>
      <AppShell companyName={companyName}>{children}</AppShell>
    </TourProvider>
  )
}
