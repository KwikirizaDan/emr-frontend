import { z } from "zod";

/** Client-side validation for staff accounts. */

export const USER_ROLES = ["ADMIN", "REGISTRAR", "NURSE", "DOCTOR", "SURGEON"] as const;

const base = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(50)
    .regex(/^[A-Za-z0-9._-]+$/, "Letters, digits, dot, underscore and hyphen only"),
  email: z.string().min(1, "Email is required").email("Enter a valid email"),
  full_name: z.string().min(1, "Full name is required").max(150),
  role: z.enum(USER_ROLES, { required_error: "Select a role" }),
  is_active: z.boolean(),
});

export const userFormSchema = base.extend({
  // Required when creating; validated in the form for edit mode.
  password: z.string().max(128).optional(),
});

export type UserFormValues = z.infer<typeof userFormSchema>;

export const resetPasswordSchema = z.object({
  new_password: z.string().min(8, "At least 8 characters").max(128),
});

export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
