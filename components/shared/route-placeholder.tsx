import * as React from "react";
import { Hammer } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export type RoutePlaceholderProps = {
  title: string;
  description: string;
  /** Which phase of the build sequence delivers this module. */
  phase: string;
};

/**
 * Placeholder for a documented module that a later phase of the build sequence
 * delivers. It keeps navigation honest: every entry in the sidebar resolves to
 * a real page instead of a dead link, and clearly states that the module is not
 * yet wired to the API.
 */
export function RoutePlaceholder({ title, description, phase }: RoutePlaceholderProps) {
  return (
    <div className="grid gap-6">
      <PageHeader title={title} description={description} />
      <EmptyState
        icon={Hammer}
        title={`${title} is not available yet`}
        description={`This module is delivered in ${phase} of the implementation sequence. The navigation is already role-aware, so the entry appears only for roles the backend permits to use it.`}
      />
    </div>
  );
}
