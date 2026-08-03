"use client";

import { useAppStore } from "@/store/app-store";
import { branches, notifications } from "@/lib/data";
import { cn } from "@/lib/utils";
import {
  Menu,
  Search,
  Bell,
  MessageSquare,
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useState, useEffect } from "react";
import { patients, doctors, appointments, invoices, medicines } from "@/lib/data";

export function TopNav() {
  const { toggleSidebar, setMobileSidebar, theme, toggleTheme, activeBranch, setActiveBranch, setGlobalSearch, setActiveModule, selectPatient, logout, currentUser } = useAppStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  // Keyboard shortcut for search
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

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/80 px-4 backdrop-blur-xl lg:px-6">
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileSidebar(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Desktop collapse */}
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

      {/* Branch Selector */}
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

      {/* Theme toggle */}
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-9 w-9">
        {theme === "light" ? <Moon className="h-4.5 w-4.5" /> : <Sun className="h-4.5 w-4.5" />}
      </Button>

      {/* Help */}
      <Button variant="ghost" size="icon" className="h-9 w-9 hidden sm:flex">
        <HelpCircle className="h-4.5 w-4.5" />
      </Button>

      {/* Messages */}
      <Button variant="ghost" size="icon" className="h-9 w-9 relative hidden sm:flex">
        <MessageSquare className="h-4.5 w-4.5" />
        <Badge className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[9px]">3</Badge>
      </Button>

      {/* Notifications */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9 relative">
            <Bell className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b p-3">
            <p className="font-semibold text-sm">Notifications</p>
            <Badge variant="secondary" className="text-[10px]">{unreadCount} new</Badge>
          </div>
          <ScrollArea className="h-80">
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer",
                    !n.read && "bg-primary/5"
                  )}
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
                </div>
              ))}
            </div>
          </ScrollArea>
          <div className="border-t p-2">
            <Button variant="ghost" size="sm" className="w-full text-xs">View all notifications</Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Profile */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="gap-2 h-9 px-2">
            <Avatar className="h-7 w-7">
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
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Global Search Dialog */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSearchOpen(false)} />
          <div className="relative w-full max-w-2xl">
            <Command className="rounded-xl border shadow-2xl bg-popover">
              <CommandInput placeholder="Search across the entire hospital system..." />
              <CommandList className="max-h-[400px]">
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Patients">
                  {patients.slice(0, 4).map((p) => (
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
                  {doctors.slice(0, 3).map((d) => (
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
                  {appointments.slice(0, 3).map((a) => (
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
              </CommandList>
            </Command>
          </div>
        </div>
      )}
    </header>
  );
}
