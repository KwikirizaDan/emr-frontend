/**
 * Route: POST /api/auth/logout.
 *
 * Revokes the backend refresh token and always clears the local session cookie.
 */
import { clearSessionCookie, readSessionCookie } from "@/lib/auth/server-session";
import { authService } from "@/services/auth/auth-service";
import { ApiError } from "@/services/http/api-error";

export async function POST() {
  const currentSession = await readSessionCookie();
  let logoutError: ApiError | null = null;

  try {
    if (currentSession) {
      await authService.logout(currentSession);
    }
  } catch (error) {
    if (error instanceof ApiError) {
      logoutError = error;
    } else {
      throw error;
    }
  } finally {
    await clearSessionCookie();
  }

  if (logoutError) {
    return Response.json(
      {
        error: {
          code: logoutError.code ?? "LOGOUT_FAILED",
          message: logoutError.message,
          request_id: logoutError.requestId,
        },
      },
      { status: logoutError.status === 0 ? 502 : logoutError.status },
    );
  }

  return Response.json({ data: { success: true } });
}
