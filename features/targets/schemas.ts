import { z } from 'zod'

export const targetSchema = z.object({
  metric: z.string().uuid('Metric ID is required'),
  value: z.number().positive('Target value must be positive'),
  period: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  department: z.string().uuid().optional(),
})
