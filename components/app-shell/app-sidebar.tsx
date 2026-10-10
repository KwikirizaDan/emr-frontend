/** Primary application sidebar built from the role-filtered navigation model. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Stethoscope } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { filterNavSections, type NavSection } from "@/components/app-shell/nav-items";
import { NavUser } from "@/components/app-shell/nav-user";
import type { CurrentUser } from "@/features/auth/hooks/use-current-user";
import { ROLE_LABELS } from "@/lib/permissions";

/** Renders the collapsible navigation sidebar for the current user. */
export function AppSidebar({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();

  const sections: NavSection[] = filterNavSections({
    role: user?.role ?? null,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-1 py-1.5 group-data-[collapsible=icon]:justify-center">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center bg-primary text-primary-foreground"
          >
            <Stethoscope className="size-4" />
          </span>
          <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-heading text-sm font-semibold">Meru EMR</span>
            <span className="text-xs text-muted-foreground">Clinical workspace</span>
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {sections.map((section, index) => (
          <SidebarGroup key={section.title ?? `section-${index}`}>
            {section.title ? (
              <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        render={<Link href={item.href} />}
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <item.icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

/** Resolves a friendly role label, falling back to the raw role or an em dash. */
export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as keyof typeof ROLE_LABELS] ?? role;
}
