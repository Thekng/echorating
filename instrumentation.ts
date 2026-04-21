// Next.js loads this file once per runtime. We hand Sentry setup off to
// runtime-specific config so the server/edge builds don't drag browser code in.

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return
  }

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  } else if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string
    method: string
    headers: Record<string, string | undefined>
  },
) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(err, request, {
    routerKind: 'App Router',
    routePath: request.path,
    routeType: 'route',
  })
}
