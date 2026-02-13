import { z } from 'zod'

export const memberRoleSchema = z.enum(['owner', 'manager', 'member'])

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
  status: z.enum(['all', 'active', 'inactive']).default('active'),
})

export const createMemberSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email'),
  role: memberRoleSchema,
  departmentId: optionalDepartmentIdSchema,
})

export const updateMemberRoleSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  role: memberRoleSchema,
})

export const assignMemberDepartmentSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  departmentId: optionalDepartmentIdSchema,
})

export const toggleMemberStatusSchema = z.object({
  userId: z.string().uuid('Invalid member'),
  nextStatus: z.enum(['active', 'inactive']),
})
