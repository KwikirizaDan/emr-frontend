import { z } from "zod";

/** Client-side validation for scheduling and completing surgery. */

const futureOrNow = (value: string) =>
  value.trim() !== "" && !Number.isNaN(new Date(value).getTime());

/** Scheduling requires the end time to fall after the start time. */
export const scheduleSurgerySchema = z
  .object({
    clinicPatientId: z.string().min(1, "Select a patient"),
    admission_id: z.string().min(1, "Select the admission the surgery belongs to"),
    procedure_name: z
      .string()
      .min(3, "Describe the procedure (at least 3 characters)")
      .max(200),
    procedure_code: z.string().max(50).optional(),
    lead_surgeon_id: z
      .string()
      .min(1, "Enter the lead surgeon's user ID")
      .regex(/^\d+$/, "Enter a valid user ID"),
    theatre: z.string().min(1, "Enter the theatre").max(100),
    scheduled_start: z.string().refine(futureOrNow, "Select a start time"),
    scheduled_end: z.string().refine(futureOrNow, "Select an end time"),
  })
  .refine((values) => new Date(values.scheduled_end) > new Date(values.scheduled_start), {
    path: ["scheduled_end"],
    message: "The end time must be after the start time",
  });

export type ScheduleSurgeryValues = z.infer<typeof scheduleSurgerySchema>;

export const completeSurgerySchema = z.object({
  outcome_notes: z
    .string()
    .min(3, "Describe the outcome (at least 3 characters)")
    .max(4000),
});

export type CompleteSurgeryValues = z.infer<typeof completeSurgerySchema>;
