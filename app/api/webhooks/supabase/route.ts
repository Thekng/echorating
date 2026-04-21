import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

const SUPABASE_WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

function verifySupabaseWebhook(request: Request): boolean {
  if (!SUPABASE_WEBHOOK_SECRET) return false

  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false

  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader

  if (token.length !== SUPABASE_WEBHOOK_SECRET.length) return false

  try {
    const a = new TextEncoder().encode(token)
    const b = new TextEncoder().encode(SUPABASE_WEBHOOK_SECRET)
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  if (!SUPABASE_WEBHOOK_SECRET) {
    console.error('SUPABASE_WEBHOOK_SECRET is not configured')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  if (!verifySupabaseWebhook(request)) {
    console.error('Supabase webhook authorization failed')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const payload = await request.json() as {
    type: string
    table: string
    record: Record<string, unknown>
    old_record?: Record<string, unknown>
  }

  switch (payload.type) {
    case 'INSERT':
      console.log(`Supabase INSERT on ${payload.table}:`, payload.record.id)
      break
    case 'UPDATE':
      console.log(`Supabase UPDATE on ${payload.table}:`, payload.record.id)
      break
    case 'DELETE':
      console.log(`Supabase DELETE on ${payload.table}:`, payload.old_record?.id)
      break
    default:
      console.log('Unhandled Supabase webhook type:', payload.type)
  }

  return NextResponse.json({ received: true })
}
