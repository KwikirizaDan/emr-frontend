// Patient profile page: header actions plus overview and timeline tabs.
"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BedDouble, CalendarPlus, Pencil, Stethoscope, UserRound } from "lucide-react";
import useSWR from "swr";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { LoadingState } from "@/components/shared/loading-state";
import { PatientSummary } from "@/features/patients/components/patient-summary";
import { PatientTimeline } from "@/features/patients/components/patient-timeline";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { patientService } from "@/services/patients/patient-service";
import { can, PERMISSIONS } from "@/lib/permissions";
import { formatMrn, formatPersonDisplayName, formatSex } from "@/lib/formatters";
import { formatAge, formatDate } from "@/lib/date";

/** Patient profile with permission-gated quick actions and clinical tabs. */
export function PatientDetail() {
  const params = useParams<{ patientId: string }>();
  const patientId = params.patientId;
  const { user } = useCurrentUser();

  const { data: patient, error, isLoading, mutate } = useSWR(
    `/patients/${patientId}`,
    () => patientService.getById(patientId),
  );

  if (isLoading) return <LoadingState rows={5} />;
  if (error) return <ErrorState error={error} onRetry={() => void mutate()} />;
  if (!patient) {
    return (
      <EmptyState
        icon={UserRound}
        title="Patient not found"
        description="This record may have been deleted or is no longer available."
      />
    );
  }

  const canUpdate = can(user, PERMISSIONS.patientUpdate);
  const canCreateEncounter = can(user, PERMISSIONS.encounterCreate);
  const canCreateFollowUp = can(user, PERMISSIONS.followupCreate);
  const canAdmit = can(user, PERMISSIONS.admissionCreate);
  const canViewTimeline = can(user, PERMISSIONS.timelineView);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatPersonDisplayName(patient)}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatMrn(patient.mrn)} · {formatSex(patient.sex)} · {formatAge(patient.date_of_birth)} ·{" "}
            {formatDate(patient.date_of_birth)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canCreateEncounter ? (
            <Button
              variant="outline"
              render={<Link href={`/patients/${patient.id}/encounters/new`} />}
            >
              <Stethoscope className="size-4" />
              New encounter
            </Button>
          ) : null}
          {canCreateFollowUp ? (
            <Button
              variant="outline"
              render={<Link href={`/follow-ups/new?patient_id=${patient.id}`} />}
            >
              <CalendarPlus className="size-4" />
              Book follow-up
            </Button>
          ) : null}
          {canAdmit ? (
            <Button
              variant="outline"
              render={<Link href={`/admissions/new?patient_id=${patient.id}`} />}
            >
              <BedDouble className="size-4" />
              Admit
            </Button>
          ) : null}
          {canUpdate ? (
            <Button render={<Link href={`/patients/${patient.id}/edit`} />}>
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canViewTimeline ? <TabsTrigger value="timeline">Timeline</TabsTrigger> : null}
        </TabsList>
        <TabsContent value="overview" className="pt-4">
          <PatientSummary patient={patient} />
        </TabsContent>
        {canViewTimeline ? (
          <TabsContent value="timeline" className="pt-4">
            <PatientTimeline patientId={patient.id} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}