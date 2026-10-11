/**
 * Patient service — the only place frontend code talks to the patient API.
 *
 * All calls go through the same-origin BFF boundary (`/api/...`); tokens and
 * the Flask base URL stay server-side. No business rules live here.
 */

import { getList, getOne, mutateOne } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type {
  Patient,
  PatientTimeline,
  Paginated,
} from "@/services/http/api-types";

export type PatientFilters = {
  q?: string;
  page?: number;
  per_page?: number;
};

export type PatientPayload = {
  first_name: string;
  last_name: string;
  sex: "MALE" | "FEMALE" | "OTHER";
  date_of_birth: string;
  national_id?: string | null;
  phone?: string | null;
  address?: string | null;
  next_of_kin_name?: string | null;
  next_of_kin_phone?: string | null;
};

/** CRUD, soft-delete and timeline calls for patients. */
export const patientService = {
  list(filters: PatientFilters = {}): Promise<Paginated<Patient>> {
    return getList<Patient>("/patients", { ...filters });
  },

  getById(patientId: string | number): Promise<Patient | null> {
    return getOne<Patient>(`/patients/${patientId}`);
  },

  create(payload: PatientPayload): Promise<Patient> {
    return mutateOne<Patient>("/patients", { method: "POST", body: payload });
  },

  update(patientId: string | number, payload: Partial<PatientPayload>): Promise<Patient> {
    return mutateOne<Patient>(`/patients/${patientId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  /** Soft delete; the API requires a reason of at least 5 characters. */
  remove(patientId: string | number, reason: string): Promise<unknown> {
    return bffRequest(`/patients/${patientId}`, {
      method: "DELETE",
      body: { reason },
    });
  },

  timeline(patientId: string | number): Promise<PatientTimeline | null> {
    return getOne<PatientTimeline>(`/patients/${patientId}/timeline`);
  },
};