import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Surgeries",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Surgeries"
      description="Schedule and track the surgery workflow."
      phase="the inpatient and surgery workflow phase"
    />
  )
}
