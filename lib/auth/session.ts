/**
 * Encrypted session cookie codec.
 *
 * Seals the session with AES-256-GCM so the browser can neither read nor forge
 * it. Server-only: the key is derived from `SESSION_SECRET`.
 */
import "server-only";

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const TAG_LENGTH = 16;
const COOKIE_NAME = "emr_session";

/** Refresh-token lifetime documented by the backend, in seconds (7 days). */
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/** Cookie max-age: remaining refresh-token life, clamped to a sane range. */
function remainingLifetime(payload: SessionPayload): number {
  const expiry = payload.refreshTokenExpiresAt ?? readTokenExpiry(payload.refreshToken);
  if (!expiry) return SESSION_MAX_AGE_SECONDS;
  const remaining = expiry - Math.floor(Date.now() / 1000);
  return Math.max(60, Math.min(SESSION_MAX_AGE_SECONDS, remaining));
}

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  email: string | null;
  role: string;
  /** Effective permission set decided by the API (`/auth/login`, `/auth/me`). */
  permissions: string[];
};

export type SessionPayload = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number | null;
  refreshTokenExpiresAt: number | null;
  user: SessionUser;
};

function deriveKey(secret: string, salt: Buffer): Buffer {
  return scryptSync(secret, salt, KEY_LENGTH);
}

function seal(parts: Array<Buffer | string>): string {
  return parts.map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

/**
 * Encrypts a session payload with AES-256-GCM.
 *
 * Format: `v1.<salt>.<iv>.<tag>.<ciphertext>` (all base64url after the version).
 * Authentication means a tampered cookie fails to decrypt rather than silently
 * yielding a forged session.
 */
export function encryptSession(payload: SessionPayload): string {
  const secret = env.sessionSecret;
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(secret, salt);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return seal([VERSION, salt, iv, cipher.getAuthTag(), ciphertext]);
}

/** Decrypts a session cookie, returning `null` for absent or tampered values. */
export function decryptSession(value: string | undefined | null): SessionPayload | null {
  if (!value) return null;

  try {
    const [version, encodedSalt, encodedIv, encodedTag, encodedCiphertext] = value.split(".");
    if (version !== VERSION || !encodedSalt || !encodedIv || !encodedTag || !encodedCiphertext) {
      return null;
    }
    // Fail closed on any malformed segment rather than trusting the cookie.
    const salt = Buffer.from(encodedSalt, "base64url");
    const iv = Buffer.from(encodedIv, "base64url");
    const tag = Buffer.from(encodedTag, "base64url");
    const ciphertext = Buffer.from(encodedCiphertext, "base64url");

    if (salt.length !== SALT_LENGTH || iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
      return null;
    }

    const decipher = createDecipheriv(ALGORITHM, deriveKey(env.sessionSecret, salt), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      "utf8",
    );

    const parsed = JSON.parse(plaintext) as SessionPayload;
    if (!parsed?.accessToken || !parsed?.refreshToken || !parsed?.user?.role) {
      return null;
    }
    return parsed;
  } catch {
    // Absent, malformed or tampered cookies all mean "no session".
    return null;
  }
}

/** Reads the `exp` claim of a JWT without verifying it — used only for expiry. */
export function readTokenExpiry(token: string): number | null {
  const segment = token.split(".")[1];
  if (!segment) return null;
  try {
    const json = Buffer.from(segment, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { exp?: unknown };
    return typeof parsed.exp === "number" ? parsed.exp : null;
  } catch {
    return null;
  }
}

/** True when the access token is expired or inside the clock-skew window. */
export function isAccessTokenExpired(payload: SessionPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiry = payload.accessTokenExpiresAt ?? readTokenExpiry(payload.accessToken);
  if (!expiry) return false;
  return expiry - env.tokenSkewSeconds <= nowSeconds;
}

/** True when the refresh token is expired or inside the clock-skew window. */
export function isRefreshTokenExpired(payload: SessionPayload): boolean {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiry = payload.refreshTokenExpiresAt ?? readTokenExpiry(payload.refreshToken);
  if (!expiry) return false;
  return expiry - env.tokenSkewSeconds <= nowSeconds;
}

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: "lax";
  secure: boolean;
  path: "/";
  maxAge: number;
};

/** Cookie flags for writing a session; maxAge tracks token lifetime. */
export function sessionCookieOptions(payload?: SessionPayload): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProduction,
    path: "/",
    maxAge: payload ? remainingLifetime(payload) : SESSION_MAX_AGE_SECONDS,
  };
}

/** Cookie flags for clearing the session immediately. */
export function clearedSessionCookieOptions() {
  return { ...sessionCookieOptions(), maxAge: 0 };
}
