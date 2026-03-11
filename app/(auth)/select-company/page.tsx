import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'
import { SelectCompanyForm } from '@/components/auth/select-company-form'

type CompanyRelation = { name: string | null } | Array<{ name: string | null }> | null

type CompanyMembership = {
  company_id: string
  role: string
  companies: CompanyRelation
}

function getCompanyName(companies: CompanyRelation) {
  if (Array.isArray(companies)) {
    return companies[0]?.name ?? 'Unknown Company'
  }

  return companies?.name ?? 'Unknown Company'
}

export default async function SelectCompanyPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect(ROUTES.LOGIN)
  }

  // Fetch all companies the user is a member of
  const { data: memberships, error } = await supabase
    .from('company_members')
    .select('role, company_id, companies (name)')
    .eq('user_id', user.id)

  if (error || !memberships) {
    return (
      <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight text-destructive">Error Loading Companies</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There was an error loading your company memberships. Please try again.
        </p>
      </section>
    )
  }

  const companies = (memberships as CompanyMembership[]).map((membership) => ({
    company_id: membership.company_id,
    name: getCompanyName(membership.companies),
    role: membership.role
  }))

  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Select Company</h1>
      <p className="mt-2 mb-6 text-sm text-muted-foreground">
        You belong to multiple companies. Choose which one to continue with.
      </p>

      <SelectCompanyForm companies={companies} />
    </section>
  )
}
