import { z } from 'zod';

// Step 1: Personal Information
export const personalInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  middleName: z.string().optional(),
  dateOfBirth: z.string().refine((date) => {
    const birthDate = new Date(date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    return age >= 18;
  }, 'You must be at least 18 years old'),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER'], {
    required_error: 'Please select a gender',
  }),
  telephone: z
    .string()
    .regex(/^\+254\d{9}$/, 'Phone must be in format +254XXXXXXXXX (e.g., +254712345678)'),
  emailOptional: z.string().email('Invalid email format').optional().or(z.literal('')),
});

export type PersonalInfoFormData = z.infer<typeof personalInfoSchema>;

// Step 2: Address & Church Group
export const addressInfoSchema = z.object({
  physicalAddress: z.string().min(10, 'Please provide a complete address'),
  poBox: z.string().optional(),
  churchGroup: z.string().optional(),
});

export type AddressInfoFormData = z.infer<typeof addressInfoSchema>;

// Step 3: ID & Referee
export const idAndRefereeSchema = z.object({
  idPassportNumber: z
    .string()
    .min(5, 'ID/Passport number must be at least 5 characters')
    .max(20, 'ID/Passport number must not exceed 20 characters'),
  refereeMemberNo: z
    .string()
    .regex(/^ATSC-\d{4}-\d{4}$/, 'Referee member number must be in format ATSC-YYYY-NNNN')
    .optional()
    .or(z.literal('')),
  nextOfKinName: z.string().min(2, 'Next of kin name must be at least 2 characters'),
  nextOfKinPhone: z
    .string()
    .regex(/^\+254\d{9}$/, 'Next of kin phone must be in format +254XXXXXXXXX'),
  nextOfKinRelationship: z.string().min(2, 'Relationship must be at least 2 characters'),
});

export type IdAndRefereeFormData = z.infer<typeof idAndRefereeSchema>;

// Step 4: Review & Submit
export const reviewSubmitSchema = z
  .object({
    email: z.string().email('Invalid email format'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    agreedToTerms: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the terms and conditions',
    }),
    agreedToRefundPolicy: z.boolean().refine((val) => val === true, {
      message: 'You must agree to the refund policy',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type ReviewSubmitFormData = z.infer<typeof reviewSubmitSchema>;
