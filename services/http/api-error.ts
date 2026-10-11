/**
 * Normalised API error.
 *
 * Every failure surfaced to the UI passes through this type so toasts, inline
 * field errors and support diagnostics have a consistent shape.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly details: Record<string, unknown> | null;
  readonly requestId: string | null;

  constructor({
    status,
    code = null,
    message,
    details = null,
    requestId = null,
  }: {
    status: number;
    code?: string | null;
    message?: string | null;
    details?: Record<string, unknown> | null;
    requestId?: string | null;
  }) {
    super(message || "The request could not be completed.");
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isAuthError(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** True when the failure carries field-level details we can map onto a form. */
  get fieldErrors(): Record<string, string> {
    if (!this.details) return {};
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(this.details)) {
      if (typeof value === "string") {
        result[key] = value;
      } else if (Array.isArray(value) && typeof value[0] === "string") {
        result[key] = value[0];
      }
    }
    return result;
  }

  /**
   * User-facing message, exactly as Flask decided it. The API's error handler
   * only ever emits safe wording (e.g. "Invalid username or password.",
   * "Something went wrong. Quote the request id to support."), so nothing is
   * rewritten on this side.
   */
  get displayMessage(): string {
    return this.message;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Human-readable fallback per status code. Used when Flask does not supply a
 * message; raw stack traces and internal exception detail are never shown.
 */
export function messageForStatus(status: number): string {
  switch (status) {
    case 400:
      return "The request could not be completed. Please check the details and try again.";
    case 401:
      return "Your session has expired. Please sign in again.";
    case 403:
      return "You do not have permission to perform this action.";
    case 404:
      return "The record could not be found or is no longer available.";
    case 409:
      return "This change conflicts with the current state of the record. Please refresh and try again.";
    case 422:
      return "Some details could not be validated. Please review the highlighted fields.";
    case 429:
      return "Too many requests. Please wait a moment and try again.";
    default:
      if (status >= 500) {
        return "The service is temporarily unavailable. Please try again.";
      }
      return "The request could not be completed.";
  }
}

/** Extracts the standard Flask error envelope from a parsed response body. */
export function parseErrorEnvelope(
  status: number,
  body: unknown,
  requestId: string | null = null,
): ApiError {
  const envelope = (body as { error?: Record<string, unknown> } | null)?.error;
  if (envelope && typeof envelope === "object") {
    return new ApiError({
      status,
      code: typeof envelope.code === "string" ? envelope.code : null,
      message:
        typeof envelope.message === "string" && envelope.message.trim()
          ? envelope.message
          : messageForStatus(status),
      details:
        envelope.details && typeof envelope.details === "object"
          ? (envelope.details as Record<string, unknown>)
          : null,
      requestId:
        typeof envelope.request_id === "string" ? envelope.request_id : requestId,
    });
  }
  return new ApiError({ status, message: messageForStatus(status), requestId });
}
