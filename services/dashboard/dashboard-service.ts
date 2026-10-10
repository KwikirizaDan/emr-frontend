/**
 * Server-only dashboard data access.
 *
 * Kept behind the BFF so the raw Flask envelope never leaks to the browser.
 */
import "server-only";

import { ENDPOINTS } from "@/services/http/endpoints";
import { apiRequest } from "@/services/http/api-client";
import type { ApiEnvelope, DashboardData } from "@/services/http/api-types";

/**
 * Dashboard summary counts.
 *
 * The response is returned exactly as Flask produces it. Values are only ever
 * rendered from the real payload — no count is invented, assumed or defaulted,
 * so metrics the backend does not return are simply not shown.
 */
export const dashboardService = {
  summary() {
    return apiRequest<DashboardData>(ENDPOINTS.dashboard);
  },
};

export type { ApiEnvelope };
