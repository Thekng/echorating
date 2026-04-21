import { NextResponse } from 'next/server'
import { Webhook } from 'svix'

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET

export async function POST(request: Request) {
  if (!RESEND_WEBHOOK_SECRET) {
    console.error('RESEND_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  const svixId = request.headers.get('svix-id')
  const svixTimestamp = request.headers.get('svix-timestamp')
  const svixSignature = request.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing signature headers' }, { status: 401 })
  }

  const body = await request.text()

  let payload: unknown
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET)
    payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (err) {
    console.error('Resend webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = payload as { type: string; data: Record<string, unknown> }

  switch (event.type) {
    case 'email.delivered':
      console.log('Email delivered:', event.data.email_id)
      break
    case 'email.bounced':
      console.error('Email bounced:', event.data.email_id, event.data.bounce)
      break
    case 'email.complained':
      console.error('Email complaint:', event.data.email_id)
      break
    default:
      console.log('Unhandled Resend event:', event.type)
  }

  return NextResponse.json({ received: true })
}
