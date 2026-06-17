import { z } from 'zod'

export const memberRoleSchema = z.enum(['owner', 'admin', 'manager', 'member'])

const optionalDepartmentIdSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && value.trim() === '') {
      return undefined
    }

    return value
  },
  z.string().uuid('Invalid department').optional(),
)

export const memberFilterSchema = z.object({
  q: z.string().optional(),
  role: z.union([z.literal('all'), memberRoleSchema]).default('all'),
})

export const updateMemberRoleSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  role: memberRoleSchema,
})

export const assignMemberDepartmentSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  departmentId: optionalDepartmentIdSchema,
})

export const departmentMemberSchema = z.object({
  userId: z.string().uuid('Invalid user'),
  departmentId: z.string().uuid('Invalid department'),
  role: z.enum(['lead', 'member']),
})

export const toggleMemberStatusSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  nextStatus: z.enum(['active', 'inactive']),
})

export const createMemberSchema = z.object({
  email: z.string().email('Valid email is required.'),
  role: memberRoleSchema,
  departmentId: z.string().uuid().optional().or(z.literal('')),
})
