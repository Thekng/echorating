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

  if (!claims.active_company_id) {
    return { name: null, role: 'member' }
  }

  const { data: membership } = await admin
    .from('company_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('company_id', claims.active_company_id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.role) {
    return { name: null, role: 'member' }
  }

  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('company_id', claims.active_company_id)
    .maybeSingle()

  return {
    name: typeof company?.name === 'string' ? company.name : null,
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
