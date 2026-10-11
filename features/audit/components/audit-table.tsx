/** Filterable audit log viewer with a JSON detail dialog. */
"use client";

import * as React from "react";
import { Filter, ScrollText, Search, X } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { AccessDenied } from "@/components/shared/permission-gate";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { auditService, type AuditFilters } from "@/services/audit/audit-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { humanizeEnum } from "@/lib/formatters";
import type { AuditLog } from "@/services/http/api-types";

type DraftFilters = {
  action: string;
  entity_type: string;
  user_id: string;
  patient_id: string;
  date_from: string;
  date_to: string;
};

const EMPTY_DRAFT: DraftFilters = {
  action: "",
  entity_type: "",
  user_id: "",
  patient_id: "",
  date_from: "",
  date_to: "",
};

/** Audit log viewer with draft filters applied only on submit. */
export function AuditTable() {
  const { user } = useCurrentUser();
  // Draft holds the form inputs; applied is what the request actually uses.
  const [draft, setDraft] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [applied, setApplied] = React.useState<DraftFilters>(EMPTY_DRAFT);
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [selected, setSelected] = React.useState<AuditLog | null>(null);

  const canView = can(user, PERMISSIONS.auditView);

  const { data, error, isLoading, mutate } = useSWR(
    canView ? ["/audit-logs", applied, page, perPage] : null,
    () =>
      auditService.list({
        ...buildFilters(applied),
        page,
        per_page: perPage,
      }),
  );

  if (!canView) return <AccessDenied />;

  function apply(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setApplied(draft);
  }

  function reset() {
    setDraft(EMPTY_DRAFT);
    setApplied(EMPTY_DRAFT);
    setPage(1);
  }

  const hasFilters = Object.values(applied).some(Boolean);

  const columns: DataTableColumn<AuditLog>[] = [
    {
      id: "created_at",
      header: "When",
      cell: (log) => <span className="whitespace-nowrap">{formatDateTime(log.created_at)}</span>,
    },
    {
      id: "user",
      header: "Actor",
      cell: (log) => (
        <span>{log.username ?? (log.user_id ? `#${log.user_id}` : "system")}</span>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: (log) => <span className="font-medium">{humanizeEnum(log.action)}</span>,
    },
    {
      id: "entity",
      header: "Entity",
      cell: (log) => (
        <span className="text-muted-foreground">
          {humanizeEnum(log.entity_type)}
          {log.entity_id ? ` #${log.entity_id}` : ""}
        </span>
      ),
    },
    {
      id: "reason",
      header: "Reason",
      cell: (log) => (
        <span className="line-clamp-1 max-w-72 text-muted-foreground">{log.reason ?? "—"}</span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (log) => (
        <Button variant="ghost" size="xs" onClick={() => setSelected(log)}>
          Details
        </Button>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <form
        onSubmit={apply}
        className="grid gap-3 bg-card p-3 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FormField id="audit_action" label="Action">
          {(control) => (
            <Input
              {...control}
              value={draft.action}
              onChange={(event) => setDraft((prev) => ({ ...prev, action: event.target.value }))}
              placeholder="e.g. PATIENT_UPDATE"
            />
          )}
        </FormField>

        <FormField id="audit_entity_type" label="Entity type">
          {(control) => (
            <Input
              {...control}
              value={draft.entity_type}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, entity_type: event.target.value }))
              }
              placeholder="e.g. patient"
            />
          )}
        </FormField>

        <FormField id="audit_user_id" label="Actor (user ID)">
          {(control) => (
            <Input
              {...control}
              value={draft.user_id}
              inputMode="numeric"
              onChange={(event) => setDraft((prev) => ({ ...prev, user_id: event.target.value }))}
            />
          )}
        </FormField>

        <FormField id="audit_patient_id" label="Patient (ID)">
          {(control) => (
            <Input
              {...control}
              value={draft.patient_id}
              inputMode="numeric"
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, patient_id: event.target.value }))
              }
            />
          )}
        </FormField>

        <FormField id="audit_date_from" label="From">
          {(control) => (
            <Input
              {...control}
              type="date"
              value={draft.date_from}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, date_from: event.target.value }))
              }
            />
          )}
        </FormField>

        <FormField id="audit_date_to" label="To">
          {(control) => (
            <Input
              {...control}
              type="date"
              value={draft.date_to}
              onChange={(event) => setDraft((prev) => ({ ...prev, date_to: event.target.value }))}
            />
          )}
        </FormField>

        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit">
            <Search className="size-4" />
            Apply filters
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={!hasFilters}>
            <X className="size-4" />
            Clear
          </Button>
        </div>
      </form>

      <DataTable
        caption="Audit logs"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(log) => log.id}
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
            icon={Filter}
            title={hasFilters ? "No matching entries" : "No audit entries found"}
            description={
              hasFilters
                ? "Try broadening the filters above."
                : "Actions performed in the system will appear here."
            }
          />
        }
      />

      <AuditDetailsDialog log={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

/** Converts draft filter strings into the service's typed filter object. */
function buildFilters(draft: DraftFilters): AuditFilters {
  return {
    action: draft.action.trim() || undefined,
    entity_type: draft.entity_type.trim() || undefined,
    user_id: draft.user_id.trim() ? Number(draft.user_id) : undefined,
    patient_id: draft.patient_id.trim() ? Number(draft.patient_id) : undefined,
    date_from: draft.date_from || undefined,
    date_to: draft.date_to || undefined,
  };
}

/** Read-only dialog showing one audit entry's metadata and JSON snapshots. */
function AuditDetailsDialog({ log, onClose }: { log: AuditLog | null; onClose: () => void }) {
  return (
    <Dialog
      open={log !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-4" />
            Audit entry #{log?.id}
          </DialogTitle>
          <DialogDescription>
            {log ? `${humanizeEnum(log.action)} · ${formatDateTime(log.created_at)}` : ""}
          </DialogDescription>
        </DialogHeader>

        {log ? (
          <div className="grid gap-4">
            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <Detail label="Actor" value={log.username ?? (log.user_id ? `#${log.user_id}` : "system")} />
              <Detail label="Entity" value={`${humanizeEnum(log.entity_type)}${log.entity_id ? ` #${log.entity_id}` : ""}`} />
              <Detail label="Patient" value={log.patient_id ? `#${log.patient_id}` : "—"} />
              <Detail label="IP address" value={log.ip_address ?? "—"} />
              <Detail label="Request ID" value={log.request_id ?? "—"} className="col-span-2" />
            </dl>

            {log.reason ? (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Reason</span>
                <p className="text-sm whitespace-pre-wrap">{log.reason}</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <JsonBlock title="Before" value={log.old_values} />
              <JsonBlock title="After" value={log.new_values} />
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Renders a before/after JSON snapshot, or an em dash when absent. */
function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{title}</span>
      <pre className="max-h-64 overflow-auto bg-muted p-3 text-xs">
        {value ? JSON.stringify(value, null, 2) : "—"}
      </pre>
    </div>
  );
}

/** Read-only label/value pair used in the audit detail dialog. */
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
