import useSWR from "swr";

import { bffRequest } from "@/services/http/bff-client";

export type CurrentUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
};

type CurrentUserResponse = { data: CurrentUser };

const CURRENT_USER_KEY = "/auth/me";

/**
 * Loads the signed-in user from the same-origin auth boundary.
 *
 * Navigation gating uses this only to hide controls the current role cannot
 * use. A 403 from Flask is still the final answer.
 */
export function useCurrentUser() {
  const { data, error, isLoading, mutate } = useSWR<CurrentUser>(
    CURRENT_USER_KEY,
    async (path: string) => {
      const response = await bffRequest<CurrentUserResponse>(path);
      return response.data;
    },
  );

  return {
    user: data ?? null,
    isLoading,
    error,
    mutate,
  };
}
