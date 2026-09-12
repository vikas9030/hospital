"use client";

import { useAppStore } from "@/store/app-store";
import { cn, isAdmin, isNotifEnabled } from "@/lib/utils";
import {
  Menu,
  Search,
  Bell,
  BellRing,
  HelpCircle,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  Check,
  LogOut,
  User,
  Settings,
  Circle,
  CheckCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { InstallAppMenuItem } from "@/components/install-app-button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useEffect } from "react";
import { useBranchData } from "@/hooks/use-branch-data";

const PUSH_PREF_KEY = "medicore-push-enabled";

export function TopNav() {
  const { toggleSidebar, setMobileSidebar, theme, toggleTheme, activeBranch, setActiveBranch, setGlobalSearch, setActiveModule, selectPatient, logout, currentUser, branches, notifications: allNotifications, invoices, medicines, medicineAlerts } = useAppStore();
  const refreshNotifications = useAppStore((s) => s.refreshNotifications);
  const refreshMedicineAlerts = useAppStore((s) => s.refreshMedicineAlerts);
  const updateNotification = useAppStore((s) => s.updateNotification);
  const [searchOpen, setSearchOpen] = useState(false);
  const [pushOn, setPushOn] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const seenIds = useState<Set<string>>(new Set())[0];
  const branchData = useBranchData();

  const lowStock = medicines.filter((m) => m.status === "Low Stock" || m.status === "Out of Stock");
  // Backend-synced pharmacy alerts (near-expiry + low/out-of-stock).
  const activeMedAlerts = (medicineAlerts ?? []).filter((a) => a.status === "active");
  const medAlertNames = Array.from(new Set(activeMedAlerts.map((a) => a.medicineName))).slice(0, 3);
  const showMedAlerts = activeMedAlerts.length > 0 || lowStock.length > 0;
  const showBranchSwitcher = isAdmin(currentUser.role);

  const settings = useAppStore((s) => s.settings);
  const liveAlertsOn = settings.notif_liveAlerts === undefined ? true : settings.notif_liveAlerts === "true";
  const pollMs = (() => {
    const v = parseInt(settings.notif_pollInterval || "45") || 45;
    return Math.min(Math.max(v, 15), 300) * 1000;
  })();

  const visibleNotifications = allNotifications.filter((n) => isNotifEnabled(settings, n.type));
  // Visit-request alerts are front-desk only: Receptionist + Admin.
  const canHandleRequests = isAdmin(currentUser.role) || currentUser.role === "Receptionist";
  const showRequests = canHandleRequests && isNotifEnabled(settings, "appointment");
  const unreadCount = visibleNotifications.filter((n) => !n.read).length + (showRequests ? pendingRequests.length : 0) + (showMedAlerts ? 1 : 0);

  const pushNotify = (title: string, body: string, type = "appointment") => {
    try {
      if (!isNotifEnabled(settings, type)) return;
      if (pushOn && typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body });
      }
    } catch { /* notifications unavailable */ }
  };

  const pollAlerts = async () => {
    if (!liveAlertsOn) return;
    await refreshNotifications();
    try { await refreshMedicineAlerts(); } catch { /* offline */ }
    if (!showRequests || !canHandleRequests) {
      setPendingRequests([]);
      return;
    }
    try {
      const res = await fetch(`/api/appointment-requests?branch=${encodeURIComponent(branchData.branch)}&status=Requested`);
      if (res.ok) {
        const all = await res.json();
        const list = Array.isArray(all) ? all.slice(0, 5) : [];
        for (const r of list) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            pushNotify("New visit request", `${r.patientName} requested ${r.doctorName} on ${r.date} at ${r.time}.`, "appointment");
          }
        }
        setPendingRequests(Array.isArray(all) ? all : []);
      }
    } catch { /* offline */ }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Live alerts: refresh from Supabase + push on brand-new items.
  useEffect(() => {
    setPushOn(typeof window !== "undefined" && localStorage.getItem(PUSH_PREF_KEY) === "1" && "Notification" in window && Notification.permission === "granted");
    pollAlerts();
    const t = setInterval(pollAlerts, pollMs);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchData.branch, liveAlertsOn, pollMs]);

  const togglePush = async () => {
    try {
      if (!("Notification" in window)) return;
      if (pushOn) {
        setPushOn(false);
        localStorage.setItem(PUSH_PREF_KEY, "0");
        return;
      }
      const perm = await Notification.requestPermission();
      const enabled = perm === "granted";
      setPushOn(enabled);
      localStorage.setItem(PUSH_PREF_KEY, enabled ? "1" : "0");
      if (enabled) pushNotify("Push alerts on", "You will be notified of new visit requests and updates.");
    } catch { /* ignore */ }
  };

  const markRead = async (id: string) => {
    updateNotification(id, { read: true });
    try {
      await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, read: true }) });
    } catch { /* local state already updated */ }
  };

  const markAllRead = async () => {
    const unread = visibleNotifications.filter((n) => !n.read);
    for (const n of unread) {
      updateNotification(n.id, { read: true });
      try {
        await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id, read: true }) });
      } catch { /* continue */ }
    }
  };

  const goModule = (type: string) => {
    const map: Record<string, string> = {
      appointment: "appointments", billing: "billing", lab: "laboratory",
      radiology: "radiology", pharmacy: "pharmacy", patient: "patients",
      inventory: "inventory", doctor: "doctors",
    };
    setActiveModule((map[type] || "dashboard") as any);
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Desktop collapse (mobile uses the bottom nav instead) */}
      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:flex"
        onClick={toggleSidebar}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search */}
      <div className="flex flex-1 items-center max-w-xl">
        <Button
          variant="outline"
          className="w-full justify-start gap-2 text-muted-foreground h-9 px-3"
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Search patients, doctors, invoices...</span>
          <span className="sm:hidden">Search...</span>
          <kbd className="ml-auto hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* Branch Selector - Admin only */}
      {showBranchSwitcher && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="hidden md:flex gap-2 h-9">
              <Building2 className="h-4 w-4 text-primary" />
              <span className="max-w-[140px] truncate">{activeBranch}</span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel>Select Branch</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {branches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => setActiveBranch(branch.name)}
                className="flex items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{branch.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{branch.location}</p>
                </div>
                {activeBranch === branch.name && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
        {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
      </Button>

      {/* Help */}
      <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
        <HelpCircle className="h-4.5 w-4.5" />
      </Button>

      {/* Unified notification center */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Notifications">
            {pushOn ? <BellRing className="h-4.5 w-4.5" /> : <Bell className="h-4.5 w-4.5" />}
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b p-3">
            <p className="font-semibold text-sm">Notifications</p>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={togglePush} title="Browser push alerts for new requests">
                {pushOn ? "Push on" : "Push off"}
              </Button>
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={markAllRead} title="Mark all as read">
                <CheckCheck className="h-3 w-3" /> Read all
              </Button>
            </div>
          </div>
          <ScrollArea className="h-80">
            <div className="divide-y">
              {showRequests && pendingRequests.length > 0 && (
                <div
                  className="flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer bg-info/5"
                  onClick={() => setActiveModule("appointments" as any)}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                    <Circle className="h-2 w-2 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{pendingRequests.length} visit request{pendingRequests.length === 1 ? "" : "s"} awaiting confirmation</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {pendingRequests.slice(0, 3).map((r) => `${r.patientName} → ${r.doctorName}`).join("; ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Tap to review in Appointments</p>
                  </div>
                </div>
              )}
              {showMedAlerts && (
                <div
                  className="flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer bg-warning/5"
                  onClick={() => setActiveModule("pharmacy" as any)}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/10 text-warning">
                    <Circle className="h-2 w-2 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {activeMedAlerts.length > 0
                        ? `${activeMedAlerts.length} pharmacy alert${activeMedAlerts.length === 1 ? "" : "s"} — stock & expiry`
                        : `${lowStock.length} medicine${lowStock.length === 1 ? "" : "s"} low / out of stock`}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {activeMedAlerts.length > 0 ? medAlertNames.join(", ") : lowStock.slice(0, 3).map((m) => m.name).join(", ")}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Tap to review in Pharmacy</p>
                  </div>
                </div>
              )}
              {visibleNotifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    !n.read && "bg-primary/5"
                  )}
                  onClick={() => { markRead(n.id); goModule(n.type); }}
                >
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    n.priority === "high" ? "bg-destructive/10 text-destructive" :
                    n.priority === "medium" ? "bg-warning/10 text-warning" :
                    "bg-info/10 text-info"
                  )}>
                    <Circle className="h-2 w-2 fill-current" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{n.time}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </div>
              ))}
              {visibleNotifications.length === 0 && pendingRequests.length === 0 && lowStock.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">All caught up — no new alerts.</p>
              )}
            </div>
          </ScrollArea>
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full text-xs" onClick={pollAlerts}>Refresh now</Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 h-9 px-2">
            <Avatar className="h-7 w-7">
              {currentUser.avatar?.startsWith("http") || currentUser.avatar?.startsWith("data:") ? (
                <AvatarImage src={currentUser.avatar} alt={currentUser.name} className="object-cover" />
              ) : null}
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">{currentUser.avatar}</AvatarFallback>
            </Avatar>
            <div className="hidden lg:block text-left">
              <p className="text-xs font-semibold leading-none">{currentUser.name.split(" ").slice(0, 2).join(" ")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{currentUser.role}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden lg:block" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div>
              <p className="text-sm font-semibold">{currentUser.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{currentUser.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setActiveModule("settings")}>
            <Settings className="mr-2 h-4 w-4" /> Settings
          </DropdownMenuItem>
          <InstallAppMenuItem />
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global Search Dialog */}
      <CommandDialog open={searchOpen} onOpenChange={setSearchOpen} title="Search" description="Search across the entire hospital system">
        <CommandInput placeholder="Search patients, doctors, invoices..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Patients">
            {branchData.patients.slice(0, 4).map((p) => (
              <CommandItem
                key={p.id}
                onSelect={() => {
                  setActiveModule("patients");
                  selectPatient(p.id);
                  setSearchOpen(false);
                }}
                className="gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                  {p.photo}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.uhid} • {p.phone}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Doctors">
            {branchData.doctors.slice(0, 3).map((d) => (
              <CommandItem
                key={d.id}
                onSelect={() => {
                  setActiveModule("doctors");
                  setSearchOpen(false);
                }}
                className="gap-3"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-info/10 text-info text-xs font-semibold">
                  {d.photo}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.specialization}</p>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Appointments">
            {branchData.appointments.slice(0, 3).map((a) => (
              <CommandItem key={a.id} onSelect={() => { setActiveModule("appointments"); setSearchOpen(false); }}>
                <span className="text-sm">{a.token} - {a.patientName} ({a.time})</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Invoices">
            {invoices.slice(0, 3).map((inv) => (
              <CommandItem key={inv.id} onSelect={() => { setActiveModule("billing"); setSearchOpen(false); }}>
                <span className="text-sm">{inv.invoiceNo} - {inv.patientName} - ₹{inv.total.toLocaleString()}</span>
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandGroup heading="Medicines">
            {medicines.slice(0, 3).map((m) => (
              <CommandItem key={m.id} onSelect={() => { setActiveModule("pharmacy"); setSearchOpen(false); }}>
                <span className="text-sm">{m.name} — {m.category} — ₹{m.price}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </header>
  );
}
