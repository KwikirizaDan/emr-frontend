import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center bg-background p-4">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you were looking for does not exist or has been moved."
        action={
          <Button render={<Link href="/dashboard" />}>Go to dashboard</Button>
        }
      />
    </main>
  );
}
