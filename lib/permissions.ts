/**
 * Client-side permission helpers.
 *
 * IMPORTANT: this is a UI-convenience mirror only. It exists so navigation and
 * controls can be hidden before a pointless request is made. Flask is the sole
 * authority for authorisation — every one of these checks must still be
 * reconsidered by the backend, and a `403` must always be honoured by showing an
 * access-denied state rather than retrying.
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

export const PERMISSIONS = {
  dashboardView: "dashboard:view",
  patientView: "patient:view",
  patientCreate: "patient:create",
  patientUpdate: "patient:update",
  patientDelete: "patient:delete",
  encounterView: "encounter:view",
  encounterCreate: "encounter:create",
  encounterUpdate: "encounter:update",
  encounterClose: "encounter:close",
  diagnosisCreate: "diagnosis:create",
  diagnosisUpdate: "diagnosis:update",
  diagnosisDelete: "diagnosis:delete",
  admissionView: "admission:view",
  admissionCreate: "admission:create",
  admissionDischarge: "admission:discharge",
  wardView: "ward:view",
  wardManage: "ward:manage",
  surgeryView: "surgery:view",
  surgeryManage: "surgery:manage",
  followupView: "followup:view",
  followupManage: "followup:manage",
  userView: "user:view",
  userManage: "user:manage",
  auditView: "audit:view",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL: Permission[] = Object.values(PERMISSIONS);

/**
 * Conservative mapping derived from the role matrix in the blueprint.
 * Where the backend is known to be stricter, the narrower set wins.
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // An administrator manages accounts, wards and the audit trail but is
  // deliberately not given clinical record access by the backend.
  ADMIN: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.wardView,
    PERMISSIONS.wardManage,
    PERMISSIONS.followupView,
    PERMISSIONS.userView,
    PERMISSIONS.userManage,
    PERMISSIONS.auditView,
  ],
  REGISTRAR: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
    PERMISSIONS.followupView,
    PERMISSIONS.followupManage,
  ],
  NURSE: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
    PERMISSIONS.encounterView,
    PERMISSIONS.encounterCreate,
    PERMISSIONS.encounterUpdate,
    PERMISSIONS.admissionView,
    PERMISSIONS.admissionCreate,
    PERMISSIONS.wardView,
    PERMISSIONS.followupView,
  ],
  DOCTOR: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
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
    PERMISSIONS.followupView,
    PERMISSIONS.followupManage,
  ],
  // Surgeon: doctor capabilities plus surgery scheduling and transitions.
  SURGEON: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.patientView,
    PERMISSIONS.patientCreate,
    PERMISSIONS.patientUpdate,
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
    PERMISSIONS.followupManage,
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
  // An explicit permission list from the API wins over the mirrored role map.
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
