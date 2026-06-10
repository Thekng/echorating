import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionClaims } from '@/lib/supabase/session-claims'
import { redirect } from 'next/navigation'
import { ROUTES } from '@/lib/constants/routes'

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(ROUTES.LOGIN)
  }

  const claims = getSessionClaims(user)

  if (!claims.active_organization_id) {
    redirect(ROUTES.ONBOARDING_COMPANY)
  }

  const admin = createAdminClient()

  const [{ data: profile }, { data: organization }] = await Promise.all([
    admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    admin
      .from('organizations')
      .select('name')
      .eq('id', claims.active_organization_id)
      .maybeSingle(),
  ])

  const userName = profile?.full_name ?? user.email ?? 'User'
  const orgName = organization?.name ?? 'Unknown'
  const role = claims.active_role ?? 'member'

  return (
    <main className="mx-auto w-full max-w-2xl p-6 md:p-10">
      <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {userName}.
        </p>

        <dl className="mt-6 space-y-4">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Organization
            </dt>
            <dd className="mt-1 text-sm">{orgName}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Your Role
            </dt>
            <dd className="mt-1 text-sm capitalize">{role}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Email
            </dt>
            <dd className="mt-1 text-sm">{user.email}</dd>
          </div>
        </dl>
      </section>
    </main>
  )
}
