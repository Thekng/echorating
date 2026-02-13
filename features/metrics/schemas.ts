import { z } from 'zod'

export const metricSchema = z.object({
  name: z.string().min(2, 'Metric name is required'),
  description: z.string().optional(),
  type: z.enum(['number', 'percentage', 'time']),
  unit: z.string().optional(),
})
