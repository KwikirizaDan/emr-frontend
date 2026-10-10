import type { NextRequest } from "next/server";

import { loginSchema } from "@/features/auth/schemas/login-schema";
import { writeSessionCookie } from "@/lib/auth/server-session";
import { authService } from "@/services/auth/auth-service";

/**
 * Same-origin login boundary.
 *
 * The browser posts credentials here; this handler talks to
 * `POST /api/v1/auth/login`, seals both tokens into an encrypted httpOnly
 * cookie, and returns only the public user summary. No token is ever exposed to
 * client-side JavaScript.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Enter both a username and a password.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 },
    );
  }

  const result = await authService.login(parsed.data);
  if (!result.ok) {
    return Response.json(
      {
        error: {
          code: result.error.code ?? "LOGIN_FAILED",
          message: result.error.message,
          request_id: result.error.requestId,
        },
      },
      { status: result.error.status === 0 ? 502 : result.error.status },
    );
  }

  await writeSessionCookie(result.session);

  return Response.json({
    data: {
      user: {
        id: result.session.user.id,
        username: result.session.user.username,
        fullName: result.session.user.fullName,
        email: result.session.user.email,
        role: result.session.user.role,
      },
    },
  });
}
