import { z } from 'zod'
import { METRIC_DATA_TYPES } from '@/lib/metrics/data-types'

export const metricDataTypeSchema = z.enum(METRIC_DATA_TYPES)
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
    inputMode: metricInputModeSchema,
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
