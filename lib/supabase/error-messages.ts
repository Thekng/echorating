type ErrorMapping = {
  pattern: RegExp | string
  userMessage: string
}

const ERROR_MAP: ErrorMapping[] = [
  // Auth & permissions
  { pattern: /permission denied/i, userMessage: 'You do not have permission to perform this action.' },
  { pattern: /insufficient.?privilege/i, userMessage: 'You do not have permission to perform this action.' },
  { pattern: /jwt expired/i, userMessage: 'Your session has expired. Please sign in again.' },
  { pattern: /invalid.*token/i, userMessage: 'Your session is invalid. Please sign in again.' },
  { pattern: /not authenticated/i, userMessage: 'You must be signed in to perform this action.' },

  // RLS
  { pattern: /stack depth limit exceeded/i, userMessage: 'A database configuration issue occurred. Please contact support.' },
  { pattern: /new row violates row-level security/i, userMessage: 'You do not have permission to modify this record.' },
  { pattern: /row-level security/i, userMessage: 'You do not have permission to access this record.' },

  // Constraint violations
  { pattern: /duplicate key value/i, userMessage: 'This record already exists. Please check for duplicates.' },
  { pattern: /unique constraint/i, userMessage: 'This record already exists. Please check for duplicates.' },
  { pattern: /violates foreign key constraint/i, userMessage: 'This operation references a record that does not exist or has been removed.' },
  { pattern: /violates not-null constraint/i, userMessage: 'A required field is missing. Please fill in all required fields.' },
  { pattern: /violates check constraint/i, userMessage: 'The provided value is not valid for this field.' },
  { pattern: /null value in column/i, userMessage: 'A required field is missing. Please fill in all required fields.' },

  // Schema drift (these indicate missing migrations, not user errors)
  { pattern: /column .+ does not exist/i, userMessage: 'A database update is required. Please contact support.' },
  { pattern: /relation .+ does not exist/i, userMessage: 'A database update is required. Please contact support.' },
  { pattern: /function .+ does not exist/i, userMessage: 'A database update is required. Please contact support.' },

  // Connection / availability
  { pattern: /connection refused/i, userMessage: 'The service is temporarily unavailable. Please try again.' },
  { pattern: /timeout/i, userMessage: 'The request took too long. Please try again.' },
  { pattern: /too many connections/i, userMessage: 'The service is busy. Please try again in a moment.' },

  // Data format
  { pattern: /invalid input syntax/i, userMessage: 'The provided value has an invalid format.' },
  { pattern: /value too long/i, userMessage: 'The provided value is too long.' },
  { pattern: /out of range/i, userMessage: 'The provided value is out of the allowed range.' },
]

const GENERIC_ERROR = 'Something went wrong. Please try again or contact support.'

export function formatDatabaseError(rawMessage: string): string {
  if (!rawMessage) return GENERIC_ERROR

  for (const { pattern, userMessage } of ERROR_MAP) {
    if (typeof pattern === 'string') {
      if (rawMessage.toLowerCase().includes(pattern.toLowerCase())) {
        logInternalError(rawMessage)
        return userMessage
      }
    } else if (pattern.test(rawMessage)) {
      logInternalError(rawMessage)
      return userMessage
    }
  }

  logInternalError(rawMessage)
  return GENERIC_ERROR
}

function logInternalError(rawMessage: string) {
  console.error('[DB_ERROR]', rawMessage)
}
