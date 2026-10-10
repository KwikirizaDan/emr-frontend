/**
 * Shared API response and domain shapes.
 *
 * These describe the documented Flask envelope and the entities returned by
 * `/api/v1`. They live in a neutral module so both the server-side service
 * layer and browser hooks can reference them without pulling server-only code
 * into the client graph. Field names match the Flask `to_dict()` output.
 */

/** `meta` pagination object returned by list endpoints. */
export type PaginationMeta = {
  page: number;
  per_page: number;
  total: number;
  pages: number;
};

/** Documented success envelope. */
export type ApiEnvelope<T> = {
  data: T;
  meta?: PaginationMeta;
};

/** Documented error envelope. */
export type ApiErrorEnvelope = {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    request_id?: string;
  };
};

/** A page of records: the `data` array plus its `meta` pagination object. */
export type Paginated<T> = {
  data: T[];
  meta: PaginationMeta;
};

// ---------------------------------------------------------------------------
// Auth / session
// ---------------------------------------------------------------------------

export type SessionUser = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
};

// ---------------------------------------------------------------------------
// Patients / timeline
// ---------------------------------------------------------------------------

export type Patient = {
  id: number;
  mrn: string;
  first_name: string;
  last_name: string;
  sex: "MALE" | "FEMALE" | "OTHER";
  date_of_birth: string;
  national_id: string | null;
  phone: string | null;
  address: string | null;
  next_of_kin_name: string | null;
  next_of_kin_phone: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type TimelineEventType =
  | "ENCOUNTER"
  | "ADMISSION"
  | "DISCHARGE"
  | "SURGERY"
  | "FOLLOW_UP";

export type TimelineEvent = {
  type: TimelineEventType;
  id: number;
  at: string;
  status: string;
  title: string;
  details: Record<string, unknown>;
};

export type PatientTimeline = {
  patient: Patient;
  events: TimelineEvent[];
};

// ---------------------------------------------------------------------------
// Encounters and diagnoses
// ---------------------------------------------------------------------------

export type Encounter = {
  id: number;
  patient_id: number;
  clinician_id: number;
  encounter_type: "OPD" | "EMERGENCY";
  status: "OPEN" | "CLOSED";
  encounter_at: string;
  chief_complaint: string;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type Diagnosis = {
  id: number;
  encounter_id: number;
  code: string | null;
  description: string;
  diagnosis_type: "PRIMARY" | "SECONDARY";
  certainty: "PROVISIONAL" | "CONFIRMED";
  created_at: string;
  updated_at: string;
  version: number;
};

/** Encounter detail: the encounter plus its live diagnoses. */
export type EncounterDetail = Encounter & {
  diagnoses: Diagnosis[];
};

// ---------------------------------------------------------------------------
// Wards, beds, admissions and discharges
// ---------------------------------------------------------------------------

export type Ward = {
  id: number;
  code: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type WardWithBeds = Ward & {
  beds: BedWithOccupancy[];
  free_beds: number;
};

export type Bed = {
  id: number;
  ward_id: number;
  bed_number: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type BedWithOccupancy = Bed & {
  occupied: boolean;
  patient_id: number | null;
};

export type Admission = {
  id: number;
  patient_id: number;
  encounter_id: number;
  admitting_doctor_id: number;
  bed_id: number;
  admitted_at: string;
  reason: string;
  status: "ADMITTED" | "DISCHARGED";
  discharged_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

export type AdmissionDetail = Admission & {
  bed_number: string;
  ward: { id: number; name: string; code: string };
  discharge: Discharge | null;
};

export type Discharge = {
  id: number;
  admission_id: number;
  discharged_by_id: number;
  discharged_at: string;
  condition_at_discharge:
    | "RECOVERED"
    | "IMPROVED"
    | "UNCHANGED"
    | "TRANSFERRED"
    | "LEFT_AGAINST_ADVICE"
    | "DECEASED";
  summary: string;
  instructions: string | null;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Surgeries
// ---------------------------------------------------------------------------

export type Surgery = {
  id: number;
  patient_id: number;
  admission_id: number;
  procedure_name: string;
  procedure_code: string | null;
  lead_surgeon_id: number;
  theatre: string;
  scheduled_start: string;
  scheduled_end: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  started_at: string | null;
  completed_at: string | null;
  outcome_notes: string | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

// ---------------------------------------------------------------------------
// Follow-ups
// ---------------------------------------------------------------------------

export type FollowUp = {
  id: number;
  patient_id: number;
  admission_id: number | null;
  clinician_id: number | null;
  scheduled_at: string;
  reason: string;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "MISSED";
  status_reason: string | null;
  created_at: string;
  updated_at: string;
  version: number;
};

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type User = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: "ADMIN" | "REGISTRAR" | "NURSE" | "DOCTOR" | "SURGEON";
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

// ---------------------------------------------------------------------------
// Audit logs
// ---------------------------------------------------------------------------

export type AuditLog = {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  patient_id: number | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  reason: string | null;
  ip_address: string | null;
  request_id: string | null;
  created_at: string;
};

// ---------------------------------------------------------------------------
// Worklists
// ---------------------------------------------------------------------------

export type InpatientWorklistItem = {
  admission_id: number;
  patient_id: number;
  mrn: string;
  patient_name: string;
  ward: string;
  bed: string;
  admitted_at: string;
  days_in_hospital: number;
  primary_diagnosis: string | null;
};

export type SurgeryWorklistItem = {
  surgery_id: number;
  patient_id: number;
  mrn: string;
  patient_name: string;
  procedure: string;
  theatre: string;
  surgeon: string;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
};

export type FollowupWorklistItem = {
  follow_up_id: number;
  patient_id: number;
  mrn: string;
  patient_name: string;
  scheduled_at: string;
  reason: string;
  status: string;
};

/** Dashboard summary counts. Deliberately open: render only returned keys. */
export type DashboardData = Record<string, unknown>;