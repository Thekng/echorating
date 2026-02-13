import { z } from 'zod'

export const dailyLogIntentSchema = z.enum(['draft', 'submit'])

export const dailyLogFormSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  departmentId: z.string().uuid('Department is required'),
  userId: z.string().uuid('Invalid agent').optional(),
  notes: z.string().max(5000, 'Notes too long').optional(),
  intent: dailyLogIntentSchema,
})

export const dailyLogFilterSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  departmentId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
})
