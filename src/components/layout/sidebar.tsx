"use client";

import { useAppStore } from "@/store/app-store";
import { moduleConfig, moduleGroups } from "@/lib/modules";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, X, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface SidebarProps {
  isMobile?: boolean;
}

export function Sidebar({ isMobile = false }: SidebarProps) {
  const { activeModule, setActiveModule, sidebarCollapsed, mobileSidebarOpen, setMobileSidebar, currentUser } = useAppStore();

  if (isMobile && !mobileSidebarOpen) return null;

  return (
    <>
      {isMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileSidebar(false)}
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-sidebar border-r border-sidebar-border z-50",
          isMobile
            ? "fixed inset-y-0 left-0 w-72 transition-transform duration-300"
            : sidebarCollapsed
            ? "w-[72px]"
            : "w-64 transition-all duration-300"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between gap-2 border-b border-sidebar-border px-4">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-foreground shadow-md shadow-primary/30">
              <Heart className="h-5 w-5" fill="currentColor" />
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="font-bold tracking-tight leading-none">MediCore</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Hospital CRM</p>
              </div>
            )}
          </div>
          {isMobile && (
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMobileSidebar(false)}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-6">
            {moduleGroups.map((group) => {
              const modules = moduleConfig.filter((m) => m.group === group);
              if (modules.length === 0) return null;
              return (
                <div key={group}>
                  {!sidebarCollapsed && (
                    <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {modules.map((mod) => {
                      const Icon = mod.icon;
                      const isActive = activeModule === mod.key;
                      return (
                        <button
                          key={mod.key}
                          onClick={() => setActiveModule(mod.key)}
                          title={sidebarCollapsed ? mod.label : undefined}
                          className={cn(
                            "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                            sidebarCollapsed && "justify-center",
                            isActive
                              ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                          )}
                        >
                          <Icon className={cn("h-4.5 w-4.5 shrink-0", !sidebarCollapsed && "h-[18px] w-[18px]")} />
                          {!sidebarCollapsed && <span className="flex-1 text-left truncate">{mod.label}</span>}
                          {!sidebarCollapsed && mod.badge && (
                            <Badge
                              variant={isActive ? "secondary" : "outline"}
                              className={cn(
                                "h-5 min-w-5 justify-center px-1 text-[10px]",
                                isActive && "bg-sidebar-primary-foreground/20 text-sidebar-primary-foreground border-0"
                              )}
                            >
                              {mod.badge}
                            </Badge>
                          )}
                          {sidebarCollapsed && mod.badge && (
                            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User card at bottom */}
        {!sidebarCollapsed && (
          <div className="border-t border-sidebar-border p-3">
            <div className="rounded-xl bg-gradient-to-br from-primary/10 to-info/10 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  {currentUser.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{currentUser.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{currentUser.role}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
