import { z } from 'zod'

export const dailyLogSchema = z.object({
  date: z.date(),
  metrics: z.record(z.string(), z.union([z.number(), z.string()])),
  notes: z.string().optional(),
})
