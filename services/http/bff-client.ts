import axios, { type AxiosError } from "axios";

import { ApiError, parseErrorEnvelope } from "@/services/http/api-error";

/**
 * Browser-side client for the same-origin Backend-for-Frontend boundary.
 *
 * Components must never build a Flask URL or hold a token: they call `/api/...`
 * and the route handlers attach the access token from the encrypted session
 * cookie. This keeps `FLASK_API_BASE_URL`, access tokens and refresh tokens on
 * the server.
 */
export type BffRequestOptions = {
  method?: string;
  body?: unknown;
  query?: Record<string, string | number | boolean | null | undefined>;
  signal?: AbortSignal;
};

/** Axios instance rooted at the same-origin BFF proxy. */
const bffApi = axios.create({
  baseURL: "/api",
  headers: { Accept: "application/json" },
  withCredentials: true,
});

function normalizeParams(query?: BffRequestOptions["query"]): Record<string, string> | undefined {
  if (!query) return undefined;
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    params[key] = String(value);
  }
  return params;
}

export async function bffRequest<T = unknown>(
  path: string,
  options: BffRequestOptions = {},
): Promise<T> {
  try {
    const response = await bffApi.request<T>({
      url: path.startsWith("/") ? path : `/${path}`,
      method: options.method ?? "GET",
      data: options.body ?? undefined,
      params: normalizeParams(options.query),
      signal: options.signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error) || error instanceof ApiError) throw error;

    const axiosError = error as AxiosError;
    if (axiosError.response) {
      const requestId =
        (axiosError.response.headers?.["x-request-id"] as string | undefined) ?? null;
      throw parseErrorEnvelope(axiosError.response.status, axiosError.response.data, requestId);
    }

    throw new ApiError({
      status: 0,
      message: "Unable to reach the EMR service. Check your connection and try again.",
    });
  }
}
