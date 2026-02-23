import React from 'react'
import { AppShell } from '@/components/layout/app-shell'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getSidebarCompanyName() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('company_id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.company_id) {
    return null
  }

  const { data: company } = await admin
    .from('companies')
    .select('name')
    .eq('company_id', profile.company_id)
    .maybeSingle()

  return typeof company?.name === 'string' ? company.name : null
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const companyName = await getSidebarCompanyName()
  return <AppShell companyName={companyName}>{children}</AppShell>
}
