import { PatientTimeline } from "@/features/patients/components/patient-timeline";

export const metadata = {
  title: "Patient timeline",
};

export default async function PatientTimelinePage({
  params,
}: {
  params: Promise<{ patientId: string }>;
}) {
  const { patientId } = await params;
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Patient timeline</h1>
      <PatientTimeline patientId={patientId} />
    </div>
  );
}