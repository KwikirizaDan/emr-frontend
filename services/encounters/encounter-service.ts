/**
 * Encounter and diagnosis service.
 */

import { getList, getOne, mutateOne } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type {
  Diagnosis,
  Encounter,
  EncounterDetail,
  Paginated,
} from "@/services/http/api-types";

export type EncounterFilters = {
  patient_id?: number;
  status?: "OPEN" | "CLOSED";
  page?: number;
  per_page?: number;
};

export type EncounterPayload = {
  patient_id: number;
  clinician_id?: number | null;
  encounter_type: "OPD" | "EMERGENCY";
  chief_complaint: string;
  notes?: string | null;
};

export type DiagnosisPayload = {
  code?: string | null;
  description: string;
  diagnosis_type: "PRIMARY" | "SECONDARY";
  certainty: "PROVISIONAL" | "CONFIRMED";
};

/** Encounter CRUD, close/void and nested diagnosis calls. */
export const encounterService = {
  list(filters: EncounterFilters = {}): Promise<Paginated<Encounter>> {
    return getList<Encounter>("/encounters", { ...filters });
  },

  getById(encounterId: string | number): Promise<EncounterDetail | null> {
    return getOne<EncounterDetail>(`/encounters/${encounterId}`);
  },

  create(payload: EncounterPayload): Promise<EncounterDetail> {
    return mutateOne<EncounterDetail>("/encounters", {
      method: "POST",
      body: payload,
    });
  },

  update(encounterId: string | number, payload: Partial<EncounterPayload>): Promise<EncounterDetail> {
    return mutateOne<EncounterDetail>(`/encounters/${encounterId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  close(encounterId: string | number): Promise<EncounterDetail> {
    return mutateOne<EncounterDetail>(`/encounters/${encounterId}/close`, {
      method: "POST",
    });
  },

  /** Voids an encounter entered in error; requires a reason of 5+ characters. */
  remove(encounterId: string | number, reason: string): Promise<unknown> {
    return bffRequest(`/encounters/${encounterId}`, {
      method: "DELETE",
      body: { reason },
    });
  },

  addDiagnosis(encounterId: string | number, payload: DiagnosisPayload): Promise<Diagnosis> {
    return mutateOne<Diagnosis>(`/encounters/${encounterId}/diagnoses`, {
      method: "POST",
      body: payload,
    });
  },

  updateDiagnosis(diagnosisId: string | number, payload: Partial<DiagnosisPayload>): Promise<Diagnosis> {
    return mutateOne<Diagnosis>(`/diagnoses/${diagnosisId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  /** Voids a diagnosis entered in error; requires a reason of 5+ characters. */
  removeDiagnosis(diagnosisId: string | number, reason: string): Promise<unknown> {
    return bffRequest(`/diagnoses/${diagnosisId}`, {
      method: "DELETE",
      body: { reason },
    });
  },
};