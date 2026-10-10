import * as React from "react";
import { Lock } from "lucide-react";

import { can, type Permission, type PermissionSubject } from "@/lib/permissions";
import { EmptyState } from "@/components/shared/empty-state";

export type PermissionGateProps = {
  subject: PermissionSubject;
  permission: Permission | Permission[];
  /** How to combine multiple permissions. Defaults to "any". */
  mode?: "any" | "all";
  children: React.ReactNode;
  /** Rendered instead of the children when the permission is missing. */
  fallback?: React.ReactNode;
};

/**
 * Hides a control the current role cannot use.
 *
 * This is a usability affordance, not a security control: Flask still rejects
 * the request, and a `403` is always surfaced as an access-denied state.
 */
export function PermissionGate({
  subject,
  permission,
  mode = "any",
  children,
  fallback = null,
}: PermissionGateProps) {
  const permissions = Array.isArray(permission) ? permission : [permission];
  const allowed =
    mode === "all"
      ? permissions.every((entry) => can(subject, entry))
      : permissions.some((entry) => can(subject, entry));

  if (allowed) return <>{children}</>;
  return <>{fallback}</>;
}

/** Whole-page state for a screen the current role may not open at all. */
export function AccessDenied() {
  return (
    <EmptyState
      icon={Lock}
      title="Access denied"
      description="Your role does not permit you to view this information. If you believe this is an error, contact your system administrator."
    />
  );
}
