import { z } from "zod";

/** Client-side validation for ward and bed administration. */

export const wardFormSchema = z.object({
  code: z
    .string()
    .min(1, "A ward code is required")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and hyphens only"),
  name: z.string().min(1, "A ward name is required").max(100),
});

export type WardFormValues = z.infer<typeof wardFormSchema>;

export const bedFormSchema = z.object({
  bed_number: z
    .string()
    .min(1, "A bed number is required")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits and hyphens only"),
});

export type BedFormValues = z.infer<typeof bedFormSchema>;
