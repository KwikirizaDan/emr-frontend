/** Sidebar footer user menu showing the current identity and sign-out action. */
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { roleLabel } from "@/components/app-shell/app-sidebar";
import { initials } from "@/lib/formatters";
import type { CurrentUser } from "@/features/auth/hooks/use-current-user";

/** Renders the signed-in identity, or a skeleton while the session is loading. */
export function NavUser({ user }: { user: CurrentUser | null }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  /** Ends the session server-side, then returns the user to the sign-in screen. */
  async function signOut() {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      // The cookie is cleared server-side even when the call fails, so still
      // return the user to the sign-in screen.
      router.replace("/login");
    } finally {
      setIsSigningOut(false);
      toast.success("Signed out", { description: "You have been signed out safely." });
    }
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2 px-1 py-1.5">
        <span className="size-7 shrink-0 animate-pulse bg-muted" aria-hidden="true" />
        <span className="h-3 w-24 animate-pulse bg-muted" aria-hidden="true" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-1 py-1.5 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          />
        }
      >
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="text-xs">{initials(user.fullName || user.username)}</AvatarFallback>
        </Avatar>
        <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
          <span className="truncate text-xs font-medium">{user.fullName || user.username}</span>
          <span className="truncate text-xs text-muted-foreground">{roleLabel(user.role)}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid gap-0.5">
            <span className="text-xs font-medium text-foreground">
              {user.fullName || user.username}
            </span>
            <span className="text-xs text-muted-foreground">
              {user.email || user.username} · {roleLabel(user.role)}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserRound />
          Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={isSigningOut}
          onClick={() => void signOut()}
        >
          <LogOut />
          {isSigningOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
