import { z } from 'zod'

export const onboardingSchema = z.object({
  organizationName: z.string().min(2, 'Organization name is required'),
  slug: z
    .string()
    .min(2, 'Slug must be at least 2 characters')
    .max(63, 'Slug must be at most 63 characters')
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  industry: z.string().min(1, 'Industry is required'),
  locationName: z.string().min(1, 'Location name is required'),
  timezone: z.string().min(1, 'Timezone is required'),
})
