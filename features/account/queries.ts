'use server'

import { getActorContext } from '@/lib/supabase/actor-context'
import { createClient } from '@/lib/supabase/server'

export type AccountData = {
  fullName: string
  email: string
  organizationName: string
  role: string
  departments: Array<{ id: string; name: string }>
}

export async function getAccountData(): Promise<{ success: true; data: AccountData } | { success: false; error: string }> {
  const context = await getActorContext()
  if (!context.ok) {
    return { success: false, error: context.message }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Authentication required.' }
  }

  const [{ data: profile }, { data: organization }, { data: departmentMemberships }] = await Promise.all([
    context.admin.from('profiles').select('full_name').eq('id', context.userId).maybeSingle(),
    context.admin.from('organizations').select('name').eq('id', context.organizationId).maybeSingle(),
    context.admin
      .from('department_members')
      .select('department_id, departments!inner(name)')
      .eq('user_id', context.userId),
  ])

  const departments = (
    (departmentMemberships ?? []) as unknown as Array<{ department_id: string; departments: { name: string } }>
  ).map((dm) => ({
    id: dm.department_id,
    name: dm.departments.name,
  }))

  return {
    success: true,
    data: {
      fullName: (profile?.full_name as string) || '',
      email: user.email ?? '',
      organizationName: (organization?.name as string) || '',
      role: context.role,
      departments,
    },
  }
}
