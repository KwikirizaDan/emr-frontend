/** Admin-only list of soft-deleted records that can be restored. */
"use client";

import * as React from "react";
import { FileJson, RotateCcw, Trash2 } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { AccessDenied } from "@/components/shared/permission-gate";
import { SelectNative } from "@/components/shared/select-native";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { recycleBinService } from "@/services/recycle-bin/recycle-bin-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { humanizeEnum } from "@/lib/formatters";
import { isApiError } from "@/services/http/api-error";
import type {
  RecycleBinEntityType,
  RecycleBinItem,
} from "@/services/http/api-types";

const TYPE_FILTERS: { value: "" | RecycleBinEntityType; label: string }[] = [
  { value: "", label: "All types" },
  { value: "patient", label: "Patients" },
  { value: "encounter", label: "Encounters" },
  { value: "diagnosis", label: "Diagnoses" },
  { value: "user", label: "Users" },
];

/**
 * Admin-only view of every soft deleted record — patients, encounters,
 * diagnoses and users — newest deletion first.
 *
 * A row can be inspected as raw JSON or restored. Restoring writes a RESTORE
 * entry to the API audit log. Visibility is gated by `recyclebin:read` and the
 * restore control by `recyclebin:restore`; Flask still authorises every call.
 */
export function RecycleBinTable() {
  const { user } = useCurrentUser();
  const [entityType, setEntityType] = React.useState<"" | RecycleBinEntityType>("");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [pendingRestore, setPendingRestore] = React.useState<RecycleBinItem | null>(null);
  const [reason, setReason] = React.useState("");
  const [restoring, setRestoring] = React.useState(false);
  const [selected, setSelected] = React.useState<RecycleBinItem | null>(null);

  const canView = can({ role: user?.role }, PERMISSIONS.recycleBinView);
  const canRestore = can({ role: user?.role }, PERMISSIONS.recycleBinRestore);

  // The SWR key doubles as the cache identity: a filter or page change is a new
  // key. Passing null when unpermitted skips the request entirely.
  const { data, error, isLoading, mutate } = useSWR(
    canView ? `/recycle-bin?type=${entityType}&page=${page}&per_page=${perPage}` : null,
    () =>
      recycleBinService.list({
        entity_type: entityType || undefined,
        page,
        per_page: perPage,
      }),
  );

  if (!canView) return <AccessDenied />;

  async function confirmRestore() {
    if (!pendingRestore) return;
    setRestoring(true);
    try {
      await recycleBinService.restore(
        pendingRestore.entity_type,
        pendingRestore.id,
        reason,
      );
      toast.success(`${humanizeEnum(pendingRestore.entity_type)} restored`);
      setPendingRestore(null);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setRestoring(false);
    }
  }

  const columns: DataTableColumn<RecycleBinItem>[] = [
    {
      id: "entity_type",
      header: "Type",
      cell: (item) => <span className="font-medium">{humanizeEnum(item.entity_type)}</span>,
    },
    {
      id: "label",
      header: "Record",
      cell: (item) => <span className="text-muted-foreground">{item.label}</span>,
    },
    {
      id: "deleted_at",
      header: "Deleted",
      cell: (item) => <span className="whitespace-nowrap">{formatDateTime(item.deleted_at)}</span>,
    },
    {
      id: "deleted_by",
      header: "By",
      cell: (item) => <span>{item.deleted_by_id ? `#${item.deleted_by_id}` : "—"}</span>,
    },
    {
      id: "reason",
      header: "Reason",
      cell: (item) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">
          {item.delete_reason ?? "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (item) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="xs" onClick={() => setSelected(item)}>
            <FileJson className="size-3.5" />
            Details
          </Button>
          {canRestore ? (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setPendingRestore(item);
                setReason("");
              }}
            >
              <RotateCcw className="size-3.5" />
              Restore
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        Type
        <SelectNative
          value={entityType}
          onChange={(event) => {
            setEntityType(event.target.value as "" | RecycleBinEntityType);
            setPage(1);
          }}
          className="w-44"
          aria-label="Filter by record type"
        >
          {TYPE_FILTERS.map((option) => (
            <option key={option.value || "all"} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectNative>
      </label>

      <DataTable
        caption="Recycle bin"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(item) => `${item.entity_type}-${item.id}`}
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
            icon={Trash2}
            title="The recycle bin is empty"
            description="Soft-deleted patients, encounters, diagnoses and users appear here and can be restored."
          />
        }
      />

      <ConfirmDialog
        open={pendingRestore !== null}
        onOpenChange={(open) => {
          if (!open) setPendingRestore(null);
        }}
        title="Restore this record?"
        confirmLabel="Restore record"
        pending={restoring}
        description={
          pendingRestore
            ? `${humanizeEnum(pendingRestore.entity_type)} “${pendingRestore.label}” will be visible again.`
            : ""
        }
        onConfirm={confirmRestore}
      >
        <FormField
          id="restore-reason"
          label="Reason (optional)"
          description="Recorded in the audit log for traceability."
        >
          {(control) => (
            <Textarea
              {...control}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="Why is this record being restored?"
              disabled={restoring}
            />
          )}
        </FormField>
      </ConfirmDialog>

      <RecycleBinDetailsDialog item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Read-only dialog showing a deleted row's metadata and its stored JSON record. */
function RecycleBinDetailsDialog({
  item,
  onClose,
}: {
  item: RecycleBinItem | null;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {item ? `${humanizeEnum(item.entity_type)} #${item.id}` : "Record"}
          </DialogTitle>
          <DialogDescription>{item?.label ?? ""}</DialogDescription>
        </DialogHeader>

        {item ? (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Deleted" value={formatDateTime(item.deleted_at)} />
              <Detail
                label="Deleted by"
                value={item.deleted_by_id ? `#${item.deleted_by_id}` : "—"}
              />
              <Detail label="Reason" value={item.delete_reason ?? "—"} className="col-span-2" />
            </dl>
            <div className="grid gap-1">
              <span className="text-xs text-muted-foreground">Stored record</span>
              <pre className="max-h-72 overflow-auto bg-muted p-3 text-xs">
                {JSON.stringify(item.record, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className ? `grid gap-0.5 ${className}` : "grid gap-0.5"}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{value}</dd>
    </div>
  );
}
