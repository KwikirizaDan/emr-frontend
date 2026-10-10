"use client";

import * as React from "react";
import {
  AlertTriangle,
  BedDouble,
  CalendarClock,
  Inbox,
  Syringe,
  type LucideIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingCards } from "@/components/shared/loading-state";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { PermissionGate, AccessDenied } from "@/components/shared/permission-gate";
import { PERMISSIONS } from "@/lib/permissions";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import type { DashboardData } from "@/services/http/api-types";

/** Icons applied to the metrics we know the backend intends to return. */
const METRIC_ICONS: Record<string, LucideIcon> = {
  inpatients: BedDouble,
  surgeries_today: Syringe,
  followups_due: CalendarClock,
  follow_ups_due: CalendarClock,
};

function isRenderableMetric(value: unknown): value is number | string {
  return typeof value === "number" || (typeof value === "string" && value.length > 0);
}

type RenderableMetric = [string, number | string];

function renderableMetrics(summary: DashboardData): RenderableMetric[] {
  return Object.entries(summary).filter(
    (entry): entry is RenderableMetric => isRenderableMetric(entry[1]),
  );
}

/**
 * Dashboard summary cards.
 *
 * Only metrics present in the API response are rendered, so nothing here
 * assumes a count the backend does not provide.
 */
export function DashboardSummary() {
  const { user } = useCurrentUser();
  const { summary, isLoading, error, mutate } = useDashboard();

  if (!user) return null;

  return (
    <PermissionGate
      subject={{ role: user.role }}
      permission={PERMISSIONS.dashboardView}
      fallback={<AccessDenied />}
    >
      {isLoading ? <LoadingCards /> : null}

      {!isLoading && error ? <ErrorState error={error} onRetry={() => void mutate()} /> : null}

      {!isLoading && !error && summary ? (
        <DashboardMetrics summary={summary} />
      ) : null}

      {!isLoading && !error && !summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s work</CardTitle>
          </CardHeader>
          <CardContent>
            <EmptyState
              icon={Inbox}
              title="No summary data returned"
              description="The dashboard endpoint returned no summary counts. Operational worklists are available in the Worklists section."
            />
          </CardContent>
        </Card>
      ) : null}
    </PermissionGate>
  );
}

function DashboardMetrics({ summary }: { summary: DashboardData }) {
  const entries = renderableMetrics(summary);

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Inbox}
            title="No summary counts available"
            description="The dashboard endpoint responded but did not include any summary counts."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([key, value]) => (
        <MetricCard key={key} metricKey={key} value={value} icon={METRIC_ICONS[key]} />
      ))}
    </div>
  );
}

/** Operational panels fed by the documented worklist endpoints. */
export function DashboardWorkPanels() {
  const panels = [
    {
      title: "Today's surgeries",
      description: "Theatre schedule for today in Africa/Kampala time.",
      icon: Syringe,
    },
    {
      title: "Inpatients needing attention",
      description: "Patients currently admitted, with ward and bed.",
      icon: BedDouble,
    },
    {
      title: "Follow-ups due",
      description: "Appointments that are due or overdue.",
      icon: CalendarClock,
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {panels.map((panel) => (
        <Card key={panel.title} className="gap-2">
          <CardHeader className="flex-row items-center gap-2 pb-0">
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center bg-muted text-muted-foreground"
            >
              <panel.icon className="size-4" />
            </span>
            <CardTitle className="text-sm font-medium">{panel.title}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <p className="text-xs text-muted-foreground">{panel.description}</p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden="true" />
              Wired to the worklist endpoints in the inpatient and surgery phase.
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
