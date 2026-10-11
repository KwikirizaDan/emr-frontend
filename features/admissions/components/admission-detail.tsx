// Admission record: stay details, discharge summary and permission-gated actions.
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BedDouble, Slice } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { WorkflowStatusBadge } from "@/components/shared/status-badge";
import { DischargeForm } from "@/features/admissions/components/discharge-form";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { admissionService } from "@/services/admissions/admission-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatDateTime } from "@/lib/date";
import { humanizeEnum } from "@/lib/formatters";

/** Admission record with stay details and, when permitted, an inline discharge form. */
export function AdmissionDetail() {
  const params = useParams<{ admissionId: string }>();
  const admissionId = params.admissionId;
  const { user } = useCurrentUser();

  const { data: admission, error, isLoading, mutate } = useSWR(
    `/admissions/${admissionId}`,
    () => admissionService.getById(admissionId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!admission) {
    return (
      <EmptyState
        icon={BedDouble}
        title="Admission not found"
        description="This admission may have been removed or is no longer available."
      />
    );
  }

  const canDischarge = can(user, PERMISSIONS.admissionDischarge);
  const canScheduleSurgery = can(user, PERMISSIONS.surgeryManage);
  const isAdmitted = admission.status === "ADMITTED";

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">Admission #{admission.id}</h1>
            <WorkflowStatusBadge status={admission.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/patients/${admission.patient_id}`}
              className="underline-offset-4 hover:text-primary hover:underline"
            >
              Patient #{admission.patient_id}
            </Link>{" "}
            · {admission.ward?.name ?? "—"} · bed {admission.bed_number ?? "—"}
          </p>
        </div>
        {isAdmitted && canScheduleSurgery ? (
          <Button
            variant="outline"
            render={<Link href={`/surgeries/new?patient_id=${admission.patient_id}`} />}
          >
            <Slice className="size-4" />
            Schedule surgery
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Admission details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Detail label="Admitted" value={formatDateTime(admission.admitted_at)} />
          <Detail label="Encounter" value={`#${admission.encounter_id}`} />
          <Detail label="Admitting doctor" value={`#${admission.admitting_doctor_id}`} />
          <Detail
            label="Discharged"
            value={admission.discharged_at ? formatDateTime(admission.discharged_at) : "Still admitted"}
          />
          <div className="grid gap-0.5 sm:col-span-2">
            <span className="text-xs text-muted-foreground">Reason for admission</span>
            <span className="text-sm whitespace-pre-wrap">{admission.reason}</span>
          </div>
        </CardContent>
      </Card>

      {admission.discharge ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discharge</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail
                label="Condition at discharge"
                value={humanizeEnum(admission.discharge.condition_at_discharge)}
              />
              <Detail label="Discharged" value={formatDateTime(admission.discharge.discharged_at)} />
            </div>
            <Detail label="Summary" value={admission.discharge.summary} />
            <Detail label="Instructions" value={admission.discharge.instructions || "—"} />
          </CardContent>
        </Card>
      ) : isAdmitted && canDischarge ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Discharge patient</CardTitle>
          </CardHeader>
          <CardContent>
            <DischargeForm
              admissionId={admission.id}
              onDischarged={async () => {
                await mutate();
              }}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Small label/value pair used throughout the admission details card. */
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm whitespace-pre-wrap">{value}</span>
    </div>
  );
}
