export function InviteMemberTemplate({
  inviteeName,
  inviterName,
  companyName,
  role,
  inviteUrl,
}: {
  inviteeName: string
  inviterName: string
  companyName: string
  role: 'manager' | 'member'
  inviteUrl: string
}) {
  const roleLabel = role === 'manager' ? 'Manager' : 'Member'

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827; line-height: 1.6;">
      <h2 style="margin-bottom: 16px;">You're invited to join ${companyName}</h2>
      <p>Hi ${inviteeName},</p>
      <p>${inviterName} invited you to join ${companyName} on EchoRating as a ${roleLabel}.</p>
      <p>Use the button below to accept your invitation.</p>
      <p style="margin: 24px 0;">
        <a
          href="${inviteUrl}"
          style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600;"
        >
          Accept Invitation
        </a>
      </p>
      <p>If the button does not work, open this link:</p>
      <p><a href="${inviteUrl}">${inviteUrl}</a></p>
    </div>
  `
}
