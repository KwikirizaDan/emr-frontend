/** Paginated, status-filterable list of follow-ups. */
"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarClock, Plus } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectNative } from "@/components/shared/select-native";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { followUpService } from "@/services/followups/followup-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import type { FollowUp } from "@/services/http/api-types";

const STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "MISSED"] as const;

/** Lists follow-ups with a status filter and permission-gated booking. */
export function FollowupsTable() {
  const { user } = useCurrentUser();
  const [status, setStatus] = React.useState<"" | (typeof STATUSES)[number]>("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const { data, error, isLoading, mutate } = useSWR(
    `/followups?status=${status}&page=${page}&per_page=${perPage}`,
    () => followUpService.list({ status: status || undefined, page, per_page: perPage }),
  );

  const canManage = can({ role: user?.role }, PERMISSIONS.followupManage);

  const columns: DataTableColumn<FollowUp>[] = [
    {
      id: "id",
      header: "Follow-up",
      cell: (followUp) => <span className="font-mono text-xs">#{followUp.id}</span>,
    },
    {
      id: "patient",
      header: "Patient",
      cell: (followUp) => (
        <Link
          href={`/patients/${followUp.patient_id}`}
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          Patient #{followUp.patient_id}
        </Link>
      ),
    },
    {
      id: "scheduled_at",
      header: "Scheduled",
      cell: (followUp) => formatDateTime(followUp.scheduled_at),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (followUp) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">{followUp.reason}</span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (followUp) => <WorkflowStatusBadge status={followUp.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (followUp) => (
        <Button variant="ghost" size="xs" render={<Link href={`/follow-ups/${followUp.id}`} />}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Status
          <SelectNative
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as "" | (typeof STATUSES)[number]);
              setPage(1);
            }}
            className="w-40"
            aria-label="Filter by status"
          >
            <option value="">All</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </SelectNative>
        </label>

        {canManage ? (
          <Button render={<Link href="/follow-ups/new" />}>
            <Plus className="size-4" />
            Book follow-up
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Follow-ups"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(followUp) => followUp.id}
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
            title="No follow-ups found"
            description="Book a follow-up to bring a patient back for review."
            action={
              canManage ? (
                <Button render={<Link href="/follow-ups/new" />}>
                  <Plus className="size-4" />
                  Book follow-up
                </Button>
              ) : null
            }
          />
        }
      />
    </div>
  );
}
