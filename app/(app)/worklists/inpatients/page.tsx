import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Inpatients",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Inpatients"
      description="Patients currently admitted, with ward, bed and admission time."
      phase="the follow-ups and worklists phase"
    />
  )
}
