import React from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { TourProvider } from '@/components/tour/tour-provider'

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

  const { data: profile } = await admin
    .from('profiles')
    .select('company_id, role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.company_id) {
    return { name: null, role: profile?.role || 'member' }
  }

  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  return {
    name: typeof company?.name === 'string' ? company.name : null,
    role: profile.role || 'member'
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
