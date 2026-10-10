import type { NextRequest } from "next/server";

import { clearSessionCookie, resolveSession } from "@/lib/auth/server-session";

/**
 * Refreshes the access token using the rotating refresh token held in the
 * encrypted session cookie, and re-seals the cookie.
 *
 * A single request performs at most one refresh; failure returns 401 so the
 * client sends the user back to sign in.
 */
export async function POST() {
  const resolved = await resolveSession();

  if (resolved.status !== "authenticated") {
    await clearSessionCookie();
    return Response.json(
      {
        error: {
          code: "SESSION_EXPIRED",
          message: "Your session has expired. Please sign in again.",
        },
      },
      { status: 401 },
    );
  }

  return Response.json({ data: { user: resolved.session.user } });
}
