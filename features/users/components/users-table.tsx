/** Staff account directory with edit, password reset and deactivation. */
"use client";

import * as React from "react";
import Link from "next/link";
import { KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/data-table/data-table";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { AccessDenied } from "@/components/shared/permission-gate";
import { ResetPasswordDialog } from "@/features/users/components/reset-password-dialog";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { userService } from "@/services/users/user-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { humanizeEnum } from "@/lib/formatters";
import { isApiError } from "@/services/http/api-error";
import type { User } from "@/services/http/api-types";

/** Lists staff accounts with role-gated management actions. */
export function UsersTable() {
  const { user: currentUser } = useCurrentUser();
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(20);
  const [resetFor, setResetFor] = React.useState<User | null>(null);
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const canView = can(currentUser, PERMISSIONS.userManage);
  const canManage = can(currentUser, PERMISSIONS.userManage);

  const { data, error, isLoading, mutate } = useSWR(
    canView ? `/users?page=${page}&per_page=${perPage}` : null,
    () => userService.list({ page, per_page: perPage }),
  );

  if (!canView) return <AccessDenied />;

  async function confirmDelete() {
    if (!pendingDelete) return;
    if (reason.trim().length < 5) {
      setReasonError("Enter a reason of at least 5 characters.");
      return;
    }
    setDeleting(true);
    setReasonError(null);
    try {
      await userService.remove(pendingDelete.id, reason.trim());
      toast.success("Account deactivated");
      setPendingDelete(null);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setDeleting(false);
    }
  }

  const columns: DataTableColumn<User>[] = [
    {
      id: "username",
      header: "Username",
      cell: (user) => <span className="font-mono text-xs">{user.username}</span>,
    },
    {
      id: "full_name",
      header: "Name",
      cell: (user) => <span className="font-medium">{user.full_name}</span>,
    },
    {
      id: "email",
      header: "Email",
      cell: (user) => <span className="text-muted-foreground">{user.email}</span>,
    },
    { id: "role", header: "Role", cell: (user) => humanizeEnum(user.role) },
    {
      id: "status",
      header: "Status",
      cell: (user) => (
        <Badge variant={user.is_active ? "secondary" : "outline"}>
          {user.is_active ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      headerClassName: "text-right",
      className: "text-right",
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          {canManage ? (
            <Button variant="ghost" size="xs" render={<Link href={`/users/${user.id}/edit`} />}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          ) : null}
          {canManage ? (
            <Button variant="ghost" size="xs" onClick={() => setResetFor(user)}>
              <KeyRound className="size-3.5" />
              Reset
            </Button>
          ) : null}
          {canManage ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-destructive"
              onClick={() => {
                setPendingDelete(user);
                setReason("");
                setReasonError(null);
              }}
            >
              <Trash2 className="size-3.5" />
              Deactivate
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        {canManage ? (
          <Button render={<Link href="/users/new" />}>
            <Plus className="size-4" />
            New account
          </Button>
        ) : null}
      </div>

      <DataTable
        caption="Staff accounts"
        columns={columns}
        rows={data?.data ?? []}
        getRowId={(user) => user.id}
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
            icon={Users}
            title="No accounts found"
            description="Create a staff account to get started."
          />
        }
      />

      <ResetPasswordDialog
        user={resetFor}
        open={resetFor !== null}
        onOpenChange={(open) => {
          if (!open) setResetFor(null);
        }}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title="Deactivate this account?"
        destructive
        pending={deleting}
        confirmLabel="Deactivate account"
        description={
          pendingDelete
            ? `${pendingDelete.full_name} (${pendingDelete.username}) will no longer be able to sign in.`
            : ""
        }
        reasonLabel="Reason for deactivation"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
