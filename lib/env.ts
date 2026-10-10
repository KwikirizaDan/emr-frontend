/**
 * Server-only environment configuration.
 *
 * Accessors are lazy and validated so a missing variable fails at first use
 * with an actionable message rather than at import time during a build.
 */
import "server-only";

/** Reads an env var, treating missing or blank values as unset. */
function read(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() !== "" ? value.trim() : undefined;
}

/**
 * Server-only configuration.
 *
 * `FLASK_API_BASE_URL` and `SESSION_SECRET` must never be prefixed with
 * `NEXT_PUBLIC_`, otherwise they would be inlined into the browser bundle.
 */
export const env = {
  /** Base URL of the existing Flask JSON API, e.g. http://localhost:5000 */
  get flaskApiBaseUrl(): string {
    const value = read("FLASK_API_BASE_URL");
    if (!value) {
      throw new Error(
        "FLASK_API_BASE_URL is not configured. Copy .env.example to .env.local and set it.",
      );
    }
    return value.replace(/\/+$/, "");
  },

  /** Secret used to derive the AES-256-GCM key for the encrypted session cookie. */
  get sessionSecret(): string {
    const value =
      read("SESSION_SECRET") ??
      (process.env.NODE_ENV === "development" ? "emr-development-session-secret" : undefined);
    if (!value) {
      throw new Error(
        "SESSION_SECRET is not configured. Generate one with: openssl rand -base64 32",
      );
    }
    return value;
  },

  get isProduction(): boolean {
    return process.env.NODE_ENV === "production";
  },

  /** Clock skew tolerance, in seconds, applied when checking access-token expiry. */
  get tokenSkewSeconds(): number {
    return 30;
  },
} as const;
