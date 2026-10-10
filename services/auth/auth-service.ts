import "server-only";

import { ENDPOINTS } from "@/services/http/endpoints";
import { flaskRequest } from "@/services/http/api-client";
import {
  ApiError,
  messageForStatus,
  parseErrorEnvelope,
} from "@/services/http/api-error";
import type { SessionPayload, SessionUser } from "@/lib/auth/session";

/** Login request body expected by `POST /auth/login`. */
export type LoginInput = {
  username: string;
  password: string;
};

type AuthTokens = {
  access_token?: string;
  refresh_token?: string;
  access_token_expires_at?: number | string;
  refresh_token_expires_at?: number | string;
  expires_in?: number;
};

/**
 * Raw user shape from Flask. Both the documented snake_case keys and camelCase
 * are accepted so the normaliser keeps working if the schema is renamed.
 */
type RawUser = {
  id?: string | number;
  username?: string;
  full_name?: string;
  fullName?: string;
  email?: string;
  role?: string;
};

type LoginResponse = AuthTokens & {
  user?: RawUser;
};

function toSessionUser(raw: RawUser): SessionUser {
  return {
    id: String(raw.id ?? ""),
    username: raw.username ?? "",
    fullName: raw.full_name ?? raw.fullName ?? raw.username ?? "",
    email: raw.email ?? null,
    role: raw.role ?? "",
  };
}

type RefreshResponse = AuthTokens;

export type AuthResult =
  | { ok: true; session: SessionPayload }
  | { ok: false; error: ApiError };

function coerceExpiry(value: number | string | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    const asDate = Date.parse(value);
    if (!Number.isNaN(asDate)) return Math.floor(asDate / 1000);
  }
  return null;
}

/**
 * Never reveal whether a username exists: every failed sign-in returns the same
 * generic message regardless of the underlying reason.
 */
const GENERIC_LOGIN_FAILURE = "Incorrect username or password.";

function buildSession(login: LoginResponse): SessionPayload | null {
  if (!login.access_token || !login.refresh_token) return null;

  return {
    accessToken: login.access_token,
    refreshToken: login.refresh_token,
    accessTokenExpiresAt:
      coerceExpiry(login.access_token_expires_at) ??
      (typeof login.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + login.expires_in
        : null),
    refreshTokenExpiresAt: coerceExpiry(login.refresh_token_expires_at),
    user: toSessionUser(login.user ?? {}),
  };
}

/** Builds a session from a refresh response, keeping the already-known user. */
function refreshSession(refresh: RefreshResponse, previous: SessionPayload): SessionPayload | null {
  if (!refresh.access_token) return null;
  return {
    ...previous,
    accessToken: refresh.access_token,
    accessTokenExpiresAt:
      coerceExpiry(refresh.access_token_expires_at) ??
      (typeof refresh.expires_in === "number"
        ? Math.floor(Date.now() / 1000) + refresh.expires_in
        : null),
    refreshToken: refresh.refresh_token ?? previous.refreshToken,
    refreshTokenExpiresAt: coerceExpiry(refresh.refresh_token_expires_at),
  };
}

export const authService = {
  /** Calls `POST /auth/login` and normalises the response into a session. */
  async login(input: LoginInput): Promise<AuthResult> {
    const response = await flaskRequest<LoginResponse>(ENDPOINTS.auth.login, {
      method: "POST",
      body: input,
    });

    if (!response.ok) {
      // 401 means bad credentials; anything else keeps Flask's own message so
      // support can diagnose it, but the username is never confirmed to the user.
      const message =
        response.status === 401
          ? GENERIC_LOGIN_FAILURE
          : (response.data as { error?: { message?: string } })?.error?.message ??
            messageForStatus(response.status);
      return {
        ok: false,
        error: new ApiError({
          status: response.status,
          code: (response.data as { error?: { code?: string } })?.error?.code ?? null,
          message,
          requestId: response.requestId,
        }),
      };
    }

    const session = buildSession(response.data ?? {});
    if (!session) {
      return { ok: false, error: new ApiError({ status: 502, message: messageForStatus(502) }) };
    }
    return { ok: true, session };
  },

  /** Rotates the access token using the refresh token stored in the session. */
  async refresh(session: SessionPayload): Promise<AuthResult> {
    const response = await flaskRequest<RefreshResponse>(ENDPOINTS.auth.refresh, {
      method: "POST",
      // Accept either documented shape: bearer refresh token or JSON body.
      accessToken: session.refreshToken,
      body: { refresh_token: session.refreshToken },
    });

    if (!response.ok) {
      return { ok: false, error: parseErrorEnvelope(response.status, response.data, response.requestId) };
    }

    const refreshed = refreshSession(response.data ?? {}, session);
    if (!refreshed) {
      return { ok: false, error: new ApiError({ status: 502, message: messageForStatus(502) }) };
    }
    return { ok: true, session: refreshed };
  },

  /** Revokes the refresh token server-side. */
  async logout(session: SessionPayload): Promise<void> {
    await flaskRequest(ENDPOINTS.auth.logout, {
      method: "POST",
      accessToken: session.accessToken,
      body: { refresh_token: session.refreshToken },
    });
    // The cookie is cleared by the route handler even if revocation failed, so
    // the browser is never left holding a session the user asked to end.
  },

  /** Loads the current signed-in user with the access token. */
  async me(accessToken: string): Promise<SessionUser> {
    const response = await flaskRequest<RawUser>(ENDPOINTS.auth.me, { accessToken });
    if (!response.ok) {
      throw parseErrorEnvelope(response.status, response.data, response.requestId);
    }
    return toSessionUser(response.data ?? {});
  },
};

