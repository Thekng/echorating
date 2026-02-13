export const ERROR_MAP: Record<string, string> = {
  UNAUTHORIZED: 'You are not authorized to perform this action',
  NOT_FOUND: 'The requested resource was not found',
  INVALID_INPUT: 'Invalid input provided',
  INTERNAL_ERROR: 'An internal error occurred',
  DATABASE_ERROR: 'A database error occurred',
  VALIDATION_ERROR: 'Validation failed',
}

export function getErrorMessage(code: string): string {
  return ERROR_MAP[code] || 'An error occurred'
}
