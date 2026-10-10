/**
 * Follow-up service.
 */

import { getList, getOne } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type { FollowUp, Paginated } from "@/services/http/api-types";

export type FollowUpFilters = {
  patient_id?: number;
  status?: "SCHEDULED" | "COMPLETED" | "CANCELLED" | "MISSED";
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
};

export type FollowUpPayload = {
  patient_id: number;
  admission_id?: number | null;
  clinician_id?: number | null;
  scheduled_at: string;
  reason: string;
};

export type FollowUpStatusPayload = {
  status: "COMPLETED" | "CANCELLED" | "MISSED";
  reason?: string | null;
};

/** Follow-up scheduling and status changes. */
export const followUpService = {
  list(filters: FollowUpFilters = {}): Promise<Paginated<FollowUp>> {
    return getList<FollowUp>("/followups", { ...filters });
  },

  getById(followUpId: string | number): Promise<FollowUp | null> {
    return getOne<FollowUp>(`/followups/${followUpId}`);
  },

  create(payload: FollowUpPayload): Promise<FollowUp> {
    return bffRequest<FollowUp>("/followups", {
      method: "POST",
      body: payload,
    });
  },

  update(followUpId: string | number, payload: Partial<FollowUpPayload>): Promise<FollowUp> {
    return bffRequest<FollowUp>(`/followups/${followUpId}`, {
      method: "PATCH",
      body: payload,
    });
  },

  changeStatus(followUpId: string | number, payload: FollowUpStatusPayload): Promise<FollowUp> {
    return bffRequest<FollowUp>(`/followups/${followUpId}/status`, {
      method: "POST",
      body: payload,
    });
  },
};