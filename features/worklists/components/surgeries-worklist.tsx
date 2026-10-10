/** Day-based theatre worklist of scheduled surgeries. */
"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, Syringe } from "lucide-react";
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
import { formatTime, todayKey } from "@/lib/date";
import type { SurgeryWorklistItem } from "@/services/http/api-types";

/** Theatre worklist for a selected day. */
export function SurgeriesWorklist() {
  const { user } = useCurrentUser();
  const [day, setDay] = React.useState(todayKey());
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);

  const canView = can({ role: user?.role }, PERMISSIONS.surgeryView);

  const { data, error, isLoading, mutate } = useSWR(
    canView ? `/worklists/surgeries?day=${day}&page=${page}&per_page=${perPage}` : null,
    () => worklistService.surgeries(day, { page, per_page: perPage }),
  );

  if (!canView) return <AccessDenied />;

  const columns: DataTableColumn<SurgeryWorklistItem>[] = [
    {
      id: "time",
      header: "Time",
      cell: (item) => (
        <span className="tabular-nums whitespace-nowrap">
          {formatTime(item.scheduled_start)}–{formatTime(item.scheduled_end)}
        </span>
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
    { id: "procedure", header: "Procedure", cell: (item) => item.procedure },
    { id: "theatre", header: "Theatre", cell: (item) => item.theatre },
    { id: "surgeon", header: "Surgeon", cell: (item) => item.surgeon },
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
        <Button variant="ghost" size="xs" render={<Link href={`/surgeries/${item.surgery_id}`} />}>
          <ExternalLink className="size-3.5" />
          Surgery
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="w-full sm:w-56">
        <FormField id="worklist_day" label="Day">
          {(control) => (
            <Input
              {...control}
              type="date"
              value={day}
              onChange={(event) => {
                setDay(event.target.value);
                setPage(1);
              }}
            />
          )}
        </FormField>
      </div>

      <DataTable
        caption="Today's surgeries"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(item) => item.surgery_id}
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
            icon={Syringe}
            title="No surgeries scheduled"
            description="No theatre bookings were found for the selected day."
          />
        }
      />
    </div>
  );
}
