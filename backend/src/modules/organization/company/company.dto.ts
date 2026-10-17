import { z } from 'zod';

export const CreateCompanySchema = z.object({
  compCode: z
    .string()
    .trim()
    .min(2, 'Company Code must be at least 2 characters')
    .max(20, 'Company Code cannot exceed 20 characters')
    .transform((v) => v.toUpperCase()),
  compName: z
    .string()
    .trim()
    .min(2, 'Company Short/Display Name is required')
    .max(150),
  legalName: z
    .string()
    .trim()
    .min(3, 'Legal Registered Name is required')
    .max(200),
  gstin: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  panNo: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  cinNo: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable()
    .transform((v) => (v ? v.toUpperCase() : null)),
  iecCode: z.string().trim().max(30).optional().nullable(),
  msmeRegNo: z.string().trim().max(50).optional().nullable(),
  baseCurrencyCode: z.string().trim().max(10).default('INR'),
  registeredAddress: z.string().trim().optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  stateName: z.string().trim().max(100).optional().nullable(),
  stateCode: z.string().trim().max(10).optional().nullable(),
  pincode: z.string().trim().max(15).optional().nullable(),
  country: z.string().trim().max(100).default('India'),
  phone: z.string().trim().max(30).optional().nullable(),
  email: z.string().trim().email('Invalid email address').optional().nullable().or(z.literal('')),
  website: z.string().trim().max(150).optional().nullable(),
  logoUrl: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;

export const UpdateCompanySchema = CreateCompanySchema.partial();
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;
