import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Admissions",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Admissions"
      description="View admissions, admit eligible patients and discharge them."
      phase="the inpatient and surgery workflow phase"
    />
  )
}
