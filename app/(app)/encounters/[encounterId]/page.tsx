/**
 * Encounter detail route: full record for a single encounter.
 */
import { EncounterDetail } from "@/features/encounters/components/encounter-detail";

export const metadata = {
  title: "Encounter",
};

/**
 * Renders the encounter detail view; the id comes from the route segment.
 */
export default function EncounterDetailPage() {
  return <EncounterDetail />;
}
