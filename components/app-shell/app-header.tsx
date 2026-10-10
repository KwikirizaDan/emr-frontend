"use client";

import { Bell, HelpCircle, PanelLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AppHeader() {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        className="-ml-1 text-muted-foreground"
        aria-label="Toggle navigation"
      >
        <PanelLeft className="size-4" />
      </Button>

      <Separator orientation="vertical" className="mr-1 h-4" />

      <div className="ml-auto flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Notifications"
              />
            }
          >
            <Bell className="size-4" />
          </TooltipTrigger>
          <TooltipContent>No new notifications</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground"
                aria-label="Help"
              />
            }
          >
            <HelpCircle className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Contact your system administrator</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}
