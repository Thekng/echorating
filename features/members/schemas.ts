import { z } from 'zod'

export const memberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['admin', 'manager', 'agent']),
  department: z.string().uuid().optional(),
})
