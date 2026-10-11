/**
 * Normalised backend errors.
 *
 * Every failure surfaced to the UI passes through this type so forms, toasts,
 * and support diagnostics share one consistent contract.
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

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Message exactly as Flask decided to send it. */
  get displayMessage(): string {
    return this.message;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Safe fallback copy used when Flask omits a message.
 * The API never exposes raw exception details to the browser.
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
  const errorBody = isRecord(body) && isRecord(body.error) ? body.error : null;

  if (errorBody) {
    return new ApiError({
      status,
      code: typeof errorBody.code === "string" ? errorBody.code : null,
      message:
        typeof errorBody.message === "string" && errorBody.message.trim()
          ? errorBody.message
          : messageForStatus(status),
      details: isRecord(errorBody.details) ? errorBody.details : null,
      requestId:
        typeof errorBody.request_id === "string" ? errorBody.request_id : requestId,
    });
  }

  return new ApiError({ status, message: messageForStatus(status), requestId });
}
