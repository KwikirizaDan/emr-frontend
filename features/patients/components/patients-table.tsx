// Patient register: server-backed table with search, pagination and soft delete.
"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatMrn, formatPhone } from "@/lib/formatters";
import { formatAge } from "@/lib/date";
import { patientService } from "@/services/patients/patient-service";
import type { Patient } from "@/services/http/api-types";
import { isApiError } from "@/services/http/api-error";

/** Patient register table with debounced search, pagination and permission-gated actions. */
export function PatientsTable() {
  const { user } = useCurrentUser();
  const [term, setTerm] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [pendingDelete, setPendingDelete] = React.useState<Patient | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  // Debounce typing so the register is queried only after the user pauses.
  React.useEffect(() => {
    const handle = setTimeout(() => {
      setQuery(term.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(handle);
  }, [term]);

  const { rows, meta, isLoading, error, mutate } = usePatients({
    q: query || undefined,
    page,
    per_page: perPage,
  });

  const canCreate = can({ role: user?.role }, PERMISSIONS.patientCreate);
  const canUpdate = can({ role: user?.role }, PERMISSIONS.patientUpdate);
  const canDelete = can({ role: user?.role }, PERMISSIONS.patientDelete);

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (reason.trim().length < 5) {
      setReasonError("Enter a reason of at least 5 characters.");
      return;
    }
    setDeleting(true);
    setReasonError(null);
    try {
      await patientService.remove(pendingDelete.id, reason.trim());
      toast.success("Patient record deleted", {
        description: "The record is kept for audit.",
      });
      setPendingDelete(null);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<Patient>[] = [
    {
      id: "mrn",
      header: "MRN",
      cell: (patient) => <span className="font-mono text-xs">{formatMrn(patient.mrn)}</span>,
    },
    {
      id: "name",
      header: "Patient",
      cell: (patient) => (
        <Link
          href={`/patients/${patient.id}`}
          className="font-medium text-foreground underline-offset-4 hover:text-primary hover:underline"
        >
          {patient.last_name}, {patient.first_name}
        </Link>
      ),
    },
    { id: "sex", header: "Sex", cell: (patient) => patient.sex },
    { id: "age", header: "Age", cell: (patient) => formatAge(patient.date_of_birth) },
    { id: "phone", header: "Phone", cell: (patient) => formatPhone(patient.phone) },
    {
      id: "national_id",
      header: "National ID",
      cell: (patient) => patient.national_id ?? "—",
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (patient) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="xs" render={<Link href={`/patients/${patient.id}`} />}>
            <UserRound className="size-3.5" />
            View
          </Button>
          {canUpdate ? (
            <Button
              variant="ghost"
              size="xs"
              render={<Link href={`/patients/${patient.id}/edit`} />}
            >
              Edit
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              onClick={() => {
                setPendingDelete(patient);
                setReason("");
                setReasonError(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name, MRN, national ID or phone"
            className="pl-7"
            aria-label="Search patients"
          />
        </div>

        {canCreate ? (
          <Button render={<Link href="/patients/new" />}>
            <Plus className="size-4" />
            Register patient
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Patient register"
        columns={columns}
        rows={rows}
        getRowId={(patient) => patient.id}
        loading={isLoading}
        error={error}
        onRetry={() => void mutate()}
        meta={meta}
        onPageChange={setPage}
        onPerPageChange={(size) => {
          setPerPage(size);
          setPage(1);
        }}
        empty={
          <EmptyState
            icon={UserRound}
            title={query ? "No patients match your search" : "No patients yet"}
            description={
              query
                ? "Try a different name, MRN, national ID or phone number."
                : "Register the first patient to get started."
            }
            action={
              canCreate ? (
                <Button render={<Link href="/patients/new" />}>
                  <Plus className="size-4" />
                  Register patient
                </Button>
              ) : null
            }
          />
        }
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Delete this patient record?"
        destructive
        pending={deleting}
        confirmLabel="Delete record"
        description={
          pendingDelete
            ? `${pendingDelete.first_name} ${pendingDelete.last_name} (${pendingDelete.mrn}) will be removed from the register but kept for audit.`
            : ""
        }
        reasonLabel="Reason for deletion"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={confirmDelete}
      />
    </div>
  );
}