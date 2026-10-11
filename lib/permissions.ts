/**
 * Client-side permission helpers.
 *
 * IMPORTANT: Flask is the sole authority for authorisation. The API advertises
 * each role's effective permission set on `/auth/login` and `/auth/me`, and
 * `can()` uses that list verbatim. The matrix below is only a conservative
 * offline fallback so the UI can render while the request is in flight and
 * keep working for an unknown/legacy user. Every check must still be
 * reconsidered by the backend, and a `403` must always be honoured by showing
 * an access-denied state rather than retrying.
 */

export const ROLES = ["ADMIN", "REGISTRAR", "NURSE", "DOCTOR", "SURGEON"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrator",
  REGISTRAR: "Registrar",
  NURSE: "Nurse",
  DOCTOR: "Doctor",
  SURGEON: "Surgeon",
};

/**
 * Permission strings decided by the API (`app/permissions.py`). The client
 * mirrors them by name so `can()` can compare the API-provided list directly.
 */
export const PERMISSIONS = {
  dashboardView: "dashboard:view",
  patientView: "patient:read",
  patientCreate: "patient:create",
  patientUpdate: "patient:update",
  patientDelete: "patient:delete",
  timelineView: "timeline:read",
  encounterView: "encounter:read",
  encounterCreate: "encounter:create",
  encounterUpdate: "encounter:update",
  encounterClose: "encounter:close",
  diagnosisCreate: "diagnosis:create",
  diagnosisUpdate: "diagnosis:update",
  diagnosisDelete: "diagnosis:delete",
  admissionView: "admission:read",
  admissionCreate: "admission:create",
  admissionDischarge: "admission:discharge",
  wardView: "ward:read",
  wardManage: "ward:manage",
  surgeryView: "surgery:read",
  surgeryManage: "surgery:update",
  followupView: "followup:read",
  followupCreate: "followup:create",
  followupManage: "followup:update",
  userView: "user:manage",
  userManage: "user:manage",
  auditView: "audit:read",
  recycleBinView: "recyclebin:read",
  recycleBinRestore: "recyclebin:restore",
  worklistView: "worklist:read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

/**
 * Offline mirror of `ROLE_PERMISSIONS` in `app/permissions.py`. The API's own
 * list always wins in `can()`; this only fills in while it is unavailable.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // Administrator is the maximum role: every permission.
  ADMIN: ALL,
  REGISTRAR: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
    PERMISSIONS.followupView,
    PERMISSIONS.followupCreate,
    PERMISSIONS.followupManage,
    PERMISSIONS.worklistView,
  ],
  NURSE: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.timelineView,
    PERMISSIONS.encounterView,
    PERMISSIONS.encounterCreate,
    PERMISSIONS.encounterUpdate,
    PERMISSIONS.admissionView,
    PERMISSIONS.admissionCreate,
    PERMISSIONS.wardView,
    PERMISSIONS.surgeryView,
    PERMISSIONS.followupView,
    PERMISSIONS.worklistView,
  ],
  DOCTOR: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
    PERMISSIONS.timelineView,
    PERMISSIONS.encounterView,
    PERMISSIONS.encounterCreate,
    PERMISSIONS.encounterUpdate,
    PERMISSIONS.encounterClose,
    PERMISSIONS.diagnosisCreate,
    PERMISSIONS.diagnosisUpdate,
    PERMISSIONS.diagnosisDelete,
    PERMISSIONS.admissionView,
    PERMISSIONS.admissionCreate,
    PERMISSIONS.admissionDischarge,
    PERMISSIONS.wardView,
    PERMISSIONS.surgeryView,
    PERMISSIONS.followupView,
    PERMISSIONS.followupCreate,
    PERMISSIONS.followupManage,
    PERMISSIONS.worklistView,
  ],
  // Surgeon: doctor capabilities plus surgery scheduling and transitions.
  SURGEON: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
    PERMISSIONS.timelineView,
    PERMISSIONS.encounterView,
    PERMISSIONS.encounterCreate,
    PERMISSIONS.encounterUpdate,
    PERMISSIONS.encounterClose,
    PERMISSIONS.diagnosisCreate,
    PERMISSIONS.diagnosisUpdate,
    PERMISSIONS.diagnosisDelete,
    PERMISSIONS.admissionView,
    PERMISSIONS.admissionCreate,
    PERMISSIONS.admissionDischarge,
    PERMISSIONS.wardView,
    PERMISSIONS.surgeryView,
    PERMISSIONS.surgeryManage,
    PERMISSIONS.followupView,
    PERMISSIONS.followupCreate,
    PERMISSIONS.followupManage,
    PERMISSIONS.worklistView,
  ],
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export type PermissionSubject = {
  role?: string | null;
  permissions?: readonly string[] | null;
} | null | undefined;

export function permissionsForRole(role: string | null | undefined): Permission[] {
  return isRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/** The full permission set that may ever be advertised to the client. */
export const ALL_PERMISSIONS: readonly Permission[] = ALL;

export function can(subject: PermissionSubject, permission: Permission): boolean {
  if (!subject) return false;
  // The permission list supplied by the API is authoritative and wins over the
  // mirrored role map whenever it is present.
  if (subject.permissions?.length) {
    return subject.permissions.includes(permission);
  }
  return permissionsForRole(subject.role).includes(permission);
}

export function canAny(subject: PermissionSubject, permissions: Permission[]): boolean {
  return permissions.some((permission) => can(subject, permission));
}

export function canAll(subject: PermissionSubject, permissions: Permission[]): boolean {
  return permissions.every((permission) => can(subject, permission));
}

export function hasRole(subject: PermissionSubject, ...roles: Role[]): boolean {
  if (!subject?.role) return false;
  return roles.includes(subject.role as Role);
}