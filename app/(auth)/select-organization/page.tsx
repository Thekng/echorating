import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { SelectOrganizationForm } from '@/components/auth/select-organization-form'

type OrganizationRelation = { name: string | null } | Array<{ name: string | null }> | null

type OrganizationMembership = {
  organization_id: string
  role: string
  organizations: OrganizationRelation
}

function getOrganizationName(organizations: OrganizationRelation) {
  if (Array.isArray(organizations)) {
    return organizations[0]?.name ?? 'Unknown Organization'
  }

  return organizations?.name ?? 'Unknown Organization'
}

export default async function SelectOrganizationPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect(ROUTES.LOGIN)
  }

  const { data: memberships, error } = await supabase
    .from('organization_members')
    .select('role, organization_id, organizations (name)')
    .eq('user_id', user.id)

  if (error || !memberships) {
    return (
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-destructive">Error Loading Organizations</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There was an error loading your organization memberships. Please try again.
        </p>
      </section>
    )
  }

  const organizations = (memberships as OrganizationMembership[]).map((membership) => ({
    organization_id: membership.organization_id,
    name: getOrganizationName(membership.organizations),
    role: membership.role
  }))

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Select Organization</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        You belong to multiple organizations. Choose which one to continue with.
      </p>

      <SelectOrganizationForm organizations={organizations} />
    </section>
  )
}
