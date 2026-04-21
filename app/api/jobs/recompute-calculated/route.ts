import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recomputeCalculatedMetricsForEntry } from '@/features/daily-log/calculated-recompute'

// Never cached; this is an on-demand queue drain.
export const dynamic = 'force-dynamic'
export const revalidate = 0

const BATCH_LIMIT = 25
const MAX_ATTEMPTS = 5

type ClaimedJob = {
  job_id: string
  entry_id: string
  company_id: string
  department_id: string
  attempts: number
}

function authorized(req: NextRequest) {
  const secret = process.env.CALC_WORKER_SECRET
  if (!secret) {
    // Deliberately open in dev if unset; in production, require the header.
    return process.env.NODE_ENV !== 'production'
  }

  const header = req.headers.get('authorization')
  return header === `Bearer ${secret}`
}

async function drainOnce() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { processed: 0, failed: 0, error: 'SUPABASE_SERVICE_ROLE_KEY missing' as const }
  }

  const admin = createAdminClient()

  const { data: claimed, error: claimError } = await admin.rpc('claim_calculated_recompute_jobs', {
    p_limit: BATCH_LIMIT,
    p_max_attempts: MAX_ATTEMPTS,
  })

  if (claimError) {
    return { processed: 0, failed: 0, error: claimError.message }
  }

  const jobs = (claimed ?? []) as ClaimedJob[]
  if (jobs.length === 0) {
    return { processed: 0, failed: 0 }
  }

  let processed = 0
  let failed = 0

  for (const job of jobs) {
    const result = await recomputeCalculatedMetricsForEntry(
      admin,
      job.company_id,
      job.department_id,
      job.entry_id,
    )

    const { error: completeError } = await admin.rpc('complete_calculated_recompute_job', {
      p_job_id: job.job_id,
      p_error: result.ok ? null : result.message,
    })

    if (completeError) {
      // We logically failed even if the recompute succeeded — the job row still
      // counts as in-flight until a later attempt cleans it up.
      failed += 1
      continue
    }

    if (result.ok) {
      processed += 1
    } else {
      failed += 1
    }
  }

  return { processed, failed }
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const summary = await drainOnce()
  return NextResponse.json(summary)
}

// Vercel Cron hits GET by default.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const summary = await drainOnce()
  return NextResponse.json(summary)
}
