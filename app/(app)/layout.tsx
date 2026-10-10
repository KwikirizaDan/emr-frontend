/**
 * Shell layout for every authenticated route. Navigation, session and
 * permission handling live in the shared AppShell component.
 */
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell/app-shell";

/**
 * Wraps authenticated pages in the application chrome (navigation and header).
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
