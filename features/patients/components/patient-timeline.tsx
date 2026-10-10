"use client";

import * as React from "react";
import {
  BedDouble,
  CalendarClock,
  FileText,
  LogOut,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import useSWR from "swr";

import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { patientService } from "@/services/patients/patient-service";
import { formatDateTime } from "@/lib/date";
import type { TimelineEvent } from "@/services/http/api-types";

const EVENT_ICONS: Record<string, LucideIcon> = {
  ENCOUNTER: FileText,
  ADMISSION: BedDouble,
  DISCHARGE: LogOut,
  SURGERY: Syringe,
  FOLLOW_UP: CalendarClock,
};

/** Chronological patient timeline (newest first), from the authoritative endpoint. */
export function PatientTimeline({ patientId }: { patientId: string | number }) {
  const { data, error, isLoading, mutate } = useSWR(
    `/patients/${patientId}/timeline`,
    () => patientService.timeline(patientId),
  );

  if (isLoading) return <LoadingState rows={4} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;

  const events = data?.events ?? [];
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={FileText}
            title="No recorded activity"
            description="Encounters, admissions, surgeries, discharges and follow-ups will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <ol className="grid gap-3">
      {events.map((event) => (
        <TimelineItem key={`${event.type}-${event.id}`} event={event} />
      ))}
    </ol>
  );
}

function TimelineItem({ event }: { event: TimelineEvent }) {
  const Icon = EVENT_ICONS[event.type] ?? FileText;
  const details = Object.entries(event.details).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <li className="flex gap-3 bg-card p-3 ring-1 ring-foreground/10">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center bg-muted text-muted-foreground"
      >
        <Icon className="size-3.5" />
      </span>
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium">{event.title}</span>
          <WorkflowStatusBadge status={event.status} />
          <span className="text-xs text-muted-foreground">{formatDateTime(event.at)}</span>
        </div>
        {details.length ? (
          <p className="text-xs text-muted-foreground">
            {details
              .map(([key, value]) =>
                key === "diagnoses" && Array.isArray(value)
                  ? `${value.length} diagnosis${value.length === 1 ? "" : "es"}`
                  : `${key.replace(/_/g, " ")}: ${formatDetail(value)}`,
              )
              .join(" · ")}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function formatDetail(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.length ? String(value.length) : "—";
  return "—";
}