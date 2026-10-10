import "server-only";

import { cookies } from "next/headers";

import { authService } from "@/services/auth/auth-service";
import {
  SESSION_COOKIE_NAME,
  decryptSession,
  encryptSession,
  isAccessTokenExpired,
  isRefreshTokenExpired,
  sessionCookieOptions,
  type SessionPayload,
} from "./session";

/**
 * Server-side session access used by the Next.js route handlers.
 *
 * The encrypted cookie is the single source of truth for the session, so this
 * works identically across server instances without any shared in-memory state.
 */
export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  const value = store.get(SESSION_COOKIE_NAME)?.value;
  return decryptSession(value);
}

export async function writeSessionCookie(session: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(
    SESSION_COOKIE_NAME,
    encryptSession(session),
    sessionCookieOptions(session),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

export type ResolvedSession =
  | { status: "authenticated"; session: SessionPayload }
  | { status: "unauthenticated" }
  | { status: "expired" };

/**
 * Reads the session and refreshes the access token at most once per request.
 *
 * `expired` means the refresh token itself is no longer usable, so the caller
 * should clear the cookie and force a new sign-in.
 */
export async function resolveSession(): Promise<ResolvedSession> {
  const session = await readSessionCookie();
  if (!session) return { status: "unauthenticated" };

  if (isRefreshTokenExpired(session)) {
    return { status: "expired" };
  }

  if (!isAccessTokenExpired(session)) {
    return { status: "authenticated", session };
  }

  const refreshed = await authService.refresh(session);
  if (!refreshed.ok) {
    return { status: "expired" };
  }

  await writeSessionCookie(refreshed.session);
  return { status: "authenticated", session: refreshed.session };
}
