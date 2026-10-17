import { z } from 'zod';

export const LoginSchema = z.object({
  usernameOrEmail: z
    .string()
    .trim()
    .min(2, 'Username or Email is required'),
  password: z.string().min(4, 'Password is required'),
  compId: z.coerce.number().int().positive().optional(),
  branchId: z.coerce.number().int().positive().optional(),
  fyearId: z.coerce.number().int().positive().optional(),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const SwitchContextSchema = z.object({
  compId: z.coerce.number().int().positive('Company ID is required'),
  branchId: z.coerce.number().int().positive('Branch ID is required'),
  fyearId: z.coerce.number().int().positive('Financial Year ID is required'),
});

export type SwitchContextDto = z.infer<typeof SwitchContextSchema>;

export const UpdateUserPreferenceSchema = z.object({
  themeMode: z.enum(['light', 'dark', 'system']).optional(),
  themeColor: z
    .enum(['indigo', 'blue', 'emerald', 'violet', 'amber', 'rose'])
    .optional(),
  sidebarCollapsed: z.boolean().optional(),
  defaultCompId: z.coerce.number().int().positive().optional(),
  defaultBranchId: z.coerce.number().int().positive().optional(),
  defaultFyearId: z.coerce.number().int().positive().optional(),
});

export type UpdateUserPreferenceDto = z.infer<
  typeof UpdateUserPreferenceSchema
>;
