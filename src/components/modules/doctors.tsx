"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  Stethoscope, Star, Phone, Mail, Calendar, Users, Award,
  Clock, Video, FileText, Search, Pencil, Trash2, Building2, Plus,
  CalendarDays,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { NewAppointmentDialog } from "@/components/modules/appointments";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useDepartmentOptions } from "@/components/modules/departments";
import { useBranchData } from "@/hooks/use-branch-data";
import { isAdmin, canEditModule, canDeleteModule, scheduleActor } from "@/lib/utils";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import type { Doctor, Appointment, DayShift } from "@/lib/types";
import { ScheduleBuilder, formatSchedule } from "@/components/shared/schedule-builder";

const availabilityColors = {
  Available: "bg-success/10 text-success border-success/20",
  Busy: "bg-warning/10 text-warning border-warning/20",
  "Off Duty": "bg-muted text-muted-foreground border-border",
  "On Leave": "bg-info/10 text-info border-info/20",
};

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DoctorEditDialog({ open, onOpenChange, doctor }: { open: boolean; onOpenChange: (v: boolean) => void; doctor?: Doctor }) {
  const { toast } = useToast();
  const updateDoctor = useAppStore((s) => s.updateDoctor);
  const updateStaffMember = useAppStore((s) => s.updateStaffMember);
  const syncDoctorFromStaff = useAppStore((s) => s.syncDoctorFromStaff);
  const storeBranches = useAppStore((s) => s.branches);
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  const setDoctorSchedules = useAppStore((s) => s.setDoctorSchedules);
  const [form, setForm] = useState(() => ({
    specialization: doctor?.specialization ?? "", department: doctor?.department ?? "",
    qualification: doctor?.qualification ?? "", experience: String(doctor?.experience ?? ""),
    phone: doctor?.phone ?? "", email: doctor?.email ?? "", consultationFee: String(doctor?.consultationFee ?? ""),
    availability: (doctor?.availability ?? "Available") as Doctor["availability"],
    availableDays: doctor?.availableDays ?? [] as string[],
    availableFrom: doctor?.availableFrom || "09:00",
    availableTo: doctor?.availableTo || "17:00",
    shift: doctor?.shift || "Morning",
    schedule: (doctor?.schedule ?? []) as DayShift[],
  }));
  const [saving, setSaving] = useState(false);
  const deptOptions = useDepartmentOptions(doctor?.branch);
  const deptItems = form.department && !deptOptions.includes(form.department) ? [form.department, ...deptOptions] : deptOptions;

  const effectiveEmail = (form.email || doctor?.email || `${(doctor?.name ?? "doctor").toLowerCase().replace(/[^a-z0-9]+/g, ".")}.${Date.now()}@medicore.local`).toLowerCase();

  type BranchDraft = { days: string[]; from: string; to: string; shift: string };
  const buildInitialDrafts = (): Record<string, BranchDraft> => {
    const draft: Record<string, BranchDraft> = {};
    const email = (doctor?.email || "").toLowerCase();
    for (const s of doctorSchedules.filter((x) => x.doctorEmail === email)) {
      draft[s.branch] = { days: s.availableDays, from: s.availableFrom || "09:00", to: s.availableTo || "17:00", shift: s.shift || "Morning" };
    }
    return draft;
  };
  const [schedDraft, setSchedDraft] = useState<Record<string, BranchDraft>>(buildInitialDrafts);
  const [dirtyBranches, setDirtyBranches] = useState<string[]>([]);
  const [activeSchedBranch, setActiveSchedBranch] = useState<string>(doctor?.branch || storeBranches[0]?.name || "");

  const markDirty = (branch: string) => {
    setDirtyBranches((prev) => (prev.includes(branch) ? prev : [...prev, branch]));
  };
  const addDraftFor = (branch: string) => {
    setSchedDraft((d) => ({
      ...d,
      [branch]: { days: form.availableDays, from: form.availableFrom, to: form.availableTo, shift: form.shift },
    }));
    markDirty(branch);
  };
  const toggleSchedDay = (branch: string, day: string) => {
    setSchedDraft((d) => ({
      ...d,
      [branch]: {
        ...d[branch],
        days: d[branch].days.includes(day) ? d[branch].days.filter((x) => x !== day) : [...d[branch].days, day],
      },
    }));
    markDirty(branch);
  };
  const updateSchedField = (branch: string, field: "from" | "to" | "shift", value: string) => {
    setSchedDraft((d) => ({ ...d, [branch]: { ...d[branch], [field]: value } }));
    markDirty(branch);
  };

  const handleSubmit = async () => {
    if (!doctor) return;
    const schedDays = Array.from(new Set(form.schedule.map((s) => s.day)));
    const schedFrom = form.schedule.length > 0 ? form.schedule.map((s) => s.from).sort()[0] : form.availableFrom;
    const schedTo = form.schedule.length > 0 ? form.schedule.map((s) => s.to).sort().reverse()[0] : form.availableTo;
    const updates = {
      specialization: form.specialization, department: form.department,
      qualification: form.qualification, experience: parseInt(form.experience) || 0,
      phone: form.phone, email: effectiveEmail, consultationFee: parseFloat(form.consultationFee) || 0,
      availability: form.availability as Doctor["availability"],
      availableDays: schedDays.length > 0 ? schedDays : form.availableDays,
      availableFrom: schedFrom,
      availableTo: schedTo,
      shift: form.shift,
      schedule: form.schedule,
    };
    setSaving(true);
    try {
      // Always resolve to the canonical doctors-table row first (creates it if
      // the doctor only existed as a staff-derived record). Prevents updates
      // hitting a nonexistent id.
      const ensureRes = await fetch("/api/doctors/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: effectiveEmail,
          name: doctor.name,
          phone: updates.phone,
          branch: doctor.branch,
          department: updates.department,
        }),
      });
      if (!ensureRes.ok) {
        const body = await ensureRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to resolve the doctor record.");
      }
      const canonical = await ensureRes.json();

      if (doctor.id.startsWith("d-staff-")) {
        // Mirror contact/fee changes onto the underlying staff record.
        const staffId = doctor.id.slice("d-staff-".length);
        const res = await fetch("/api/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: staffId,
            department: updates.department,
            phone: updates.phone,
            email: effectiveEmail,
            consultationFee: updates.consultationFee,
            availableDays: updates.availableDays,
            availableFrom: updates.availableFrom,
            availableTo: updates.availableTo,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to save changes.");
        }
        updateStaffMember(staffId, {
          department: updates.department, phone: updates.phone, email: effectiveEmail,
          consultationFee: updates.consultationFee,
          availableDays: updates.availableDays,
          availableFrom: updates.availableFrom,
          availableTo: updates.availableTo,
        } as any);
        syncDoctorFromStaff({
          ...(doctor as any),
          id: staffId,
          name: doctor.name,
          phone: updates.phone,
          email: effectiveEmail,
          department: updates.department,
          consultationFee: updates.consultationFee,
          availableDays: updates.availableDays,
          availableFrom: updates.availableFrom,
          availableTo: updates.availableTo,
          branch: doctor.branch,
        });
      }

      const res2 = await fetch("/api/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: canonical.id, ...updates }),
      });
      if (!res2.ok) {
        const body = await res2.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save changes.");
      }
      // Update the canonical row (not a pseudo staff id) so lists, the
      // portal, and billing read the saved fee/days immediately.
      updateDoctor(canonical.id, await res2.json());

      // Persist changed per-branch schedules.
      for (const branchName of dirtyBranches) {
        const draft = schedDraft[branchName];
        if (!draft) continue;
        const res = await fetch("/api/doctor-schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doctorEmail: effectiveEmail,
            branch: branchName,
            availableDays: draft.days,
            availableFrom: draft.from,
            availableTo: draft.to,
            shift: draft.shift,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Failed to save the schedule for ${branchName}.`);
        }
        const saved = await res.json();
        const rest = doctorSchedules.filter((s) => !(s.doctorEmail === effectiveEmail && s.branch === branchName));
        setDoctorSchedules([...rest, saved]);
      }
    } catch (e: any) {
      toast({ title: "Could not update doctor", description: e.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    setSaving(false);
    toast({ title: "Updated", description: `${doctor.name} profile updated successfully` });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Doctor Profile</DialogTitle><DialogDescription>Update doctor availability, fees, and specialized details for {doctor?.name}</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
        {doctor && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-bold">{doctor.photo}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{doctor.name}</p>
              <p className="text-xs text-muted-foreground">{doctor.email}</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Specialization</Label><Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="e.g. Cardiologist" /></div>
          <div className="space-y-2"><Label>Department</Label><Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{deptItems.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Availability</Label><Select value={form.availability} onValueChange={(v) => setForm({ ...form, availability: v as Doctor["availability"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Available", "Busy", "Off Duty", "On Leave", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Consultation Fee (₹)</Label><Input value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} placeholder="Fee amount" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Qualification</Label><Input value={form.qualification} onChange={(e) => setForm({ ...form, qualification: e.target.value })} placeholder="e.g. MBBS, MD" /></div>
          <div className="space-y-2"><Label>Experience (yrs)</Label><Input value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} placeholder="Years of experience" /></div>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
          <ScheduleBuilder value={form.schedule} onChange={(schedule) => setForm({ ...form, schedule })} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Available Days (fallback)</Label><Input value={form.availableDays.join(", ") || "All days"} readOnly className="bg-muted/40" /></div>
          <div className="space-y-2"><Label>Hours (from builder)</Label><Input value={form.schedule.length > 0 ? `${form.schedule.map((s) => s.from).sort()[0]} – ${form.schedule.map((s) => s.to).sort().reverse()[0]}` : `${form.availableFrom} – ${form.availableTo}`} readOnly className="bg-muted/40" /></div>
          <div className="space-y-2"><Label>Shift</Label><Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Evening">Evening</SelectItem><SelectItem value="Night">Night</SelectItem></SelectContent></Select></div>
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">Default schedule with multiple shifts per day. Add per-branch overrides below — same doctor, different days/shifts per branch.</p>
        <div className="space-y-3 rounded-lg border border-info/20 bg-info/5 p-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> Branch schedule</Label>
            <Select value={activeSchedBranch} onValueChange={setActiveSchedBranch}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {storeBranches.map((b) => (
                  <SelectItem key={b.id} value={b.name}>
                    {b.name}{schedDraft[b.name] ? " ✓" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {activeSchedBranch && schedDraft[activeSchedBranch] ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {WEEK_DAYS.map((day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleSchedDay(activeSchedBranch, day)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                      schedDraft[activeSchedBranch].days.includes(day)
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/40 border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5"><Label className="text-[11px]">From</Label><Input type="time" className="h-8" value={schedDraft[activeSchedBranch].from} onChange={(e) => updateSchedField(activeSchedBranch, "from", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-[11px]">To</Label><Input type="time" className="h-8" value={schedDraft[activeSchedBranch].to} onChange={(e) => updateSchedField(activeSchedBranch, "to", e.target.value)} /></div>
                <div className="space-y-1.5"><Label className="text-[11px]">Shift</Label><Select value={schedDraft[activeSchedBranch].shift} onValueChange={(v) => updateSchedField(activeSchedBranch, "shift", v)}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Evening">Evening</SelectItem><SelectItem value="Night">Night</SelectItem></SelectContent></Select></div>
              </div>
              {dirtyBranches.includes(activeSchedBranch) && (
                <p className="text-[11px] text-primary">Unsaved changes for {activeSchedBranch} — click Update Profile to save.</p>
              )}
            </>
          ) : (
            <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => activeSchedBranch && addDraftFor(activeSchedBranch)}>
              <Plus className="h-3.5 w-3.5" /> Add schedule for {activeSchedBranch || "branch"}
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
          <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" /></div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Update Profile"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteConfirmDialog({ open, onOpenChange, doctorName, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; doctorName: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete Doctor</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{doctorName}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={onConfirm}>Delete</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const aptTypeColors: Record<string, string> = {
  "Walk-in": "bg-info/10 text-info border-info/20",
  Online: "bg-primary/10 text-primary border-primary/20",
  Emergency: "bg-destructive/10 text-destructive border-destructive/20",
  Referral: "bg-warning/10 text-warning border-warning/20",
};

function DoctorAppointmentsDialog({ open, onOpenChange, doctor }: { open: boolean; onOpenChange: (v: boolean) => void; doctor: Doctor | null }) {
  const { appointments } = useBranchData();
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "upcoming" | "past">("all");

  const todayStr = new Date().toISOString().split("T")[0];

  const doctorApts = useMemo(() => {
    if (!doctor) return [];
    return appointments
      .filter((a) => a.doctorId === doctor.id || a.doctorName === doctor.name)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [appointments, doctor]);

  const filtered = useMemo(() => {
    let list = doctorApts;
    if (dateFilter === "today") list = list.filter((a) => a.date === todayStr);
    else if (dateFilter === "upcoming") list = list.filter((a) => a.date > todayStr);
    else if (dateFilter === "past") list = list.filter((a) => a.date < todayStr);
    if (statusFilter !== "All") list = list.filter((a) => a.status === statusFilter);
    return list;
  }, [doctorApts, dateFilter, statusFilter, todayStr]);

  const counts = useMemo(() => ({
    total: doctorApts.length,
    today: doctorApts.filter((a) => a.date === todayStr).length,
    upcoming: doctorApts.filter((a) => a.date > todayStr).length,
    past: doctorApts.filter((a) => a.date < todayStr).length,
  }), [doctorApts, todayStr]);

  const handleStatusUpdate = async (apt: Appointment, status: string) => {
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apt.id, status, ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update.");
      }
      const saved = await res.json();
      updateAppointment(apt.id, saved);
      toast({ title: "Status updated", description: `${apt.token} → ${status}` });
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  if (!doctor) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {doctor.name} — All Appointments
          </DialogTitle>
          <DialogDescription>
            {counts.total} appointment{counts.total !== 1 ? "s" : ""} assigned • {counts.today} today • {counts.upcoming} upcoming
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
              {[
                { key: "all", label: `All (${counts.total})` },
                { key: "today", label: `Today (${counts.today})` },
                { key: "upcoming", label: `Upcoming (${counts.upcoming})` },
                { key: "past", label: `Past (${counts.past})` },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setDateFilter(f.key as typeof dateFilter)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    dateFilter === f.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Filter status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All statuses</SelectItem>
                {["Scheduled", "Checked-in", "In Consultation", "Completed", "Cancelled", "No-show"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ScrollArea className="max-h-[50vh]">
            {filtered.length === 0 ? (
              <div className="py-12 text-center">
                <CalendarDays className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No appointments found</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the filters above.</p>
              </div>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[70px]">Token</TableHead>
                      <TableHead>Patient</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="hidden md:table-cell">Type</TableHead>
                      <TableHead className="hidden lg:table-cell">Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[80px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((apt) => (
                      <TableRow key={apt.id} className="hover:bg-muted/40">
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{apt.token}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">{apt.patientPhoto}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium truncate max-w-[140px]">{apt.patientName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{apt.date}</TableCell>
                        <TableCell className="text-sm font-medium">{apt.time}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant="outline" className={`text-[10px] ${aptTypeColors[apt.type] || ""}`}>{apt.type}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[160px]">{apt.reason || "—"}</TableCell>
                        <TableCell><StatusBadge status={apt.status} /></TableCell>
                        <TableCell>
                          {["Scheduled", "Checked-in"].includes(apt.status) ? (
                            <Select
                              value={apt.status}
                              onValueChange={(v) => handleStatusUpdate(apt, v)}
                            >
                              <SelectTrigger className="h-7 w-[100px] text-[10px] border-0 bg-transparent hover:bg-muted/60 px-1.5 shadow-none">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {["Scheduled", "Checked-in", "In Consultation", "Completed", "Cancelled", "No-show"].map((s) => (
                                  <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              Showing {filtered.length} of {doctorApts.length} appointments for Dr. {doctor.name}
            </p>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DoctorsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const deleteDoctor = useAppStore((s) => s.deleteDoctor);
  const updateDoctor = useAppStore((s) => s.updateDoctor);
  const addDoctor = useAppStore((s) => s.addDoctor);
  const { doctors, patients, appointments, branch } = useBranchData();
  const doctorIO: EntityIOConfig<Doctor> = {
    entity: "doctors",
    filename: "doctors",
    columns: [
      { header: "name", sample: "Dr. Smith" },
      { header: "specialization", sample: "General Medicine" },
      { header: "department", sample: "General Medicine" },
      { header: "experience", sample: "10" },
      { header: "qualification", sample: "MBBS, MD" },
      { header: "phone", sample: "9876543210" },
      { header: "email", sample: "smith@clinic.com" },
      { header: "consultationFee", sample: "500" },
      { header: "availability", sample: "Available" },
      { header: "branch", sample: branch },
    ],
    toRow: (d) => [d.name, d.specialization, d.department, d.experience, d.qualification, d.phone, d.email, d.consultationFee, d.availability, d.branch],
    fromRow: (row, i) => {
      if (!row.name) throw new Error("name is required.");
      return {
        id: `d${Date.now()}${i}`,
        name: row.name,
        photo: row.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
        specialization: row.specialization || row.department || "General Medicine",
        department: row.department || row.specialization || "General Medicine",
        experience: parseInt(row.experience) || 0,
        qualification: row.qualification || "",
        phone: row.phone || "",
        email: row.email || `${row.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@medicore.local`,
        availability: ["Available", "Busy", "Off Duty", "On Leave", "Follow Up"].includes(row.availability) ? row.availability : "Available",
        rating: 0,
        consultationFee: parseFloat(row.consultationFee) || 0,
        todayAppointments: 0,
        patientsTreated: 0,
        branch: row.branch || branch,
        availableDays: [],
        availableFrom: "",
        availableTo: "",
        shift: "",
      };
    },
    endpoint: "/api/doctors",
    onImported: (saved) => addDoctor(saved),
  };
  const updateStaffMember = useAppStore((s) => s.updateStaffMember);
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const setPatientFilterDoctor = useAppStore((s) => s.setPatientFilterDoctor);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("All");
  const [editDoctor, setEditDoctor] = useState<Doctor | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Doctor | null>(null);
  const [booking, setBooking] = useState<{ doctorId: string; type: "Walk-in" | "Online"; key: string } | undefined>(undefined);
  const [aptListDoctor, setAptListDoctor] = useState<Doctor | null>(null);
  const showAdminActions = isAdmin(currentUser.role);

  // Real per-doctor patient assignment + today's appointment counts.
  const assignedCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of patients) {
      if (!p.doctorName) continue;
      map[p.doctorName] = (map[p.doctorName] || 0) + 1;
    }
    return map;
  }, [patients]);
  const todayStr = new Date().toISOString().split("T")[0];
  const todayAptCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of appointments) {
      if (a.date !== todayStr) continue;
      map[a.doctorId] = (map[a.doctorId] || 0) + 1;
      map[a.doctorName] = (map[a.doctorName] || 0) + 1;
    }
    return map;
  }, [appointments, todayStr]);

  const openBooking = (doc: Doctor, type: "Walk-in" | "Online") =>
    setBooking({ doctorId: doc.id, type, key: `${doc.id}-${type}-${Date.now()}` });
  const viewAssignedPatients = (doc: Doctor) => {
    setPatientFilterDoctor(doc.name);
    setActiveModule("patients");
  };

  const changeAvailability = async (doc: Doctor, availability: Doctor["availability"]) => {
    try {
      // Resolve to the canonical doctors-table row (creates it for staff-derived doctors).
      const email = (doc.email || `${doc.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@medicore.local`).toLowerCase();
      const ensureRes = await fetch("/api/doctors/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: doc.name, phone: doc.phone, branch: doc.branch, department: doc.department }),
      });
      if (!ensureRes.ok) throw new Error("Failed to resolve doctor record.");
      const canonical = await ensureRes.json();
      const res = await fetch("/api/doctors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: canonical.id, availability }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update availability.");
      }
      if (doc.id.startsWith("d-staff-")) {
        const staffId = doc.id.slice("d-staff-".length);
        const staffStatus = availability === "On Leave" ? "On Leave" : availability === "Off Duty" ? "Inactive" : availability === "Follow Up" ? "Follow Up" : "Active";
        await fetch("/api/staff", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: staffId, status: staffStatus }),
        }).catch(() => {});
        updateStaffMember(staffId, { status: staffStatus as any });
      }
      updateDoctor(doc.id, { availability });
      toast({ title: "Availability updated", description: `${doc.name} is now ${availability}.` });
    } catch (e: any) {
      toast({ title: "Could not update availability", description: e.message, variant: "destructive" });
    }
  };

  const specialties = ["All", ...Array.from(new Set(doctors.map((d) => d.department)))];

  const filtered = doctors.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase());
    const matchSpec = specialty === "All" || d.department === specialty;
    return matchSearch && matchSpec;
  });
  const {
    pageItems: pagedDoctors, page: docPage, setPage: setDocPage,
    pageSize: docPageSize, setPageSize: setDocPageSize, totalPages: docPages, total: docTotal,
  } = usePagination(filtered, `${search}|${specialty}`);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      // Staff-derived doctors have no standalone doctors row; skip the API call.
      if (!deleteTarget.id.startsWith("d-staff-")) {
        const res = await fetch("/api/doctors", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: deleteTarget.id }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to delete the doctor.");
        }
      }
      deleteDoctor(deleteTarget.id);
      toast({ title: "Doctor removed", description: `${deleteTarget.name} has been deleted.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete doctor", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description="View and manage doctor profiles, availability, and fees"
        icon={Stethoscope}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Doctors" value={doctors.length.toString()} icon={Stethoscope} color="primary" />
        <StatCard title="Available Now" value={doctors.filter(d => d.availability === "Available").length.toString()} icon={Clock} color="success" />
        <StatCard title="On Leave" value={doctors.filter(d => d.availability === "On Leave").length.toString()} icon={Calendar} color="info" />
        <StatCard title="Today's Consultations" value={appointments.filter(a => a.date === todayStr).length.toString()} icon={Users} color="warning" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                specialty === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {showAdminActions && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{docTotal} doctor{docTotal === 1 ? "" : "s"}</p>
          <ImportExportButtons config={doctorIO} items={filtered} compact />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {pagedDoctors.map((doc, idx) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="h-20 bg-gradient-to-r from-primary/15 to-info/10" />
              <CardContent className="p-5 -mt-10">
                <div className="flex items-end justify-between mb-3">
                  <Avatar className="h-16 w-16 border-4 border-background shadow-md">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{doc.photo}</AvatarFallback>
                  </Avatar>
                  {showAdminActions ? (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Select value={doc.availability} onValueChange={(v) => changeAvailability(doc, v as Doctor["availability"])}>
                        <SelectTrigger className="h-7 w-[120px] text-[10px] border-success/30 bg-success/5 px-2 shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["Available", "Busy", "Off Duty", "On Leave", "Follow Up"].map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <Badge variant="outline" className={`mb-1 ${availabilityColors[doc.availability as keyof typeof availabilityColors] || ""}`}>
                      <span className="h-1.5 w-1.5 rounded-full bg-current mr-1" />
                      {doc.availability}
                    </Badge>
                  )}
                </div>
                <div className="mb-3">
                  <h3 className="font-bold text-base">{doc.name}</h3>
                  <p className="text-sm text-primary font-medium">{doc.specialization}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.department} &bull; {doc.experience} yrs exp</p>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="text-sm font-semibold">{doc.rating}</span>
                  <span className="text-xs text-muted-foreground">&bull; {doc.patientsTreated.toLocaleString()} patients</span>
                  {doc.consultationFee > 0 && (
                    <span className="text-xs text-muted-foreground">&bull; &#8377;{doc.consultationFee}/consult</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <button type="button" onClick={() => viewAssignedPatients(doc)} className="rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors cursor-pointer">
                    <p className="text-lg font-bold text-primary">{assignedCounts[doc.name] ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Assigned Patients</p>
                  </button>
                  <button type="button" onClick={() => setAptListDoctor(doc)} className="rounded-lg bg-muted/50 p-2 hover:bg-muted transition-colors cursor-pointer">
                    <p className="text-lg font-bold text-success">{todayAptCounts[doc.id] ?? todayAptCounts[doc.name] ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">Today&apos;s Appts</p>
                  </button>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openBooking(doc, "Walk-in")}>
                    <Calendar className="h-3.5 w-3.5" /> Book
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" title="View all appointments" onClick={() => setAptListDoctor(doc)}>
                    <CalendarDays className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" title="View assigned patients" onClick={() => viewAssignedPatients(doc)}>
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                  {showAdminActions && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditDoctor(doc)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(doc)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {doc.phone}</span>
                  <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {doc.qualification.split(",")[0]}</span>
                </div>
              <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3 shrink-0" />
                <span className="truncate" title={doc.schedule && doc.schedule.length > 0 ? formatSchedule(doc.schedule) : undefined}>
                  {doc.schedule && doc.schedule.length > 0
                    ? formatSchedule(doc.schedule)
                    : (doc.availableDays?.length ?? 0) > 0
                      ? `${doc.availableDays!.join(", ")}${doc.availableFrom && doc.availableTo ? ` • ${doc.availableFrom}–${doc.availableTo}` : ""}${doc.shift ? ` • ${doc.shift} shift` : ""}`
                      : `Available all days${doc.shift ? ` • ${doc.shift} shift` : ""}`}
                </span>
              </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <DataPagination page={docPage} totalPages={docPages} pageSize={docPageSize} total={docTotal} onPage={setDocPage} onPageSize={setDocPageSize} />
      <DoctorEditDialog key={editDoctor?.id} open={!!editDoctor} onOpenChange={(v) => { if (!v) setEditDoctor(undefined); }} doctor={editDoctor} />
      {deleteTarget && <DeleteConfirmDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }} doctorName={deleteTarget.name} onConfirm={handleDelete} />}
      <DoctorAppointmentsDialog open={!!aptListDoctor} onOpenChange={(v) => { if (!v) setAptListDoctor(null); }} doctor={aptListDoctor} />
      {booking && (
        <NewAppointmentDialog
          key={booking.key}
          open
          onOpenChange={(v) => { if (!v) setBooking(undefined); }}
          presetDoctorId={booking.doctorId}
          presetType={booking.type}
        />
      )}
    </div>
  );
}
