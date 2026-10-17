import { z } from 'zod';

export const BranchTypeEnum = z.enum([
  'PLANT',
  'HO',
  'WAREHOUSE',
  'SALES_OFFICE',
]);

export const CreateBranchSchema = z.object({
  compId: z.coerce
    .number()
    .int()
    .positive('Parent Company ID (comp_id) is required'),
  branchCode: z
    .string()
    .trim()
    .min(2, 'Branch Code must be at least 2 characters')
    .max(20, 'Branch Code cannot exceed 20 characters')
    .transform((v) => v.toUpperCase()),
  branchName: z
    .string()
    .trim()
    .min(2, 'Branch / Plant Name is required')
    .max(150),
  branchType: BranchTypeEnum.default('PLANT'),
  gstin: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  address: z.string().trim().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateName: z.string().trim().max(100).optional().nullable(),
  stateCode: z.string().trim().max(10).optional().nullable(),
  pincode: z.string().trim().max(15).optional().nullable(),
  country: z.string().trim().max(100).default('India'),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z
    .string()
    .trim()
    .email('Invalid email address')
    .optional()
    .nullable()
    .or(z.literal('')),
  isHeadOffice: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type CreateBranchDto = z.infer<typeof CreateBranchSchema>;

export const UpdateBranchSchema = CreateBranchSchema.partial();
export type UpdateBranchDto = z.infer<typeof UpdateBranchSchema>;
