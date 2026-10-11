/**
 * Route: GET /api/auth/me.
 */
import { resolveSession } from "@/lib/auth/server-session";

/**
 * Returns the signed-in user for the current session cookie.
 *
 * The session was built from `/auth/login` (and refreshed by the BFF), so the
 * `role` and `permissions` here are whatever Flask decided — the client never
 * guesses capabilities. `user: null` means no session; the shell redirects to
 * the sign-in screen in that case.
 */
export async function GET() {
  const resolved = await resolveSession();
  if (resolved.status !== "authenticated") {
    return Response.json({ data: { user: null } });
  }

  const { user } = resolved.session;
  return Response.json({
    data: {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        permissions: user.permissions ?? [],
      },
    },
  });
}