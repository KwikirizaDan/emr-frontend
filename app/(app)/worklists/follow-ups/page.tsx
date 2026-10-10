import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Follow-ups due",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Follow-ups due"
      description="Appointments that are due within a date range."
      phase="the follow-ups and worklists phase"
    />
  )
}
