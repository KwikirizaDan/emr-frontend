/** Follow-up record view with complete, mark-missed and cancel actions. */
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import useSWR from "swr";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { followUpService } from "@/services/followups/followup-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { isApiError } from "@/services/http/api-error";

type ClosableStatus = "CANCELLED" | "MISSED";

/** Loads the follow-up by route id and exposes its status actions. */
export function FollowupDetail() {
  const params = useParams<{ followUpId: string }>();
  const followUpId = params.followUpId;
  const { user } = useCurrentUser();
  const [completing, setCompleting] = React.useState(false);
  const [closingStatus, setClosingStatus] = React.useState<ClosableStatus | null>(null);
  const [reason, setReason] = React.useState("");
  const [reasonError, setReasonError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const { data: followUp, error, isLoading, mutate } = useSWR(
    `/followups/${followUpId}`,
    () => followUpService.getById(followUpId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!followUp) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="Follow-up not found"
        description="This follow-up may have been removed or is no longer available."
      />
    );
  }

  const canManage = can(user, PERMISSIONS.followupManage);
  const isOpen = followUp.status === "SCHEDULED";

  async function complete() {
    setCompleting(true);
    try {
      await followUpService.changeStatus(followUpId, { status: "COMPLETED" });
      toast.success("Follow-up marked as completed");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setCompleting(false);
    }
  }

  async function confirmClose() {
    if (!closingStatus) return;
    if (reason.trim().length < 5) {
      setReasonError("Enter a reason of at least 5 characters.");
      return;
    }
    setPending(true);
    setReasonError(null);
    try {
      await followUpService.changeStatus(followUpId, { status: closingStatus, reason: reason.trim() });
      toast.success(closingStatus === "MISSED" ? "Follow-up marked as missed" : "Follow-up cancelled");
      setClosingStatus(null);
      setReason("");
      await mutate();
    } catch (error) {
      toast.error(isApiError(error) ? error.displayMessage : "The request could not be completed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Follow-up #{followUp.id}</h1>
          <WorkflowStatusBadge status={followUp.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          Scheduled for {formatDateTime(followUp.scheduled_at)} ·{" "}
          <Link
            href={`/patients/${followUp.patient_id}`}
            className="underline-offset-4 hover:text-primary hover:underline"
          >
            Patient #{followUp.patient_id}
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Follow-up details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Scheduled for" value={formatDateTime(followUp.scheduled_at)} />
          <Detail label="Clinician" value={followUp.clinician_id ? `#${followUp.clinician_id}` : "—"} />
          <Detail label="Admission" value={followUp.admission_id ? `#${followUp.admission_id}` : "—"} />
          <Detail label="Booked" value={formatDateTime(followUp.created_at)} />
          <Detail label="Reason" value={followUp.reason} className="sm:col-span-2" />
          {followUp.status_reason ? (
            <Detail label="Status reason" value={followUp.status_reason} className="sm:col-span-2" />
          ) : null}
        </CardContent>
      </Card>

      {isOpen && canManage ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button onClick={complete} disabled={completing}>
              {completing ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
              Mark completed
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setReason("");
                setReasonError(null);
                setClosingStatus("MISSED");
              }}
            >
              Mark missed
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setReason("");
                setReasonError(null);
                setClosingStatus("CANCELLED");
              }}
            >
              <XCircle className="size-4" />
              Cancel follow-up
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <ConfirmDialog
        open={closingStatus !== null}
        onOpenChange={(open) => {
          if (!open) setClosingStatus(null);
        }}
        title={closingStatus === "MISSED" ? "Mark this follow-up as missed?" : "Cancel this follow-up?"}
        destructive={closingStatus === "CANCELLED"}
        pending={pending}
        confirmLabel={closingStatus === "MISSED" ? "Mark missed" : "Cancel follow-up"}
        description={
          closingStatus === "MISSED"
            ? `Follow-up #${followUp.id} will be recorded as missed.`
            : `Follow-up #${followUp.id} will be cancelled. The record is retained for audit.`
        }
        reasonLabel="Reason"
        reasonDescription="This reason is stored in the audit log and cannot be changed later."
        reasonValue={reason}
        onReasonChange={setReason}
        reasonError={reasonError}
        onConfirm={confirmClose}
      />
    </div>
  );
}

/** Read-only label/value pair used in the detail card. */
function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className ? `grid gap-0.5 ${className}` : "grid gap-0.5"}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm whitespace-pre-wrap">{value}</span>
    </div>
  );
}
