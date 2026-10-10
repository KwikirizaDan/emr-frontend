import type { NextRequest } from "next/server";

import {
  clearSessionCookie,
  resolveSession,
  writeSessionCookie,
} from "@/lib/auth/server-session";
import { flaskProxy, type QueryValue } from "@/services/http/api-client";
import { authService } from "@/services/auth/auth-service";

/**
 * Backend-for-Frontend boundary for every authenticated Flask call.
 *
 * The browser only ever talks to `/api/...` on its own origin. This handler
 * attaches the access token from the encrypted session cookie, so
 * `FLASK_API_BASE_URL` and both tokens stay server-side.
 *
 * Retry policy: at most one refresh-then-retry per request, and only in
 * response to a `401` from Flask. A non-idempotent `POST` is never retried
 * after an ambiguous network failure.
 */

const METHODS_WITH_BODY = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function encodeQuery(request: NextRequest): Record<string, QueryValue> {
  const query: Record<string, string[]> = {};
  for (const [key, value] of request.nextUrl.searchParams) {
    (query[key] ??= []).push(value);
  }
  return query;
}

function jsonError(status: number, code: string, message: string) {
  return Response.json({ error: { code, message } }, { status });
}

async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;

  // Auth routes have their own handlers with different semantics.
  if (path[0] === "auth") {
    return jsonError(404, "NOT_FOUND", "Unknown endpoint.");
  }

  const resolved = await resolveSession();
  if (resolved.status !== "authenticated") {
    await clearSessionCookie();
    return jsonError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
  }

  const apiPath = `/${path.join("/")}`;
  const query = encodeQuery(request);
  const contentType = request.headers.get("content-type");

  // Read the body once so a single retry can replay the exact same bytes.
  const body = METHODS_WITH_BODY.has(request.method)
    ? await request.arrayBuffer()
    : null;

  let response = await flaskProxy(apiPath, {
    method: request.method,
    accessToken: resolved.session.accessToken,
    query,
    body,
    contentType,
  });

  if (response.status === 401) {
    const refreshed = await authService.refresh(resolved.session);
    if (!refreshed.ok) {
      await clearSessionCookie();
      return jsonError(401, "SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    }
    await writeSessionCookie(refreshed.session);

    response = await flaskProxy(apiPath, {
      method: request.method,
      accessToken: refreshed.session.accessToken,
      query,
      body,
      contentType,
    });
  }

  return response;
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
