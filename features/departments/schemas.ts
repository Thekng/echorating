import { z } from 'zod'

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  description: z.string().optional(),
})

export const departmentIdSchema = z.object({
  departmentId: z.string().uuid('Invalid department'),
})

export const departmentFilterSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
})
