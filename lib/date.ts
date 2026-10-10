/**
 * Timezone and date helpers.
 *
 * All times are produced and displayed in Africa/Kampala, while values sent to
 * Flask keep the original representation. The backend stores UTC; we only
 * format for display and derive local date keys for filters.
 */

export const APP_TIME_ZONE = "Africa/Kampala";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthDayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIME_ZONE,
  day: "2-digit",
  month: "short",
});

function toDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `12 Oct 2026, 14:30` in Africa/Kampala. */
export function formatDateTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateTimeFormatter.format(date) : "—";
}

/** `12 Oct 2026` in Africa/Kampala. */
export function formatDate(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dateFormatter.format(date) : "—";
}

/** `14:30` in Africa/Kampala. */
export function formatTime(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? timeFormatter.format(date) : "—";
}

/** `12 Oct` in Africa/Kampala — compact label for dense tables. */
export function formatDayMonth(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? monthDayFormatter.format(date) : "—";
}

/** `YYYY-MM-DD` for today in Africa/Kampala; used for the `day=` worklist filter. */
export function todayKey(): string {
  return dayKeyFormatter.format(new Date());
}

/** `YYYY-MM-DD` for an arbitrary instant in Africa/Kampala. */
export function dayKey(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  return date ? dayKeyFormatter.format(date) : todayKey();
}

/** Full years between a date of birth and now. */
export function ageFromDateOfBirth(value: string | null | undefined): number | null {
  const dob = toDate(value);
  if (!dob) return null;

  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDelta = now.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}

/** `34 yrs` — for patient table and identity headers. */
export function formatAge(value: string | null | undefined): string {
  const age = ageFromDateOfBirth(value);
  return age === null ? "—" : `${age} yrs`;
}

/** `YYYY-MM-DDTHH:mm` for a `datetime-local` input, in Africa/Kampala. */
export function toDateTimeLocalValue(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/**
 * Converts a `datetime-local` value back to an ISO instant.
 * A bare local value is interpreted in the browser's timezone.
 */
export function fromDateTimeLocalValue(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** `YYYY-MM-DD` for a `date` input. */
export function toDateInputValue(value: string | number | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "";
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 10);
}
