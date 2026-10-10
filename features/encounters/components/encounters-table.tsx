// Encounter register: server-backed table with status filtering and pagination.
"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectNative } from "@/components/shared/select-native";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { encounterService } from "@/services/encounters/encounter-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { humanizeEnum } from "@/lib/formatters";
import useSWR from "swr";
import type { Encounter } from "@/services/http/api-types";

/** Encounter register table with a status filter, pagination and a create action. */
export function EncountersTable() {
  const { user } = useCurrentUser();
  const [status, setStatus] = React.useState<"" | "OPEN" | "CLOSED">("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const key = `/encounters?status=${status}&page=${page}&per_page=${perPage}`;
  const { data, error, isLoading, mutate } = useSWR(key, () =>
    encounterService.list({ status: status || undefined, page, per_page: perPage }),
  );

  const canCreate = can({ role: user?.role }, PERMISSIONS.encounterCreate);

  const columns: DataTableColumn<Encounter>[] = [
    {
      id: "id",
      header: "Encounter",
      cell: (encounter) => <span className="font-mono text-xs">#{encounter.id}</span>,
    },
    {
      id: "patient",
      header: "Patient",
      cell: (encounter) => (
        <Link
          href={`/patients/${encounter.patient_id}`}
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          Patient #{encounter.patient_id}
        </Link>
      ),
    },
    { id: "type", header: "Type", cell: (encounter) => humanizeEnum(encounter.encounter_type) },
    {
      id: "status",
      header: "Status",
      cell: (encounter) => <WorkflowStatusBadge status={encounter.status} />,
    },
    {
      id: "encounter_at",
      header: "Date",
      cell: (encounter) => formatDateTime(encounter.encounter_at),
    },
    {
      id: "complaint",
      header: "Chief complaint",
      cell: (encounter) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">{encounter.chief_complaint}</span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (encounter) => (
        <Button variant="ghost" size="xs" render={<Link href={`/encounters/${encounter.id}`} />}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Status
            <SelectNative
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as "" | "OPEN" | "CLOSED");
                setPage(1);
              }}
              className="w-36"
              aria-label="Filter by status"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </SelectNative>
          </label>
        </div>

        {canCreate ? (
          <Button render={<Link href="/encounters/new" />}>
            <Plus className="size-4" />
            New encounter
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Encounters"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(encounter) => encounter.id}
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
            icon={Stethoscope}
            title="No encounters found"
            description="Create an encounter from a patient profile or from the button above."
            action={
              canCreate ? (
                <Button render={<Link href="/encounters/new" />}>
                  <Plus className="size-4" />
                  New encounter
                </Button>
              ) : null
            }
          />
        }
      />

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Search className="size-3.5" aria-hidden="true" />
        Filter by status using the control above. Use the patient profile for a per-patient history.
      </p>
    </div>
  );
}