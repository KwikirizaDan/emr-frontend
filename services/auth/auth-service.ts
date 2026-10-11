/**
 * Server-only auth boundary for Flask.
 *
 * The BFF route handlers talk to this service, which normalises backend payloads
 * into the encrypted session format used by Next.js. Token details never reach
 * the browser; only the public user summary is returned.
 */
import "server-only";

import type { SessionPayload, SessionUser } from "@/lib/auth/session";
import { flaskRequest, type FlaskResponse } from "@/services/http/api-client";
import {
  ApiError,
  messageForStatus,
  parseErrorEnvelope,
} from "@/services/http/api-error";
import { ENDPOINTS } from "@/services/http/endpoints";

/** Login request body expected by `POST /auth/login`. */
export type LoginInput = {
  username: string;
  password: string;
};

type AuthTokenBundle = {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: number | string;
  refresh_token_expires_at?: number | string;
  expires_in?: number;
};

/**
 * Raw user payload returned by Flask. Both the documented snake_case keys and
 * the camelCase variant are accepted so the normaliser stays tolerant to schema
 * naming changes.
 */
type ApiUser = {
  id?: string | number;
  username?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
  role?: string;
  permissions?: string[];
};

type LoginResponseBody = AuthTokenBundle & {
  user?: ApiUser;
};

type RefreshResponseBody = AuthTokenBundle;

export type AuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; error: ApiError };

function toSessionUser(apiUser: ApiUser): SessionUser {
  return {
    id: String(apiUser.id ?? ""),
    username: apiUser.username ?? "",
    fullName: apiUser.full_name ?? apiUser.fullName ?? apiUser.username ?? "",
    email: apiUser.email ?? null,
    role: apiUser.role ?? "",
    permissions: Array.isArray(apiUser.permissions) ? apiUser.permissions : [],
  };
}

/**
 * Normalises a backend expiry value to Unix seconds.
 * Accepts epoch seconds, epoch milliseconds, and ISO-8601 strings.
 */
function coerceExpiry(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const numericValue = Number(value);
    if (Number.isFinite(numericValue)) {
      return numericValue;
    }

    const timestampMs = Date.parse(value);
    if (!Number.isNaN(timestampMs)) {
      return Math.floor(timestampMs / 1000);
    }
  }

  return null;
}

function resolveAccessTokenExpiry(tokenBundle: AuthTokenBundle): number | null {
  return (
    coerceExpiry(tokenBundle.access_token_expires_at) ??
    (typeof tokenBundle.expires_in === "number"
      ? Math.floor(Date.now() / 1000) + tokenBundle.expires_in
      : null)
  );
}

function resolveRefreshTokenExpiry(tokenBundle: AuthTokenBundle): number | null {
  return coerceExpiry(tokenBundle.refresh_token_expires_at);
}

/**
 * Flask returns a stable auth failure message regardless of whether the username
 * exists, so the boundary simply forwards the backend's response.
 */
function buildLoginSession(loginResponse: LoginResponseBody): SessionPayload | null {
  if (!loginResponse.access_token || !loginResponse.refresh_token) {
    return null;
  }

  return {
    accessToken: loginResponse.access_token,
    refreshToken: loginResponse.refresh_token,
    accessTokenExpiresAt: resolveAccessTokenExpiry(loginResponse),
    refreshTokenExpiresAt: resolveRefreshTokenExpiry(loginResponse),
    user: toSessionUser(loginResponse.user ?? {}),
  };
}

/** Builds a refreshed session while preserving the previously known user record. */
function buildRefreshSession(
  refreshResponse: RefreshResponseBody,
  previousSession: SessionPayload,
): SessionPayload | null {
  if (!refreshResponse.access_token) {
    return null;
  }

  return {
    ...previousSession,
    accessToken: refreshResponse.access_token,
    accessTokenExpiresAt: resolveAccessTokenExpiry(refreshResponse),
    refreshToken: refreshResponse.refresh_token ?? previousSession.refreshToken,
    refreshTokenExpiresAt: resolveRefreshTokenExpiry(refreshResponse),
  };
}

export const authService = {
  /** Calls `POST /auth/login` and normalises the response into a session. */
  async login(credentials: LoginInput): Promise<AuthResult> {
    let loginResponse: FlaskResponse<LoginResponseBody>;

    try {
      loginResponse = await flaskRequest<LoginResponseBody>(ENDPOINTS.auth.login, {
        method: "POST",
        body: credentials,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, error };
      }
      throw error;
    }

    if (!loginResponse.ok) {
      return {
        ok: false,
        error: parseErrorEnvelope(
          loginResponse.status,
          loginResponse.data,
          loginResponse.requestId,
        ),
      };
    }

    const session = buildLoginSession(loginResponse.data ?? {});
    if (!session) {
      return {
        ok: false,
        error: new ApiError({ status: 502, message: messageForStatus(502) }),
      };
    }

    return { ok: true, session };
  },

  /** Rotates the access token using the refresh token stored in the session. */
  async refresh(currentSession: SessionPayload): Promise<AuthResult> {
    let refreshResponse: FlaskResponse<RefreshResponseBody>;

    try {
      refreshResponse = await flaskRequest<RefreshResponseBody>(ENDPOINTS.auth.refresh, {
        method: "POST",
        accessToken: currentSession.refreshToken,
        body: { refresh_token: currentSession.refreshToken },
      });
    } catch (error) {
      if (error instanceof ApiError) {
        return { ok: false, error };
      }
      throw error;
    }

    if (!refreshResponse.ok) {
      return {
        ok: false,
        error: parseErrorEnvelope(
          refreshResponse.status,
          refreshResponse.data,
          refreshResponse.requestId,
        ),
      };
    }

    const refreshedSession = buildRefreshSession(refreshResponse.data ?? {}, currentSession);
    if (!refreshedSession) {
      return {
        ok: false,
        error: new ApiError({ status: 502, message: messageForStatus(502) }),
      };
    }

    return { ok: true, session: refreshedSession };
  },

  /** Revokes the refresh token server-side. */
  async logout(currentSession: SessionPayload): Promise<void> {
    const logoutResponse = await flaskRequest(ENDPOINTS.auth.logout, {
      method: "POST",
      accessToken: currentSession.accessToken,
      body: { refresh_token: currentSession.refreshToken },
    });

    if (!logoutResponse.ok) {
      throw parseErrorEnvelope(
        logoutResponse.status,
        logoutResponse.data,
        logoutResponse.requestId,
      );
    }

    // The route handler clears the cookie even if revocation fails, so the browser
    // never retains a session the user asked to end.
  },

  /** Fetches the currently signed-in user using the access token. */
  async me(accessToken: string): Promise<SessionUser> {
    const userResponse = await flaskRequest<ApiUser>(ENDPOINTS.auth.me, { accessToken });

    if (!userResponse.ok) {
      throw parseErrorEnvelope(userResponse.status, userResponse.data, userResponse.requestId);
    }

    return toSessionUser(userResponse.data ?? {});
  },
};
