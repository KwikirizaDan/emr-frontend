/**
 * Flask API endpoint map.
 *
 * The base path is `/api/v1`. Every path here must be verified against the
 * Flask routes and schemas before a feature is wired up — this map records the
 * documented contract, it does not replace reading the backend source.
 */
export const API_BASE_PATH = "/api/v1";

export const ENDPOINTS = {
  health: "/health",

  auth: {
    login: "/auth/login",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
    me: "/auth/me",
  },

  dashboard: "/dashboard",

  users: "/users",
  user: (userId: string | number) => `/users/${userId}`,
  userResetPassword: (userId: string | number) => `/users/${userId}/reset-password`,

  patients: "/patients",
  patient: (patientId: string | number) => `/patients/${patientId}`,
  patientTimeline: (patientId: string | number) => `/patients/${patientId}/timeline`,

  encounters: "/encounters",
  encounter: (encounterId: string | number) => `/encounters/${encounterId}`,
  closeEncounter: (encounterId: string | number) => `/encounters/${encounterId}/close`,
  encounterDiagnoses: (encounterId: string | number) => `/encounters/${encounterId}/diagnoses`,

  wards: "/wards",
  wardBeds: (wardId: string | number) => `/wards/${wardId}/beds`,

  admissions: "/admissions",
  admission: (admissionId: string | number) => `/admissions/${admissionId}`,
  dischargeAdmission: (admissionId: string | number) => `/admissions/${admissionId}/discharge`,

  surgeries: "/surgeries",
  surgery: (surgeryId: string | number) => `/surgeries/${surgeryId}`,
  surgeryStart: (surgeryId: string | number) => `/surgeries/${surgeryId}/start`,
  surgeryComplete: (surgeryId: string | number) => `/surgeries/${surgeryId}/complete`,
  surgeryCancel: (surgeryId: string | number) => `/surgeries/${surgeryId}/cancel`,

  followups: "/followups",
  followup: (followupId: string | number) => `/followups/${followupId}`,
  followupStatus: (followupId: string | number) => `/followups/${followupId}/status`,

  worklists: {
    inpatients: "/worklists/inpatients",
    surgeries: "/worklists/surgeries",
    followups: "/worklists/followups",
  },

  auditLogs: "/audit-logs",
} as const;

/** Query-parameter names shared across list endpoints. */
export const QUERY_KEYS = {
  search: "q",
  page: "page",
  perPage: "per_page",
  day: "day",
  dateFrom: "date_from",
  dateTo: "date_to",
  reason: "reason",
} as const;
