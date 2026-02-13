import { z } from 'zod'

export const departmentTypeSchema = z.enum(['sales', 'service', 'life', 'marketing', 'custom'])

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  type: departmentTypeSchema,
})

export const departmentFilterSchema = z.object({
  q: z.string().optional(),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  type: z.union([z.literal('all'), departmentTypeSchema]).default('all'),
})
