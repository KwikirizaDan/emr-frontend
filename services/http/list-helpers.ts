/**
 * Shared helpers for feature services that talk to the same-origin BFF
 * boundary. Components never build Flask URLs or hold tokens: they call
 * `/api/...` and the route handlers attach the session.
 */

import { bffRequest, type BffRequestOptions } from "@/services/http/bff-client";
import type { Paginated, PaginationMeta } from "@/services/http/api-types";

export type ListQuery = {
  page?: number;
  per_page?: number;
  [key: string]: string | number | boolean | null | undefined;
};

/** Builds the query object for a paginated list call. */
export function listQuery(
  query: ListQuery = {},
): Record<string, string | number | boolean | null | undefined> {
  const { page, per_page, ...rest } = query;
  return {
    ...rest,
    ...(page ? { page: String(page) } : {}),
    ...(per_page ? { per_page: String(per_page) } : {}),
  };
}

/** Requests a paginated endpoint and returns `{ rows, meta }`. */
export async function getList<T>(
  path: string,
  query: ListQuery = {},
): Promise<Paginated<T>> {
  const response = await bffRequest<{ data?: T[]; meta?: PaginationMeta }>(path, {
    query: listQuery(query),
  });
  return {
    data: Array.isArray(response?.data) ? response.data : [],
    meta: response?.meta ?? { page: 1, per_page: 20, total: 0, pages: 0 },
  };
}

/** Requests a single-record endpoint and returns its `data` payload. */
export async function getOne<T>(path: string): Promise<T | null> {
  const response = await bffRequest<{ data?: T | null }>(path);
  return response?.data ?? null;
}

/** Sends a mutating request and returns the `data` payload of the response. */
export async function mutateOne<T>(
  path: string,
  options?: BffRequestOptions,
): Promise<T> {
  const response = await bffRequest<{ data?: T }>(path, options as any);
  return (response?.data ?? null) as T;
}