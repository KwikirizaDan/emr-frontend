/**
 * Wards route: configure wards and beds and view live occupancy.
 */
import { PageHeader } from "@/components/shared/page-header";
import { WardManager } from "@/features/wards/components/ward-manager";

export const metadata = {
  title: "Wards",
};

/**
 * Renders the ward and bed manager.
 */
export default function WardsPage() {
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Wards & beds"
        description="Configure wards and beds, and see live occupancy."
      />
      <WardManager />
    </div>
  );
}
