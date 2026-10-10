import { z } from "zod";

/**
 * Login validation for usability only. Flask remains the authority on whether
 * credentials are valid.
 */
export const loginSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter your username.")
    .max(150, "Username is too long."),
  password: z.string().min(1, "Enter your password.").max(256, "Password is too long."),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
