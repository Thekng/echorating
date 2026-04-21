// Best-effort trigger for the calculated-recompute worker. Called via
// `after()` from the save action so the user response is already flushed.
// Failure here is acceptable — the cron sweep picks up any job still pending.

function appBaseUrl() {
  const fromEnv =
    process.env.NEXT_PUBLIC_APP_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ??
    'http://localhost:3000'

  return fromEnv.endsWith('/') ? fromEnv.slice(0, -1) : fromEnv
}

export async function triggerCalculatedRecomputeWorker() {
  const secret = process.env.CALC_WORKER_SECRET
  if (!secret) {
    // Worker is disabled without a shared secret — the cron sweep still runs.
    return
  }

  try {
    await fetch(`${appBaseUrl()}/api/jobs/recompute-calculated`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${secret}`,
      },
      // Short abort window so we never keep the function alive waiting.
      signal: AbortSignal.timeout(2000),
    })
  } catch {
    // Swallow — cron will catch anything we missed.
  }
}
