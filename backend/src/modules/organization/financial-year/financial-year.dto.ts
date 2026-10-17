import { z } from 'zod';

export const CreateFinancialYearSchema = z
  .object({
    compId: z.coerce
      .number()
      .int()
      .positive('Parent Company ID (comp_id) is required'),
    fyearCode: z
      .string()
      .trim()
      .min(4, 'Financial Year Code is required (e.g. 2026-27)')
      .max(20),
    fyearName: z
      .string()
      .trim()
      .min(4, 'Financial Year Name is required (e.g. FY 2026-2027)')
      .max(50),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start Date must be YYYY-MM-DD'),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'End Date must be YYYY-MM-DD'),
    isCurrent: z.boolean().default(false),
    isClosed: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: 'End Date must be on or after Start Date',
    path: ['endDate'],
  });

export type CreateFinancialYearDto = z.infer<typeof CreateFinancialYearSchema>;

export const UpdateFinancialYearSchema = z.object({
  compId: z.coerce.number().int().positive().optional(),
  fyearCode: z.string().trim().min(4).max(20).optional(),
  fyearName: z.string().trim().min(4).max(50).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  isCurrent: z.boolean().optional(),
  isClosed: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateFinancialYearDto = z.infer<typeof UpdateFinancialYearSchema>;

export const UpsertBranchFyearSchema = z.object({
  compId: z.coerce.number().int().positive('Company ID is required'),
  branchId: z.coerce.number().int().positive('Branch ID is required'),
  fyearId: z.coerce.number().int().positive('Financial Year ID is required'),
  isLocked: z.boolean(),
  booksBeginFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  isActive: z.boolean().default(true),
});

export type UpsertBranchFyearDto = z.infer<typeof UpsertBranchFyearSchema>;
