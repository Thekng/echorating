import { z } from 'zod'

export const companySchema = z.object({
  name: z.string().min(2, 'Company name is required'),
  website: z.string().url().optional(),
  logo: z.string().optional(),
})
