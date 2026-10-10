"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { AccessDenied } from "@/components/shared/permission-gate";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { worklistService } from "@/services/worklists/worklist-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime, toDateInputValue } from "@/lib/date";
import type { FollowupWorklistItem } from "@/services/http/api-types";

function plusDays(days: number): string {
  return toDateInputValue(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

export function FollowupsWorklist() {
  const { user } = useCurrentUser();
  const [dateFrom, setDateFrom] = React.useState(plusDays(0));
  const [dateTo, setDateTo] = React.useState(plusDays(7));
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const canView = can({ role: user?.role }, PERMISSIONS.followupView);

  const { data, error, isLoading, mutate } = useSWR(
    canView ? `/worklists/followups?from=${dateFrom}&to=${dateTo}&page=${page}&per_page=${perPage}` : null,
    () =>
      worklistService.followupsDue({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        per_page: perPage,
      }),
  );

  if (!canView) return <AccessDenied />;

  const columns: DataTableColumn<FollowupWorklistItem>[] = [
    {
      id: "scheduled_at",
      header: "Scheduled",
      cell: (item) => (
        <span className="whitespace-nowrap">{formatDateTime(item.scheduled_at)}</span>
      ),
    },
    {
      id: "patient",
      header: "Patient",
      cell: (item) => (
        <div className="grid gap-0.5">
          <Link
            href={`/patients/${item.patient_id}`}
            className="font-medium underline-offset-4 hover:text-primary hover:underline"
          >
            {item.patient_name}
          </Link>
          <span className="font-mono text-xs text-muted-foreground">{item.mrn}</span>
        </div>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (item) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">{item.reason}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (item) => <WorkflowStatusBadge status={item.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (item) => (
        <Button variant="ghost" size="xs" render={<Link href={`/follow-ups/${item.follow_up_id}`} />}>
          <ExternalLink className="size-3.5" />
          Follow-up
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-44">
          <FormField id="followups_from" label="From">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
              />
            )}
          </FormField>
        </div>
        <div className="w-full sm:w-44">
          <FormField id="followups_to" label="To">
            {(control) => (
              <Input
                {...control}
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
              />
            )}
          </FormField>
        </div>
      </div>

      <DataTable
        caption="Follow-ups due"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(item) => item.follow_up_id}
        loading={isLoading}
        error={error}
        onRetry={() => void mutate()}
        meta={data?.meta ?? null}
        onPageChange={setPage}
        onPerPageChange={(size) => {
          setPerPage(size);
          setPage(1);
        }}
        empty={
          <EmptyState
            icon={CalendarClock}
            title="No follow-ups due"
            description="No appointments fall within the selected date range."
          />
        }
      />
    </div>
  );
}
