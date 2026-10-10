import { z } from "zod";

/** Client-side encounter and diagnosis validation (Flask re-validates). */

export const encounterFormSchema = z.object({
  clinicPatientId: z.string().min(1, "Select a patient"),
  encounter_type: z.enum(["OPD", "EMERGENCY"], {
    required_error: "Select the encounter type",
  }),
  chief_complaint: z
    .string()
    .min(3, "Describe the presenting complaint (at least 3 characters)")
    .max(500),
  notes: z.string().max(10000).optional(),
});

export type EncounterFormValues = z.infer<typeof encounterFormSchema>;

export const diagnosisFormSchema = z.object({
  description: z
    .string()
    .min(3, "Describe the diagnosis (at least 3 characters)")
    .max(255),
  code: z.string().max(20).optional(),
  diagnosis_type: z.enum(["PRIMARY", "SECONDARY"]),
  certainty: z.enum(["PROVISIONAL", "CONFIRMED"]),
});

export type DiagnosisFormValues = z.infer<typeof diagnosisFormSchema>;

export function toDiagnosisPayload(values: DiagnosisFormValues) {
  return {
    description: values.description.trim(),
    code: values.code && values.code.trim() !== "" ? values.code.trim() : null,
    diagnosis_type: values.diagnosis_type,
    certainty: values.certainty,
  };
}