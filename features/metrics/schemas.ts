import { z } from 'zod'
import { METRIC_DATA_TYPES } from '@/lib/metrics/data-types'

export const metricDataTypeSchema = z.enum(METRIC_DATA_TYPES)

const optionalStringSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }
    return value
  },
  z.string().optional(),
)

export const metricFormSchema = z.object({
  metricId: optionalStringSchema,
  departmentId: z.string().uuid('Department is required'),
  name: z.string().min(2, 'Metric name is required'),
  code: optionalStringSchema,
  description: optionalStringSchema,
  dataType: metricDataTypeSchema,
  isRequired: z.preprocess(
    (value) => value === 'true' || value === true,
    z.boolean().default(false),
  ),
})

export const metricFilterSchema = z.object({
  q: z.string().optional(),
  departmentId: z.union([z.literal('all'), z.string().uuid()]).default('all'),
  status: z.enum(['all', 'active', 'inactive']).default('active'),
})

export const metricStatusSchema = z.object({
  metricId: z.string().uuid('Invalid metric'),
  nextStatus: z.enum(['active', 'inactive']),
})

export const metricDeleteSchema = z.object({
  metricId: z.string().uuid('Invalid metric'),
})

export const metricReorderSchema = z.object({
  metricId: z.string().uuid('Invalid metric'),
  direction: z.enum(['up', 'down']),
})
