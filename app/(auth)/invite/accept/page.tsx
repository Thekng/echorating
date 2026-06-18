import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteSessionResolver } from '@/components/auth/invite-session-resolver'
import { InviteAcceptForm } from '@/components/auth/invite-accept-form'

const INVALID_INVITE_MESSAGE = 'This invite link is invalid or has expired. Please ask to be invited again.'
type CompanyRelation = { name: string | null } | Array<{ name: string | null }> | null

function getCompanyName(companies: CompanyRelation) {
  if (Array.isArray(companies)) {
    return companies[0]?.name ?? 'your company'
  }

  return companies?.name ?? 'your company'
}

function InvalidInviteState() {
  return (
    <section className="w-full max-w-md rounded-xl border bg-card p-6 text-card-foreground shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight">Invite unavailable</h1>
      <p className="mt-2 text-sm text-muted-foreground">{INVALID_INVITE_MESSAGE}</p>
    </section>
  )
}

export default async function InviteAcceptPage() {
  const supabase = await createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return <InvalidInviteState />
  }

  if (!user) {
    return <InviteSessionResolver />
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return <InvalidInviteState />
  }

  const admin = createAdminClient()
  const userEmail = user.email?.toLowerCase() ?? ''

  const { data: invitation, error: invitationError } = await admin
    .from('invitations')
    .select('invitation_id, company_id, role, auth_user_id, status, expires_at, email, companies ( name )')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .or(`auth_user_id.eq.${user.id}${userEmail ? `,email.eq.${userEmail}` : ''}`)
    .limit(1)
    .maybeSingle()

  if (invitationError) {
    console.error('[DB_ERROR] Invite lookup:', invitationError.message)
    return <InvalidInviteState />
  }

  if (!invitation) {
    return <InvalidInviteState />
  }

  const { data: existingMembership } = await admin
    .from('company_members')
    .select('user_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const isExistingUser = Boolean(existingMembership)
  const companyName = getCompanyName(invitation.companies as CompanyRelation)

  return (
    <InviteAcceptForm
      invitationId={invitation.invitation_id}
      companyName={companyName}
      role={invitation.role}
      isExistingUser={isExistingUser}
    />
  )
}
