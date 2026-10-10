/** Display helpers for values returned by the Flask API. */

/** `IN_PROGRESS` → `In progress`, `OPD` → `Opd`. */
export function humanizeEnum(value: string | null | undefined): string {
  if (!value) return "—";
  const spaced = value.replace(/[_-]+/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** `MALE` → `Male`, keeps acronyms such as `MRN` untouched when pre-formatted. */
export function formatSex(value: string | null | undefined): string {
  return humanizeEnum(value);
}

/** `Nakato Sarah` → `NS` */
export function initials(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export type PersonLike = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
};

/** `Nakato, Sarah` — stable, readable clinical ordering. */
export function formatPersonName(person: PersonLike | null | undefined): string {
  if (!person) return "—";
  const full = person.full_name?.trim();
  if (full) return full;
  const last = person.last_name?.trim();
  const first = person.first_name?.trim();
  if (last && first) return `${last}, ${first}`;
  return last || first || "—";
}

/** `Sarah Nakato` — natural ordering for identity headers. */
export function formatPersonDisplayName(person: PersonLike | null | undefined): string {
  if (!person) return "—";
  const full = person.full_name?.trim();
  if (full) return full;
  return [person.first_name?.trim(), person.last_name?.trim()].filter(Boolean).join(" ") || "—";
}

/** Normalises Ugandan numbers for display: `+256 772 123 456`. */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return "—";
  return value.trim();
}

/** Renders a MRN without ever inventing one. */
export function formatMrn(value: string | null | undefined): string {
  const mrn = value?.trim();
  return mrn ? mrn : "—";
}

export function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value ? "Yes" : "No";
}

/** Wraps long identifiers so they do not stretch clinical tables. */
export function truncateMiddle(value: string, maxLength = 24): string {
  if (value.length <= maxLength) return value;
  const keep = Math.floor((maxLength - 1) / 2);
  return `${value.slice(0, keep)}…${value.slice(-keep)}`;
}
