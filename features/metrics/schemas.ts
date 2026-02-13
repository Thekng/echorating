import { z } from 'zod'

export const metricDataTypeSchema = z.enum(['number', 'currency', 'percent', 'boolean', 'duration'])
export const metricDirectionSchema = z.enum(['higher_is_better', 'lower_is_better'])
export const metricInputModeSchema = z.enum(['manual', 'calculated'])

const optionalStringSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    return value
  },
  z.string().optional(),
)

const optionalMetricIdsSchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    return [value]
  }

  return []
}, z.array(z.string().uuid('Invalid metric dependency')).default([]))

export const metricFormSchema = z
  .object({
    metricId: optionalStringSchema,
    departmentId: z.string().uuid('Department is required'),
    name: z.string().min(2, 'Metric name is required'),
    code: optionalStringSchema,
    description: optionalStringSchema,
    dataType: metricDataTypeSchema,
    unit: z.string().min(1, 'Unit is required'),
    direction: metricDirectionSchema,
    inputMode: metricInputModeSchema,
    precisionScale: z.coerce.number().int().min(0).max(6).default(0),
    expression: optionalStringSchema,
    dependsOnMetricIds: optionalMetricIdsSchema,
  })
  .superRefine((value, ctx) => {
    if (value.inputMode === 'calculated' && !value.expression?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expression'],
        message: 'Formula expression is required for calculated metrics.',
      })
    }
  })

export const metricFilterSchema = z.object({
  q: z.string().optional(),
  departmentId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
  mode: z.union([z.literal('all'), metricInputModeSchema]).default('all'),
  status: z.enum(['all', 'active', 'inactive']).default('active'),
})

export const metricStatusSchema = z.object({
  metricId: z.string().uuid('Invalid metric'),
  nextStatus: z.enum(['active', 'inactive']),
})

export const metricDeleteSchema = z.object({
  metricId: z.string().uuid('Invalid metric'),
})
