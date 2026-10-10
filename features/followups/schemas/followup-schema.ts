import { z } from "zod";

/** Client-side validation for booking a follow-up appointment. */

export const followUpFormSchema = z.object({
  clinicPatientId: z.string().min(1, "Select a patient"),
  scheduled_at: z
    .string()
    .min(1, "Select a date and time")
    .refine((value) => {
      const date = new Date(value);
      return !Number.isNaN(date.getTime()) && date > new Date();
    }, "The follow-up must be scheduled in the future"),
  clinician_id: z
    .string()
    .optional()
    .refine((value) => !value || /^\d+$/.test(value), "Enter a valid user ID"),
  reason: z
    .string()
    .min(3, "Describe the reason for the follow-up (at least 3 characters)")
    .max(500),
});

export type FollowUpFormValues = z.infer<typeof followUpFormSchema>;
