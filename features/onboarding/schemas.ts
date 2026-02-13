import { z } from 'zod'

export const onboardingSchema = z.object({
  companyName: z.string().min(2, 'Company name is required'),
  industry: z.string().min(1, 'Industry is required'),
  teamSize: z.string().min(1, 'Team size is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})
