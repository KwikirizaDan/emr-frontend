import { z } from "zod";

/** Client-side validation for admitting and discharging a patient. */

export const admissionFormSchema = z.object({
  clinicPatientId: z.string().min(1, "Select a patient"),
  encounter_id: z.string().min(1, "Select the encounter that justifies this admission"),
  bed_id: z.string().min(1, "Select a free bed"),
  reason: z
    .string()
    .min(3, "Describe the reason for admission (at least 3 characters)")
    .max(500),
});

export type AdmissionFormValues = z.infer<typeof admissionFormSchema>;

export const DISCHARGE_CONDITIONS = [
  "RECOVERED",
  "IMPROVED",
  "UNCHANGED",
  "TRANSFERRED",
  "LEFT_AGAINST_ADVICE",
  "DECEASED",
] as const;

export const dischargeFormSchema = z.object({
  condition_at_discharge: z.enum(DISCHARGE_CONDITIONS, {
    required_error: "Select the condition at discharge",
  }),
  summary: z
    .string()
    .min(10, "The discharge summary must be at least 10 characters")
    .max(4000),
  instructions: z.string().max(2000).optional(),
});

export type DischargeFormValues = z.infer<typeof dischargeFormSchema>;
