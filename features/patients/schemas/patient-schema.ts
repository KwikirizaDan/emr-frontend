import { z } from "zod";

/**
 * Client-side patient validation.
 *
 * This mirrors the Flask schema for fast, friendly feedback only. Flask remains
 * authoritative: duplicate checks, date limits and name/phone rules are all
 * re-validated on the server.
 */

const NAME_PATTERN = /^[A-Za-z][A-Za-z '-]*$/;
const PHONE_PATTERN = /^\+?[0-9 ]{7,20}$/;

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Must be ${max} characters or fewer`)
    .optional()
    .transform((value) => (value && value.trim() !== "" ? value.trim() : ""));

export const patientFormSchema = z.object({
  first_name: z
    .string()
    .min(1, "First name is required")
    .max(100)
    .regex(NAME_PATTERN, "Use letters, spaces, apostrophes and hyphens only"),
  last_name: z
    .string()
    .min(1, "Last name is required")
    .max(100)
    .regex(NAME_PATTERN, "Use letters, spaces, apostrophes and hyphens only"),
  sex: z.enum(["MALE", "FEMALE", "OTHER"], {
    required_error: "Select the patient's sex",
  }),
  date_of_birth: z
    .string()
    .min(1, "Date of birth is required")
    .refine((value) => {
      const parsed = new Date(value);
      return !Number.isNaN(parsed.getTime()) && parsed <= new Date();
    }, "Date of birth cannot be in the future"),
  national_id: z
    .union([
      z.string().regex(/^[A-Za-z0-9]{5,30}$/, "National ID must be 5–30 letters or digits"),
      z.literal(""),
    ])
    .optional(),
  phone: z
    .union([z.string().regex(PHONE_PATTERN, "Enter 7–20 digits, optionally starting with +"), z.literal("")])
    .optional(),
  address: optionalText(255),
  next_of_kin_name: optionalText(120),
  next_of_kin_phone: z
    .union([z.string().regex(PHONE_PATTERN, "Enter 7–20 digits, optionally starting with +"), z.literal("")])
    .optional(),
});

export type PatientFormValues = z.input<typeof patientFormSchema>;
export type PatientFormOutput = z.output<typeof patientFormSchema>;

/** Converts validated form values into the Flask request payload (empty → null). */
export function toPatientPayload(values: PatientFormOutput) {
  const orNull = (value: string | undefined) => (value && value.trim() !== "" ? value.trim() : null);
  return {
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    sex: values.sex,
    date_of_birth: values.date_of_birth,
    national_id: orNull(values.national_id?.toUpperCase()),
    phone: orNull(values.phone),
    address: orNull(values.address),
    next_of_kin_name: orNull(values.next_of_kin_name),
    next_of_kin_phone: orNull(values.next_of_kin_phone),
  };
}