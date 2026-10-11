/** Hook exposing the currently signed-in user. */
import useSWR from "swr";

import { bffRequest } from "@/services/http/bff-client";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  /** Effective permission set decided by the API. */
  permissions: string[];
};

type MeResponse = { data: { user: CurrentUser } };

const CURRENT_USER_KEY = "/auth/me";

/**
 * Loads the signed-in user from the same-origin auth boundary.
 *
 * Navigation gating uses this only to hide controls the current role cannot
 * use; the permission list comes straight from Flask, and a 403 from the
 * backend remains the final answer.
 */
export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser | null>(
    CURRENT_USER_KEY,
    async () => {
      const body = await bffRequest<MeResponse>(CURRENT_USER_KEY);
      return body.data.user;
    },
  );

  return {
    user: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
