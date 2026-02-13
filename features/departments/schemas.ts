import { z } from 'zod'

export const departmentSchema = z.object({
  name: z.string().min(2, 'Department name is required'),
  description: z.string().optional(),
  manager: z.string().uuid().optional(),
})
