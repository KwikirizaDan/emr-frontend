"use client";

import * as React from "react";
import Link from "next/link";
import { BedDouble, ExternalLink } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessDenied } from "@/components/shared/permission-gate";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { worklistService } from "@/services/worklists/worklist-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import type { InpatientWorklistItem } from "@/services/http/api-types";

export function InpatientsWorklist() {
  const { user } = useCurrentUser();
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const canView = can({ role: user?.role }, PERMISSIONS.admissionView);

  const { data, error, isLoading, mutate } = useSWR(
    canView ? `/worklists/inpatients?page=${page}&per_page=${perPage}` : null,
    () => worklistService.inpatients({ page, per_page: perPage }),
  );

  if (!canView) return <AccessDenied />;

  const columns: DataTableColumn<InpatientWorklistItem>[] = [
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
      id: "location",
      header: "Ward / bed",
      cell: (item) => (
        <span>
          {item.ward} · {item.bed}
        </span>
      ),
    },
    {
      id: "admitted_at",
      header: "Admitted",
      cell: (item) => <span className="whitespace-nowrap">{formatDateTime(item.admitted_at)}</span>,
    },
    {
      id: "days",
      header: "Days",
      cell: (item) => <span className="tabular-nums">{item.days_in_hospital}</span>,
    },
    {
      id: "diagnosis",
      header: "Primary diagnosis",
      cell: (item) => (
        <span className="text-muted-foreground">{item.primary_diagnosis ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (item) => (
        <Button
          variant="ghost"
          size="xs"
          render={<Link href={`/admissions/${item.admission_id}`} />}
        >
          <ExternalLink className="size-3.5" />
          Admission
        </Button>
      ),
    },
  ];

  return (
    <DataTable
      caption="Inpatients"
      columns={columns}
      rows={data?.data ?? []}
      getRowId={(item) => item.admission_id}
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
          title="No inpatients"
          description="There are currently no patients admitted in any ward."
        />
      }
    />
  );
}
