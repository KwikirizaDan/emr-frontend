// Read-only summary card for a patient's demographic details.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAge, formatDate } from "@/lib/date";
import { formatMrn, formatPhone, formatSex } from "@/lib/formatters";
import type { Patient } from "@/services/http/api-types";

/** Read-only identity block for the patient profile. */
export function PatientSummary({ patient }: { patient: Patient }) {
  const fields: { label: string; value: string }[] = [
    { label: "MRN", value: formatMrn(patient.mrn) },
    { label: "Sex", value: formatSex(patient.sex) },
    {
      label: "Date of birth",
      value: `${formatDate(patient.date_of_birth)} · ${formatAge(patient.date_of_birth)}`,
    },
    { label: "Phone", value: formatPhone(patient.phone) },
    { label: "National ID", value: patient.national_id ?? "—" },
    { label: "Address", value: patient.address ?? "—" },
    { label: "Next of kin", value: patient.next_of_kin_name ?? "—" },
    { label: "Next of kin phone", value: formatPhone(patient.next_of_kin_phone) },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Patient details</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => (
          <div key={field.label} className="grid gap-0.5">
            <span className="text-xs text-muted-foreground">{field.label}</span>
            <span className="text-xs font-medium">{field.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}