/** Dashboard summary cards and operational work panels. */
"use client";

import * as React from "react";
import Link from "next/link";
import {
  BedDouble,
  CalendarClock,
  Inbox,
  Syringe,
  type LucideIcon,
} from "lucide-react";
import useSWR from "swr";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingCards, LoadingState } from "@/components/shared/loading-state";
import { MetricCard } from "@/features/dashboard/components/metric-card";
import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { PermissionGate, AccessDenied } from "@/components/shared/permission-gate";
import { can, PERMISSIONS } from "@/lib/permissions";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { worklistService } from "@/services/worklists/worklist-service";
import { formatDateTime, formatTime, todayKey } from "@/lib/date";
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
      subject={user}
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
  const { user } = useCurrentUser();
  const today = todayKey();

  const canSeeSurgeries = can(user, PERMISSIONS.worklistView);
  const canSeeInpatients = can(user, PERMISSIONS.worklistView);
  const canSeeFollowups = can(user, PERMISSIONS.worklistView);

  const surgeries = useSWR(
    canSeeSurgeries ? `/worklists/surgeries?day=${today}&per_page=5` : null,
    () => worklistService.surgeries(today, { per_page: 5 }),
  );
  const inpatients = useSWR(canSeeInpatients ? "/worklists/inpatients?per_page=5" : null, () =>
    worklistService.inpatients({ per_page: 5 }),
  );
  const followups = useSWR(
    canSeeFollowups ? `/worklists/followups?from=${today}&per_page=5` : null,
    () => worklistService.followupsDue({ date_from: today, per_page: 5 }),
  );

  const panels: React.ReactNode[] = [];

  if (canSeeSurgeries) {
    panels.push(
      <WorkPanel
        key="surgeries"
        title="Today's surgeries"
        icon={Syringe}
        href="/worklists/surgeries"
        isLoading={surgeries.isLoading}
        error={surgeries.error}
        onRetry={() => void surgeries.mutate()}
        hasItems={(surgeries.data?.data.length ?? 0) > 0}
        emptyText="No surgeries are scheduled for today."
      >
        {(surgeries.data?.data ?? []).map((item) => (
          <WorkItem
            key={item.surgery_id}
            href={`/surgeries/${item.surgery_id}`}
            primary={item.patient_name}
            secondary={`${formatTime(item.scheduled_start)} · ${item.procedure}`}
          />
        ))}
      </WorkPanel>,
    );
  }

  if (canSeeInpatients) {
    panels.push(
      <WorkPanel
        key="inpatients"
        title="Inpatients needing attention"
        icon={BedDouble}
        href="/worklists/inpatients"
        isLoading={inpatients.isLoading}
        error={inpatients.error}
        onRetry={() => void inpatients.mutate()}
        hasItems={(inpatients.data?.data.length ?? 0) > 0}
        emptyText="No patients are currently admitted."
      >
        {(inpatients.data?.data ?? []).map((item) => (
          <WorkItem
            key={item.admission_id}
            href={`/admissions/${item.admission_id}`}
            primary={item.patient_name}
            secondary={`${item.ward} · ${item.bed}`}
          />
        ))}
      </WorkPanel>,
    );
  }

  if (canSeeFollowups) {
    panels.push(
      <WorkPanel
        key="followups"
        title="Follow-ups due"
        icon={CalendarClock}
        href="/worklists/follow-ups"
        isLoading={followups.isLoading}
        error={followups.error}
        onRetry={() => void followups.mutate()}
        hasItems={(followups.data?.data.length ?? 0) > 0}
        emptyText="No follow-ups are due right now."
      >
        {(followups.data?.data ?? []).map((item) => (
          <WorkItem
            key={item.follow_up_id}
            href={`/follow-ups/${item.follow_up_id}`}
            primary={item.patient_name}
            secondary={formatDateTime(item.scheduled_at)}
          />
        ))}
      </WorkPanel>,
    );
  }

  if (panels.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={Inbox}
            title="No operational worklists available"
            description="Your role does not have access to the inpatient, surgery or follow-up worklists."
          />
        </CardContent>
      </Card>
    );
  }

  return <div className="grid gap-4 lg:grid-cols-3">{panels}</div>;
}

function WorkPanel({
  title,
  icon: Icon,
  href,
  isLoading,
  error,
  onRetry,
  hasItems,
  emptyText,
  children,
}: {
  title: string;
  icon: LucideIcon;
  href: string;
  isLoading: boolean;
  error: unknown;
  onRetry: () => void;
  hasItems: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="flex-row items-center justify-between gap-2 pb-0">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center bg-muted text-muted-foreground"
          >
            <Icon className="size-4" />
          </span>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <Link
          href={href}
          className={buttonVariants({ variant: "ghost", size: "xs" })}
        >
          View all
        </Link>
      </CardHeader>
      <CardContent className="grid gap-1">
        {isLoading ? (
          <LoadingState rows={3} />
        ) : error ? (
          <ErrorState error={error} onRetry={onRetry} />
        ) : !hasItems ? (
          <p className="py-2 text-xs text-muted-foreground">{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

function WorkItem({
  href,
  primary,
  secondary,
}: {
  href: string;
  primary: string;
  secondary: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0 hover:text-primary"
    >
      <span className="truncate font-medium">{primary}</span>
      <span className="shrink-0 text-xs text-muted-foreground">{secondary}</span>
    </Link>
  );
}
