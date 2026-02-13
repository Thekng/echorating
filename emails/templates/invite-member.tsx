export function InviteMemberTemplate({
  name,
  companyName,
  inviteUrl,
}: {
  name: string
  companyName: string
  inviteUrl: string
}) {
  return `
    <h2>Welcome to ${companyName}</h2>
    <p>Hi ${name},</p>
    <p>You have been invited to join our team on EchoRating.</p>
    <p><a href="${inviteUrl}">Accept Invitation</a></p>
  `
}
