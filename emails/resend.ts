import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy')
const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@echorating.app'
const resendFromName = process.env.RESEND_FROM_NAME?.trim()
const resendFrom = resendFromName ? `${resendFromName} <${resendFromEmail}>` : resendFromEmail

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  try {
    const result = await resend.emails.send({
      from: resendFrom,
      to,
      subject,
      html,
    })
    return { success: true, data: result }
  } catch (error) {
    console.error('Email send error:', error)
    return { success: false, error }
  }
}
