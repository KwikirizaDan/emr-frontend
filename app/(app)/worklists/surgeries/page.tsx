import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Today's surgeries",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Today's surgeries"
      description="Theatre schedule for a selected day."
      phase="the follow-ups and worklists phase"
    />
  )
}
