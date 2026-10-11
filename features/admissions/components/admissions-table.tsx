// Admission register: server-backed table with status filtering and pagination.
"use client";

import * as React from "react";
import Link from "next/link";
import { BedDouble, Plus } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { SelectNative } from "@/components/shared/select-native";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { admissionService } from "@/services/admissions/admission-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import type { AdmissionDetail } from "@/services/http/api-types";

/** Admission register table with a status filter, pagination and an admit action. */
export function AdmissionsTable() {
  const { user } = useCurrentUser();
  const [status, setStatus] = React.useState<"" | "ADMITTED" | "DISCHARGED">("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const { data, error, isLoading, mutate } = useSWR(
    `/admissions?status=${status}&page=${page}&per_page=${perPage}`,
    () => admissionService.list({ status: status || undefined, page, per_page: perPage }),
  );

  const canCreate = can(user, PERMISSIONS.admissionCreate);

  const columns: DataTableColumn<AdmissionDetail>[] = [
    {
      id: "id",
      header: "Admission",
      cell: (admission) => <span className="font-mono text-xs">#{admission.id}</span>,
    },
    {
      id: "patient",
      header: "Patient",
      cell: (admission) => (
        <Link
          href={`/patients/${admission.patient_id}`}
          className="font-medium underline-offset-4 hover:text-primary hover:underline"
        >
          Patient #{admission.patient_id}
        </Link>
      ),
    },
    {
      id: "location",
      header: "Ward / bed",
      cell: (admission) => (
        <span className="text-muted-foreground">
          {admission.ward?.name ?? "—"} · {admission.bed_number ?? "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (admission) => <WorkflowStatusBadge status={admission.status} />,
    },
    {
      id: "admitted_at",
      header: "Admitted",
      cell: (admission) => formatDateTime(admission.admitted_at),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (admission) => (
        <Button variant="ghost" size="xs" render={<Link href={`/admissions/${admission.id}`} />}>
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
              setStatus(event.target.value as "" | "ADMITTED" | "DISCHARGED");
              setPage(1);
            }}
            className="w-36"
            aria-label="Filter by status"
          >
            <option value="">All</option>
            <option value="ADMITTED">Admitted</option>
            <option value="DISCHARGED">Discharged</option>
          </SelectNative>
        </label>

        {canCreate ? (
          <Button render={<Link href="/admissions/new" />}>
            <Plus className="size-4" />
            Admit patient
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Admissions"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(admission) => admission.id}
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
            icon={BedDouble}
            title="No admissions found"
            description="Admit a patient to create an inpatient record."
            action={
              canCreate ? (
                <Button render={<Link href="/admissions/new" />}>
                  <Plus className="size-4" />
                  Admit patient
                </Button>
              ) : null
            }
          />
        }
      />
    </div>
  );
}
