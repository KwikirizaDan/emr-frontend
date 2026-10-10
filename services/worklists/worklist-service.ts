/**
 * Worklist and dashboard service.
 */

import { getList } from "@/services/http/list-helpers";
import { bffRequest } from "@/services/http/bff-client";
import type {
  DashboardData,
  FollowupWorklistItem,
  InpatientWorklistItem,
  Paginated,
  SurgeryWorklistItem,
} from "@/services/http/api-types";

export type WorklistPage = {
  page?: number;
  per_page?: number;
};

/** Dashboard summary and the three worklist tabs. */
export const worklistService = {
  dashboard(): Promise<DashboardData> {
    return bffRequest<DashboardData>("/dashboard").then((response) => {
      // Unwrap the envelope and default to an empty summary, never fake counts.
      const data = (response as { data?: DashboardData }).data;
      return data && typeof data === "object" ? data : {};
    });
  },

  inpatients(page: WorklistPage = {}): Promise<Paginated<InpatientWorklistItem>> {
    return getList<InpatientWorklistItem>("/worklists/inpatients", page);
  },

  surgeries(day: string, page: WorklistPage = {}): Promise<Paginated<SurgeryWorklistItem>> {
    return getList<SurgeryWorklistItem>("/worklists/surgeries", { day, ...page });
  },

  followupsDue(
    filters: { date_from?: string; date_to?: string } & WorklistPage = {},
  ): Promise<Paginated<FollowupWorklistItem>> {
    return getList<FollowupWorklistItem>("/worklists/followups", filters);
  },
};