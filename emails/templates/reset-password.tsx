export function ResetPasswordTemplate({
  name,
  resetUrl,
}: {
  name: string
  resetUrl: string
}) {
  return `
    <h2>Reset Your Password</h2>
    <p>Hi ${name},</p>
    <p>Click the link below to reset your password:</p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p>This link expires in 24 hours.</p>
  `
}
