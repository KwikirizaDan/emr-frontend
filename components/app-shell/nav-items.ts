/** Role-aware navigation model that drives the application sidebar. */
import {
  BedDouble,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Stethoscope,
  Syringe,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PERMISSIONS, can, type Permission, type PermissionSubject } from "@/lib/permissions";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Permission required for the entry to be visible at all. */
  permission: Permission;
};

export type NavSection = {
  /** Omitted for the first, unlabelled section. */
  title?: string;
  items: NavItem[];
};

/**
 * Role-aware navigation.
 *
 * The role matrix in the blueprint is mirrored here for navigation only. The
 * backend permission matrix remains the source of truth: an entry hidden here
 * is also rejected by Flask, and a `403` is always honoured in the UI rather
 * than bypassed.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: PERMISSIONS.dashboardView,
      },
      {
        title: "Patients",
        href: "/patients",
        icon: Users,
        permission: PERMISSIONS.patientView,
      },
      {
        title: "Encounters",
        href: "/encounters",
        icon: Stethoscope,
        permission: PERMISSIONS.encounterView,
      },
      {
        title: "Admissions",
        href: "/admissions",
        icon: BedDouble,
        permission: PERMISSIONS.admissionView,
      },
      {
        title: "Surgeries",
        href: "/surgeries",
        icon: Syringe,
        permission: PERMISSIONS.surgeryView,
      },
      {
        title: "Follow-ups",
        href: "/follow-ups",
        icon: CalendarClock,
        permission: PERMISSIONS.followupView,
      },
      {
        title: "Wards & beds",
        href: "/wards",
        icon: ClipboardList,
        permission: PERMISSIONS.wardView,
      },
    ],
  },
  {
    title: "Worklists",
    items: [
      {
        title: "Inpatients",
        href: "/worklists/inpatients",
        icon: BedDouble,
        permission: PERMISSIONS.admissionView,
      },
      {
        title: "Today's surgeries",
        href: "/worklists/surgeries",
        icon: Syringe,
        permission: PERMISSIONS.surgeryView,
      },
      {
        title: "Follow-ups due",
        href: "/worklists/follow-ups",
        icon: CalendarClock,
        permission: PERMISSIONS.followupView,
      },
    ],
  },
  {
    items: [
      {
        title: "Users",
        href: "/users",
        icon: ShieldCheck,
        permission: PERMISSIONS.userView,
      },
      {
        title: "Audit logs",
        href: "/audit-logs",
        icon: ScrollText,
        permission: PERMISSIONS.auditView,
      },
      {
        title: "Recycle bin",
        href: "/recycle-bin",
        icon: Trash2,
        permission: PERMISSIONS.recycleBinView,
      },
    ],
  },
];

/** Returns only the navigation sections and entries the subject may see. */
export function filterNavSections(subject: PermissionSubject): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => can(subject, item.permission)),
  })).filter((section) => section.items.length > 0);
}
