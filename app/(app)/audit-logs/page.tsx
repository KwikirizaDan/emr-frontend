import { RoutePlaceholder } from "@/components/shared/route-placeholder"

export const metadata = {
  title: "Audit logs",
}

export default function Page() {
  return (
    <RoutePlaceholder
      title="Audit logs"
      description="Read-only traceability for administrators."
      phase="the administration and hardening phase"
    />
  )
}
