/**
 * Public "access denied" route shown when the signed-in user lacks the role
 * required for a page.
 */
import { Lock } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata = {
  title: "Access denied",
};

/**
 * Explains that the current role cannot view the requested area.
 */
export default function UnauthorizedPage() {
  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <PageHeader
        title="Access denied"
        description="You do not have permission to view this page."
      />
      <EmptyState
        icon={Lock}
        title="Not available for your role"
        description="Your role does not permit access to this area. If you believe this is an error, contact your system administrator."
      />
    </div>
  );
}
