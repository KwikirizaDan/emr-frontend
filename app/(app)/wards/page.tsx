import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Wards & beds",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Wards & beds"
      description="Ward and bed occupancy for administration and clinical roles."
      phase="the inpatient and surgery workflow phase"
    />
  )
}
