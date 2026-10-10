"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const SEGMENT_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  patients: "Patients",
  encounters: "Encounters",
  admissions: "Admissions",
  surgeries: "Surgeries",
  "follow-ups": "Follow-ups",
  wards: "Wards & beds",
  worklists: "Worklists",
  inpatients: "Inpatients",
  users: "Users",
  "audit-logs": "Audit logs",
};

function titleForSegment(segment: string): string {
  return SEGMENT_TITLES[segment] ?? segment.replace(/-/g, " ");
}

/**
 * Breadcrumbs derived from the current path. Records are addressed by id, so a
 * record link falls back to its route label rather than leaking a patient
 * identifier into the page title.
 */
export function AppBreadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs = segments.map((segment, index) => {
    const href = `/${segments.slice(0, index + 1).join("/")}`;
    const isRecordDetail = /^[0-9a-fA-F-]{8,}$|^\d+$/.test(segment) || segment === "new" || segment === "edit";
    return {
      href,
      label: isRecordDetail ? "Details" : titleForSegment(segment),
      isLast: index === segments.length - 1,
    };
  });

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          {crumbs[0].isLast ? (
            <BreadcrumbPage>{crumbs[0].label}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link href={crumbs[0].href} />}>{crumbs[0].label}</BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {crumbs.slice(1).map((crumb) => (
          <span key={crumb.href} className="contents">
            <BreadcrumbSeparator>
              <ChevronRight className="size-3.5" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              {crumb.isLast ? (
                <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink render={<Link href={crumb.href} />}>{crumb.label}</BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </span>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
