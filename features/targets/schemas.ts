import { z } from 'zod'

export const targetPeriodSchema = z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly'])
export const targetScopeSchema = z.enum(['department', 'member'])

const optionalUuidSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    return value
  },
  z.string().uuid().optional(),
)

const optionalPositiveNumberSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        return undefined
      }
      return Number(trimmed)
    }

    if (value === null || value === undefined) {
      return undefined
    }

    return value
  },
  z.number().positive('Target value must be positive').optional(),
)

export const targetSchema = z.object({
  targetId: optionalUuidSchema,
  metricId: z.string().uuid('Metric is required'),
  departmentId: z.string().uuid('Department is required'),
  scope: targetScopeSchema.default('department'),
  period: targetPeriodSchema.default('daily'),
  value: z.coerce.number().positive('Target value must be positive'),
})

export const upsertDailyDepartmentTargetSchema = z.object({
  metricId: z.string().uuid('Metric is required'),
  departmentId: z.string().uuid('Department is required'),
  value: optionalPositiveNumberSchema,
})

export const targetFilterSchema = z.object({
  q: z.string().optional(),
  departmentId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
  status: z.enum(['all', 'active', 'inactive']).default('active'),
})

export const targetStatusSchema = z.object({
  targetId: z.string().uuid('Target is required'),
  nextStatus: z.enum(['active', 'inactive']),
})
