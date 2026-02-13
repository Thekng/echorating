import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})

export const companyStatusSchema = z.object({
  nextStatus: z.enum(['active', 'inactive']),
})
