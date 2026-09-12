"use client";

import { useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { getEffectiveModulesForRole, moduleGroups } from "@/lib/modules";
import type { ModuleKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ChevronLeft, House, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Mobile-only bottom navigation: Back | Home | + All modules sheet.
// Replaces the sidebar hamburger on small screens.
export function MobileBottomNav() {
  const activeModule = useAppStore((s) => s.activeModule);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [query, setQuery] = useState("");

  const { appointments, invoices, labTests } = useBranchData();
  const modules = getEffectiveModulesForRole(currentUser.role, settings);
  const todayStr = new Date().toISOString().split("T")[0];
  const liveBadge = (key: string): string | undefined => {
    if (key === "appointments") {
      const n = appointments.filter((a) => a.date === todayStr && a.status !== "Cancelled").length;
      return n > 0 ? String(n) : undefined;
    }
    if (key === "billing") {
      const n = invoices.filter((i) => i.status === "Pending" || i.status === "Partial").length;
      return n > 0 ? String(n) : undefined;
    }
    if (key === "laboratory") {
      const n = labTests.filter((t) => t.status !== "Approved" && t.status !== "Rejected").length;
      return n > 0 ? String(n) : undefined;
    }
    return undefined;
  };
  const filtered = modules.filter((m) =>
    m.label.toLowerCase().includes(query.trim().toLowerCase())
  );
  const groups = moduleGroups
    .map((g) => ({ key: g, label: g, items: filtered.filter((m) => m.group === g) }))
    .filter((g) => g.items.length > 0);

  const goBack = () => {
    if (activeModule !== "dashboard") {
      setActiveModule("dashboard");
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
    }
  };

  const go = (key: ModuleKey) => {
    setActiveModule(key);
    setSheetOpen(false);
    setQuery("");
  };

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="grid grid-cols-3">
          <button
            type="button"
            onClick={goBack}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground active:text-foreground active:bg-muted/50"
          >
            <ChevronLeft className="h-[22px] w-[22px]" strokeWidth={2.25} />
            <span className="text-[10px] font-semibold leading-none">Back</span>
          </button>
          <button
            type="button"
            onClick={() => go("dashboard")}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 active:bg-muted/50",
              activeModule === "dashboard" ? "text-primary" : "text-muted-foreground active:text-foreground"
            )}
          >
            <House className="h-[22px] w-[22px]" strokeWidth={2.25} />
            <span className="text-[10px] font-semibold leading-none">Home</span>
          </button>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-muted-foreground active:text-foreground active:bg-muted/50"
          >
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md shadow-primary/40">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </span>
            <span className="text-[10px] font-semibold leading-none">More</span>
          </button>
        </div>
      </nav>

      {sheetOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSheetOpen(false)} />
          <div
            className="absolute bottom-0 inset-x-0 flex flex-col rounded-t-3xl bg-background border-t shadow-2xl"
            style={{ height: "82vh", maxHeight: "82dvh", paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="pt-2.5 pb-1 shrink-0">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="flex items-center gap-2 px-4 pb-2 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search modules..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-9 h-10 rounded-xl" />
              </div>
              <Button variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={() => setSheetOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 pb-6 overscroll-contain"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
            >
              {groups.map((g) => (
                <div key={g.key} className="mb-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">{g.label}</p>
                  <div className="grid grid-cols-4 gap-2">
                    {g.items.map((m) => {
                      const Icon = m.icon;
                      const active = activeModule === m.key;
                      const badge = liveBadge(m.key) ?? m.badge;
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => go(m.key)}
                          className={cn(
                            "relative flex flex-col items-center justify-center gap-1.5 rounded-2xl border min-h-[76px] p-3 transition-colors cursor-pointer",
                            active ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/40 text-foreground active:bg-muted"
                          )}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          <span className="text-[10px] font-medium leading-tight text-center">{m.label}</span>
                          {badge && (
                            <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {groups.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No modules match “{query}”.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
