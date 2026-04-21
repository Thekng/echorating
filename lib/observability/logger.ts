// Structured logger. Emits one JSON line per event to stdout so Vercel/Supabase
// log ingestion can index fields without regex. Keep the shape stable; dashboards
// depend on it.

type Level = 'debug' | 'info' | 'warn' | 'error'

export type LogContext = {
  requestId?: string | null
  userId?: string | null
  companyId?: string | null
  actionName?: string | null
  durationMs?: number
  outcome?: string
  [key: string]: unknown
}

type Entry = LogContext & {
  level: Level
  message: string
  timestamp: string
  commitSha?: string | null
}

function emit(level: Level, message: string, context: LogContext = {}) {
  const entry: Entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    ...context,
  }

  const line = JSON.stringify(entry)
  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export const log = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'production') return
    emit('debug', message, context)
  },
  info(message: string, context?: LogContext) {
    emit('info', message, context)
  },
  warn(message: string, context?: LogContext) {
    emit('warn', message, context)
  },
  error(message: string, context?: LogContext) {
    emit('error', message, context)
  },
}

export async function getRequestId(): Promise<string | null> {
  try {
    const { headers } = await import('next/headers')
    const hdrs = await headers()
    return hdrs.get('x-request-id')
  } catch {
    return null
  }
}
