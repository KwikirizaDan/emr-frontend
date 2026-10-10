/**
 * Server-only Flask HTTP client.
 *
 * Owns the single axios instance used for every backend call, plus the shared
 * query serialisation and error normalisation. Access tokens are supplied per
 * request; nothing is cached here.
 */
import "server-only";

import axios, { type AxiosHeaders, type AxiosInstance } from "axios";

import { env } from "@/lib/env";
import { ApiError, parseErrorEnvelope } from "@/services/http/api-error";
import { API_BASE_PATH } from "@/services/http/endpoints";

/** A single query value; null, undefined and "" are dropped when serialised. */
export type QueryValue = string | number | boolean | null | undefined | string[];

export type FlaskRequestOptions = {
  method?: string;
  accessToken?: string | null;
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

export type FlaskResponse<T> = {
  status: number;
  ok: boolean;
  data: T | null;
  requestId: string | null;
};

/**
 * Axios instance rooted at the Flask API base URL. Created lazily so the
 * process can boot without `FLASK_API_BASE_URL` set (e.g. during a build).
 *
 * `validateStatus` accepts every status: callers such as the auth boundary need
 * to inspect a `401` instead of having axios throw.
 */
let client: AxiosInstance | null = null;

function flaskApi(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: `${env.flaskApiBaseUrl}${API_BASE_PATH}`,
      headers: { Accept: "application/json" },
      validateStatus: () => true,
      paramsSerializer: { indexes: null },
    });
  }
  return client;
}

/** Builds the absolute Flask URL for a documented API path. */
export function buildFlaskUrl(path: string, query?: Record<string, QueryValue>): string {
  const base = `${env.flaskApiBaseUrl}${API_BASE_PATH}`;
  const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === null || value === undefined || value === "") continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== null && item !== undefined && item !== "") {
            url.searchParams.append(key, String(item));
          }
        }
      } else {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

/** Serialises a query object, dropping empty values and expanding arrays. */
function toParams(query?: Record<string, QueryValue>): URLSearchParams | undefined {
  if (!query) return undefined;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined && item !== "") {
          params.append(key, String(item));
        }
      }
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

function requestIdFrom(headers: unknown): string | null {
  const value = (headers as AxiosHeaders | undefined)?.["x-request-id"];
  return typeof value === "string" ? value : null;
}

/**
 * Performs a request against Flask and returns the parsed body plus status.
 *
 * HTTP error statuses are *not* thrown here so callers such as the auth
 * boundary can inspect a `401` and decide whether to refresh first. Use
 * `apiRequest` when you want an `ApiError` thrown instead.
 */
export async function flaskRequest<T = unknown>(
  path: string,
  options: FlaskRequestOptions = {},
): Promise<FlaskResponse<T>> {
  const { method = "GET", accessToken, body, query, headers, signal } = options;

  try {
    const response = await flaskApi().request<T>({
      url: path.startsWith("/") ? path : `/${path}`,
      method,
      data: body ?? undefined,
      params: toParams(query),
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...headers,
      },
      signal,
    });

    return {
      status: response.status,
      ok: response.status >= 200 && response.status < 300,
      data: (response.data ?? null) as T | null,
      requestId: requestIdFrom(response.headers),
    };
  } catch (error) {
    if (axios.isCancel(error) || (error as Error)?.name === "AbortError") throw error;
    throw new ApiError({
      status: 0,
      message: "Unable to reach the EMR service. Check your connection and try again.",
    });
  }
}

/**
 * Performs a request against Flask, throwing a normalised `ApiError` on any
 * non-2xx response. Returns the `data` payload of the documented envelope.
 */
export async function apiRequest<T = unknown>(
  path: string,
  options: FlaskRequestOptions = {},
): Promise<T> {
  const response = await flaskRequest<T>(path, options);
  if (!response.ok) {
    throw parseErrorEnvelope(response.status, response.data, response.requestId);
  }
  return response.data as T;
}

/** Forwards a browser request straight to Flask, returning the raw response. */
export async function flaskProxy(
  path: string,
  init: {
    method: string;
    accessToken: string;
    query?: Record<string, QueryValue>;
    body?: ArrayBuffer | null;
    contentType?: string | null;
  },
): Promise<Response> {
  try {
    const response = await flaskApi().request<string>({
      url: path.startsWith("/") ? path : `/${path}`,
      method: init.method,
      data: init.body ? Buffer.from(init.body) : undefined,
      params: toParams(init.query),
      headers: {
        Authorization: `Bearer ${init.accessToken}`,
        ...(init.contentType ? { "Content-Type": init.contentType } : {}),
      },
      responseType: "text",
      transformResponse: [(data) => data],
    });

    const headersOut = new Headers();
    const contentType = response.headers["content-type"];
    if (typeof contentType === "string") headersOut.set("content-type", contentType);
    const requestId = requestIdFrom(response.headers);
    if (requestId) headersOut.set("x-request-id", requestId);

    return new Response(response.data ?? "", { status: response.status, headers: headersOut });
  } catch {
    return Response.json(
      {
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: "Unable to reach the EMR service. Check your connection and try again.",
        },
      },
      { status: 503 },
    );
  }
}
