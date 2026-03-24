import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { InviteSessionResolver } from '@/components/auth/invite-session-resolver'
import { InviteAcceptForm } from '@/components/auth/invite-accept-form'
import { formatDatabaseError } from '@/lib/supabase/error-messages'

const INVALID_INVITE_MESSAGE = 'This invite link is invalid or has expired. Please ask to be invited again.'

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
  const { data: invitation, error: invitationError } = await admin
    .from('invitations')
    .select('invitation_id, company_id, role, auth_user_id, status, expires_at, companies ( name )')
    .eq('auth_user_id', user.id)
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()

  if (invitationError) {
    console.error('Invite lookup error:', formatDatabaseError(invitationError.message))
    return <InvalidInviteState />
  }

  if (!invitation) {
    return <InvalidInviteState />
  }

  const companyRelation = invitation.companies
  const companyName = Array.isArray(companyRelation)
    ? (companyRelation[0]?.name ?? 'your company')
    : (companyRelation?.name ?? 'your company')

  return <InviteAcceptForm invitationId={invitation.invitation_id} companyName={companyName} role={invitation.role} />
}
