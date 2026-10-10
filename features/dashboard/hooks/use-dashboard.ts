import useSWR from "swr";

import { bffRequest } from "@/services/http/bff-client";
import type { DashboardData } from "@/services/http/api-types";

const DASHBOARD_KEY = "/dashboard";

/**
 * Loads the dashboard summary through the same-origin boundary.
 *
 * The hook returns the raw payload; the page renders only the keys Flask
 * actually returns, so no metric is ever fabricated.
 */
export function useDashboard() {
  const { data, error, isLoading, mutate } = useSWR<DashboardData>(
    DASHBOARD_KEY,
    async (path: string) => {
      const response = await bffRequest<{ data?: DashboardData }>(path);
      return response.data ?? {};
    },
  );

  return {
    summary: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
