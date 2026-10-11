/**
 * Surgery service.
 */

import { getList, getOne, mutateOne } from "@/services/http/list-helpers";
import type { Paginated, Surgery } from "@/services/http/api-types";

export type SurgeryFilters = {
  status?: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  patient_id?: number;
  page?: number;
  per_page?: number;
};

export type SurgeryPayload = {
  patient_id: number;
  admission_id: number;
  procedure_name: string;
  procedure_code?: string | null;
  lead_surgeon_id: number;
  theatre: string;
  scheduled_start: string;
  scheduled_end: string;
};

/** Surgery scheduling and lifecycle transitions. */
export const surgeryService = {
  list(filters: SurgeryFilters = {}): Promise<Paginated<Surgery>> {
    return getList<Surgery>("/surgeries", { ...filters });
  },

  getById(surgeryId: string | number): Promise<Surgery | null> {
    return getOne<Surgery>(`/surgeries/${surgeryId}`);
  },

  create(payload: SurgeryPayload): Promise<Surgery> {
    return mutateOne<Surgery>("/surgeries", {
      method: "POST",
      body: payload,
    });
  },

  update(surgeryId: string | number, payload: Partial<SurgeryPayload>): Promise<Surgery> {
    return mutateOne<Surgery>(`/surgeries/${surgeryId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  start(surgeryId: string | number): Promise<Surgery> {
    return mutateOne<Surgery>(`/surgeries/${surgeryId}/start`, { method: "POST" });
  },

  complete(surgeryId: string | number, payload: { outcome_notes: string }): Promise<Surgery> {
    return mutateOne<Surgery>(`/surgeries/${surgeryId}/complete`, {
      method: "POST",
      body: payload,
    });
  },

  cancel(surgeryId: string | number, payload: { reason: string }): Promise<Surgery> {
    return mutateOne<Surgery>(`/surgeries/${surgeryId}/cancel`, {
      method: "POST",
      body: payload,
    });
  },
};