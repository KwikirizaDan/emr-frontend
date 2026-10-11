/** Paginated, status-filterable list of surgeries. */
"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Slice } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectNative } from "@/components/shared/select-native";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { surgeryService } from "@/services/surgeries/surgery-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import type { Surgery } from "@/services/http/api-types";

const STATUSES = ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

/** Lists surgeries with a status filter and permission-gated scheduling. */
export function SurgeriesTable() {
  const { user } = useCurrentUser();
  const [status, setStatus] = React.useState<"" | (typeof STATUSES)[number]>("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const { data, error, isLoading, mutate } = useSWR(
    `/surgeries?status=${status}&page=${page}&per_page=${perPage}`,
    () => surgeryService.list({ status: status || undefined, page, per_page: perPage }),
  );

  const canManage = can(user, PERMISSIONS.surgeryManage);

  const columns: DataTableColumn<Surgery>[] = [
    { id: "id", header: "Surgery", cell: (surgery) => <span className="font-mono text-xs">#{surgery.id}</span> },
    {
      id: "patient",
      header: "Patient",
      cell: (surgery) => (
        <Link
          href={`/patients/${surgery.patient_id}`}
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          Patient #{surgery.patient_id}
        </Link>
      ),
    },
    {
      id: "procedure",
      header: "Procedure",
      cell: (surgery) => (
        <span className="text-muted-foreground">
          {surgery.procedure_name}
          {surgery.procedure_code ? ` (${surgery.procedure_code})` : ""}
        </span>
      ),
    },
    { id: "theatre", header: "Theatre", cell: (surgery) => surgery.theatre },
    { id: "surgeon", header: "Surgeon", cell: (surgery) => `#${surgery.lead_surgeon_id}` },
    {
      id: "scheduled_start",
      header: "Scheduled",
      cell: (surgery) => formatDateTime(surgery.scheduled_start),
    },
    {
      id: "status",
      header: "Status",
      cell: (surgery) => <WorkflowStatusBadge status={surgery.status} />,
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (surgery) => (
        <Button variant="ghost" size="xs" render={<Link href={`/surgeries/${surgery.id}`} />}>
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
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </SelectNative>
        </label>

        {canManage ? (
          <Button render={<Link href="/surgeries/new" />}>
            <Plus className="size-4" />
            Schedule surgery
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Surgeries"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(surgery) => surgery.id}
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
            icon={Slice}
            title="No surgeries found"
            description="Schedule a surgery for an admitted patient."
            action={
              canManage ? (
                <Button render={<Link href="/surgeries/new" />}>
                  <Plus className="size-4" />
                  Schedule surgery
                </Button>
              ) : null
            }
          />
        }
      />
    </div>
  );
}
