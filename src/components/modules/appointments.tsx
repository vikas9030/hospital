"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useBranchData } from "@/hooks/use-branch-data";
import {
    CalendarClock, Plus, Clock, Users, CheckCircle2, XCircle,
    Calendar as CalIcon, List, Grid3x3, Video, AlertTriangle, Search, IndianRupee, Trash2, X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { canAddPatient, isDoctorAvailableOn, isAdmin, canCollectPayment, isDoctorLikeRole, scheduleActor, canManageAppointment } from "@/lib/utils";
import { findServicePrice, parseServicePrices } from "@/lib/service-pricing";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { VisitRequestsInbox } from "@/components/shared/visit-requests-inbox";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import type { Appointment, LabTest, RadiologyOrder, Prescription, Invoice } from "@/lib/types";

const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

const typeColors = {
  "Walk-in": "bg-info/10 text-info border-info/20",
  "Online": "bg-primary/10 text-primary border-primary/20",
  "Emergency": "bg-destructive/10 text-destructive border-destructive/20",
  "Referral": "bg-warning/10 text-warning border-warning/20",
};

function categorizeAppointments(appointments: Appointment[]) {
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const past: Appointment[] = [];
  const present: Appointment[] = [];
  const future: Appointment[] = [];

  for (const apt of appointments) {
    if (apt.date < todayStr) {
      past.push(apt);
    } else if (apt.date > todayStr) {
      future.push(apt);
    } else {
      present.push(apt);
    }
  }
  return { past, present, future };
}

function SearchSelect({ value, onSelect, placeholder, searchPlaceholder, emptyText, items }: {
  value: string;
  onSelect: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  items: { value: string; label: string; hint?: string }[];
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((i) => i.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-9">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{selected ? selected.label : placeholder}</span>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={`${item.label} ${item.hint ?? ""}`}
                  onSelect={() => { onSelect(item.value); setOpen(false); }}
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.hint && <span className="text-xs text-muted-foreground">{item.hint}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function NewAppointmentDialog({ open, onOpenChange, presetDoctorId, presetType }: { open: boolean; onOpenChange: (v: boolean) => void; presetDoctorId?: string; presetType?: Appointment["type"] }) {
  const { toast } = useToast();
  const addAppointment = useAppStore((s) => s.addAppointment);
  const { doctors, patients, branch } = useBranchData();
  const [form, setForm] = useState(() => ({
    patientId: "",
    doctorId: presetDoctorId ?? "",
    department: "",
    date: new Date().toISOString().split("T")[0],
    time: "",
    type: (presetType ?? "Walk-in") as Appointment["type"],
    reason: "",
  }));
  const [saving, setSaving] = useState(false);

  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  // Only doctors scheduled for the selected date are offered. The preset
  // doctor always stays visible (marked off-schedule) so it can't be lost.
  const availableDoctors = useMemo(
    () => {
      const list = doctors.filter((d) => isDoctorAvailableOn(d, form.date, { schedules: doctorSchedules, branch }));
      if (presetDoctorId && !list.some((d) => d.id === presetDoctorId)) {
        const preset = doctors.find((d) => d.id === presetDoctorId);
        if (preset) return [preset, ...list];
      }
      return list;
    },
    [doctors, form.date, doctorSchedules, branch, presetDoctorId]
  );
  const handleDateChange = (value: string) => {
    setForm((f) => {
      const current = doctors.find((d) => d.id === f.doctorId);
      const stillOk = !current || isDoctorAvailableOn(current, value, { schedules: doctorSchedules, branch });
      return { ...f, date: value, doctorId: stillOk ? f.doctorId : "", department: stillOk ? f.department : "" };
    });
  };
  const handleDoctorSelect = (doctorId: string) => {
    const doc = doctors.find((d) => d.id === doctorId);
    setForm({ ...form, doctorId, department: doc?.department || form.department });
  };

  const handleSubmit = async () => {
    if (!form.patientId || !form.date || !form.time) {
      toast({ title: "Error", description: "Patient, Date, and Time are required", variant: "destructive" });
      return;
    }
    if (!form.doctorId) {
      toast({ title: "Error", description: "Please select a doctor", variant: "destructive" });
      return;
    }
    const patient = patients.find((p) => p.id === form.patientId);
    let doctor = doctors.find((d) => d.id === form.doctorId);
    setSaving(true);
    try {
      // Doctors derived from staff records don't exist in the doctors table.
      // Materialize a real row first so the foreign key is satisfied.
      let doctorId = form.doctorId;
      if (doctorId.startsWith("d-staff-") && doctor) {
        const res = await fetch("/api/doctors/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: doctor.email,
            name: doctor.name,
            phone: doctor.phone,
            branch,
            department: doctor.department,
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to resolve the selected doctor.");
        }
        const realDoctor = await res.json();
        doctorId = realDoctor.id;
        doctor = { ...doctor, id: realDoctor.id };
      }
    const newAppointment = {
      id: `a${Date.now()}`,
      // Token is assigned server-side (sequential per branch per day).
      token: "",
      patientId: form.patientId,
        patientName: patient?.name || "Unknown",
        patientPhoto: patient?.photo || "??",
        doctorId,
        doctorName: doctor?.name || "",
        department: form.department || doctor?.department || "",
        date: form.date,
        time: form.time,
        type: form.type,
        status: "Scheduled" as const,
        reason: form.reason,
        waitingTime: 0,
        branch,
      };
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAppointment),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create the appointment.");
      }
      const saved = await res.json();
      setSaving(false);
      addAppointment(saved);
      toast({ title: "Success", description: `Appointment created for ${patient?.name || "patient"}` });
      setForm({ patientId: "", doctorId: "", department: "", date: "", time: "", type: "Walk-in", reason: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create appointment", description: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Appointment</DialogTitle><DialogDescription>Schedule a new patient appointment</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>Patient *</Label>
          <SearchSelect
            value={form.patientId}
            onSelect={(v) => setForm({ ...form, patientId: v })}
            placeholder="Search patient..."
            searchPlaceholder="Type a patient name..."
            emptyText="No patients found."
            items={patients.map((p) => ({ value: p.id, label: p.name, hint: p.uhid }))}
          />
        </div>
        <div className="space-y-2">
          <Label>Doctor *{form.date ? ` — available on ${form.date}` : ""}</Label>
          <SearchSelect
            value={form.doctorId}
            onSelect={handleDoctorSelect}
            placeholder="Search doctor..."
            searchPlaceholder="Type a doctor name..."
            emptyText={form.date ? "No doctors available on this date." : "Pick a date first, then search doctors."}
            items={availableDoctors.map((d) => ({ value: d.id, label: d.name, hint: d.specialization }))}
          />
          {selectedDoctor && !availableDoctors.some((d) => d.id === selectedDoctor.id) && (
            <p className="text-[11px] text-destructive">{selectedDoctor.name} is not scheduled on {form.date}. Pick another doctor or change the date.</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Auto-filled from doctor" /></div>
          <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Appointment["type"] })}><SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{["Walk-in", "Online", "Emergency", "Referral"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Date *</Label><Input value={form.date} onChange={(e) => handleDateChange(e.target.value)} type="date" /></div>
          <div className="space-y-2"><Label>Time *</Label><Input value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} type="time" /></div>
        </div>
        <div className="space-y-2"><Label>Reason</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason for visit" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Booking..." : "Book Appointment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateStatusDialog({ open, onOpenChange, appointment }: { open: boolean; onOpenChange: (v: boolean) => void; appointment: Appointment | null }) {
  const { toast } = useToast();
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const currentUser = useAppStore((s) => s.currentUser);
  const [status, setStatus] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [reason, setReason] = useState("");
  const [problems, setProblems] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const prevId = useState<string | null>(null);
  const canWriteNotes = isAdmin(currentUser.role) || isDoctorLikeRole(currentUser.role);

  if (appointment && appointment.id !== prevId[0]) {
    prevId[1](appointment.id);
    setStatus(appointment.status);
    setDate(appointment.date || "");
    setTime(appointment.time || "");
    setReason(appointment.reason || "");
    setProblems(appointment.problems || "");
    setClinicalNotes(appointment.clinicalNotes || "");
  }

  const handleSubmit = async () => {
    if (!appointment || !status) return;
    if (!date || !time) {
      toast({ title: "Missing fields", description: "Date and time are required.", variant: "destructive" });
      return;
    }
    const rescheduled = date !== appointment.date || time !== appointment.time;
    setSaving(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, status, date, time, reason, problems, clinicalNotes, ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update the appointment.");
      }
      const saved = await res.json();
      updateAppointment(appointment.id, saved);
      setSaving(false);
      toast({
        title: rescheduled ? "Appointment Rescheduled" : "Visit Updated",
        description: rescheduled
          ? `${appointment.token} — ${appointment.patientName} moved to ${date} at ${time}.`
          : `Appointment ${appointment.token} updated to ${status}, notes saved.`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update appointment", description: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Update Visit</DialogTitle>
          <DialogDescription>{appointment?.token} — {appointment?.patientName} with {appointment?.doctorName}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>New Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Scheduled", "Checked-in", "In Consultation", "Completed", "Cancelled", "No-show", "Follow Up"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          {appointment && (date !== appointment.date || time !== appointment.time) && (
            <p className="text-[11px] text-primary">Rescheduling to {date} at {time} — the appointment will move in the list and calendar.</p>
          )}
          {canWriteNotes ? (
            <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">Doctor&apos;s clinical notes</p>
              <div className="space-y-2"><Label>Diagnosis / Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Diagnosis" /></div>
              <div className="space-y-2"><Label>Health Problems</Label><Textarea rows={2} value={problems} onChange={(e) => setProblems(e.target.value)} placeholder="Identified health problems" /></div>
              <div className="space-y-2"><Label>Clinical Notes & Observations</Label><Textarea rows={3} value={clinicalNotes} onChange={(e) => setClinicalNotes(e.target.value)} placeholder="Examination findings, observations, advice…" /></div>
            </div>
          ) : (
            (appointment?.clinicalNotes || appointment?.problems) && (
              <div className="rounded-lg border p-3 text-xs space-y-1">
                {appointment?.problems && <p><span className="font-semibold">Problems: </span>{appointment.problems}</p>}
                {appointment?.clinicalNotes && <p className="whitespace-pre-wrap"><span className="font-semibold">Notes: </span>{appointment.clinicalNotes}</p>}
              </div>
            )
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Updating..." : "Save Visit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface OrderRow { kind: "Lab" | "Radiology"; name: string; category: string; price: string; }

function OrderTestDialog({ open, onOpenChange, appointment }: { open: boolean; onOpenChange: (v: boolean) => void; appointment: Appointment | null }) {
  const { toast } = useToast();
  const addLabTest = useAppStore((s) => s.addLabTest);
  const updateLabTest = useAppStore((s) => s.updateLabTest);
  const addRadiologyOrder = useAppStore((s) => s.addRadiologyOrder);
  const updateRadiologyOrder = useAppStore((s) => s.updateRadiologyOrder);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);
  const [rows, setRows] = useState<OrderRow[]>([{ kind: "Lab", name: "", category: "", price: "" }]);
  const [saving, setSaving] = useState(false);
  const prevId = useState<string | null>(null);
  const labPrices = parseServicePrices(settings).filter((item) => item.module === "Laboratory");
  const radPrices = parseServicePrices(settings).filter((item) => item.module === "Radiology");

  if (appointment && appointment.id !== prevId[0]) {
    prevId[1](appointment.id);
    setRows([{ kind: "Lab", name: "", category: "", price: "" }]);
  }
  if (!appointment) return null;

  const setRow = (idx: number, patch: Partial<OrderRow>) =>
    setRows((list) => list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const applyKind = (idx: number, kind: OrderRow["kind"]) =>
    setRows((list) => list.map((r, i) => (i === idx ? { kind, name: "", category: "", price: "" } : r)));

  const applyName = (idx: number, name: string) => {
    const kind = rows[idx]?.kind ?? "Lab";
    const svc = findServicePrice(kind === "Lab" ? labPrices : radPrices, kind === "Lab" ? "Laboratory" : "Radiology", name);
    setRow(idx, { name, category: svc?.category ?? rows[idx]?.category ?? "", price: svc ? String(svc.price) : "" });
  };

  const rowTotal = (r: OrderRow) => Math.max(0, parseFloat(r.price) || 0);
  const grandTotal = rows.reduce((s, r) => s + (r.name.trim() ? rowTotal(r) : 0), 0);
  const validRows = rows.filter((r) => r.name.trim());

  const handleSubmit = async () => {
    if (validRows.length === 0) { toast({ title: "No tests", description: "Add at least one lab or radiology test.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const items: { description: string; category: string; quantity: number; rate: number; amount: number }[] = [];
      let labCount = 0;
      let radCount = 0;
      for (let n = 0; n < validRows.length; n++) {
        const r = validRows[n];
        const amount = rowTotal(r);
        if (r.kind === "Lab") {
          const orderId = `LT-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
          const localId = `lt${Date.now()}${n}`;
          const optimistic: LabTest = {
            id: localId, orderId, patientName: appointment.patientName, patientId: appointment.patientId,
            test: r.name.trim(), category: r.category.trim() || "Blood", orderedBy: appointment.doctorName,
            orderedOn: today, status: "Ordered", reportReady: false, price: amount, branch: appointment.branch,
          };
          addLabTest(optimistic);
          try {
            const testRes = await fetch("/api/lab-tests", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...optimistic }),
            });
            if (testRes.ok) updateLabTest(localId, await testRes.json());
            else throw new Error((await testRes.json().catch(() => ({}))).error || "Lab order sync failed.");
          } catch (e: any) {
            toast({ title: "Lab order not saved to database", description: `${e.message} The row is kept locally only — please retry.`, variant: "destructive" });
          }
          labCount++;
          items.push({ description: r.name.trim(), category: "Lab", quantity: 1, rate: amount, amount });
        } else {
          const orderId = `RO-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`;
          const localId = `ro${Date.now()}${n}`;
          const optimistic: RadiologyOrder = {
            id: localId, orderId, patientName: appointment.patientName, patientId: appointment.patientId,
            modality: r.category.trim() || "X-Ray", region: r.name.trim(), orderedBy: appointment.doctorName,
            orderedOn: today, status: "Ordered", price: amount, branch: appointment.branch,
          };
          addRadiologyOrder(optimistic);
          try {
            const radRes = await fetch("/api/radiology-orders", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...optimistic }),
            });
            if (radRes.ok) updateRadiologyOrder(localId, await radRes.json());
            else throw new Error((await radRes.json().catch(() => ({}))).error || "Radiology order sync failed.");
          } catch (e: any) {
            toast({ title: "Radiology order not saved to database", description: `${e.message} The row is kept locally only — please retry.`, variant: "destructive" });
          }
          radCount++;
          items.push({ description: `${optimistic.modality} - ${optimistic.region}`, category: "Radiology", quantity: 1, rate: amount, amount });
        }
      }
      let invoiceNo = "";
      if (grandTotal > 0) {
        const invRes = await fetch("/api/invoices", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `inv${Date.now()}`, patientId: appointment.patientId, patientName: appointment.patientName,
            date: today, dueDate: today, items,
            subtotal: grandTotal, tax: 0, discount: 0, total: grandTotal,
            paidAmount: 0, status: "Pending", branch: appointment.branch,
          }),
        });
        if (invRes.ok) {
          const savedInv = await invRes.json();
          addInvoice(savedInv);
          invoiceNo = savedInv.invoiceNo;
        }
      }
      const parts: string[] = [];
      if (labCount > 0) parts.push(`${labCount} lab test${labCount === 1 ? "" : "s"}`);
      if (radCount > 0) parts.push(`${radCount} radiology ${radCount === 1 ? "study" : "studies"}`);
      toast({ title: "Tests Ordered", description: `${parts.join(" + ")} for ${appointment.patientName} — visible in Laboratory/Radiology now${invoiceNo ? `, pending bill ${invoiceNo} (₹${grandTotal.toLocaleString("en-IN")})` : ""}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not order tests", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Tests</DialogTitle>
          <DialogDescription>
            Multiple lab + radiology requests at once for {appointment.patientName} (ordered by {appointment.doctorName}).
            Pick from the admin rate list — prices auto-fill and combine into one pending bill.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs grid grid-cols-3 gap-2">
            <div><p className="text-muted-foreground">Tests</p><p className="text-base font-bold">{validRows.length}</p></div>
            <div><p className="text-muted-foreground">Lab / Radiology</p><p className="text-base font-bold">{validRows.filter((r) => r.kind === "Lab").length} / {validRows.filter((r) => r.kind === "Radiology").length}</p></div>
            <div><p className="text-muted-foreground">Bill total</p><p className="text-base font-bold text-primary">₹{grandTotal.toLocaleString("en-IN")}</p></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Test Requests</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRows((l) => [...l, { kind: "Lab", name: "", category: "", price: "" }])}>+ Add Test</Button>
            </div>
            {rows.map((r, i) => {
              const names = (r.kind === "Lab" ? labPrices : radPrices).map((s) => s.name);
              return (
                <div key={i} className="rounded-lg border p-2 space-y-1.5">
                  <div className="grid grid-cols-[110px_1fr_32px] gap-1.5 items-center">
                    <Select value={r.kind} onValueChange={(v) => applyKind(i, v as OrderRow["kind"])}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Lab">Lab Test</SelectItem><SelectItem value="Radiology">Radiology</SelectItem></SelectContent>
                    </Select>
                    <Input className="h-8 text-xs" placeholder={r.kind === "Lab" ? "Search/add lab test" : "Region / body part (e.g. Knee)"} list={`order-names-${i}`} value={r.name} onChange={(e) => applyName(i, e.target.value)} />
                    <datalist id={`order-names-${i}`}>{names.map((n) => <option key={n} value={n} />)}</datalist>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} title="Remove"><XCircle className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Input className="h-8 text-xs" placeholder={r.kind === "Lab" ? "Category (auto)" : "Modality — e.g. X-Ray (auto)"} value={r.category} onChange={(e) => setRow(i, { category: e.target.value })} />
                    <Input className="h-8 text-xs" type="number" min={0} placeholder="Price ₹ (auto)" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} />
                  </div>
                  {r.name.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      {rowTotal(r) > 0
                        ? `${r.kind === "Lab" ? r.name.trim() : `${r.category.trim() || "X-Ray"} — ${r.name.trim()}`} • ₹${rowTotal(r).toLocaleString("en-IN")} — appears in ${r.kind === "Lab" ? "Laboratory" : "Radiology"} instantly`
                        : "No admin price for this entry — amount can be set later in the lab/radiology module."}
                    </p>
                  )}
                </div>
              );
            })}
            {labPrices.length === 0 && radPrices.length === 0 && (
              <p className="text-[11px] text-warning">No admin rate lists yet — add Clinical Service Prices in Settings so tests auto-price.</p>
            )}
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Ordering…" : `Order ${validRows.length} Test${validRows.length === 1 ? "" : "s"}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RxRow { name: string; dosage: string; frequency: string; duration: string; qty: string; unit: "Tablet" | "Sheet"; }

function PrescribeDialog({ open, onOpenChange, appointment }: { open: boolean; onOpenChange: (v: boolean) => void; appointment: Appointment | null }) {
  const { toast } = useToast();
  const branchData = useBranchData();
  const [diagnosis, setDiagnosis] = useState("");
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<RxRow[]>([{ name: "", dosage: "", frequency: "1-0-1", duration: "5 days", qty: "10", unit: "Tablet" }]);
  const [saving, setSaving] = useState(false);
  const prevId = useState<string | null>(null);

  if (appointment && appointment.id !== prevId[0]) {
    prevId[1](appointment.id);
    setDiagnosis(appointment.reason || "");
    setNotes("");
    setRows([{ name: "", dosage: "", frequency: "1-0-1", duration: "5 days", qty: "10", unit: "Tablet" }]);
  }
  if (!appointment) return null;

  const medOptions = branchData.medicines.map((m) => m.name);
  const validRows = rows.filter((r) => r.name.trim());

  const handleSubmit = async () => {
    if (validRows.length === 0) { toast({ title: "No medicines", description: "Add at least one tablet.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/prescriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `rx${Date.now()}`,
          patientId: appointment.patientId,
          patientName: appointment.patientName,
          appointmentId: appointment.id,
          doctorName: appointment.doctorName,
          diagnosis: diagnosis.trim(),
          notes: notes.trim(),
          status: "Issued",
          date: new Date().toISOString().split("T")[0],
          branch: appointment.branch,
          items: validRows.map((r) => ({
            medicineName: r.name.trim(), dosage: r.dosage.trim(), frequency: r.frequency.trim(),
            duration: r.duration.trim(), quantity: Math.max(0, Math.round(parseFloat(r.qty) || 0)), unit: r.unit,
          })),
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to issue prescription."); }
      toast({ title: "Prescription Issued", description: `${validRows.length} tablet(s) prescribed to ${appointment.patientName} — visible in Pharmacy and the patient portal.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not prescribe", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Digital Prescription</DialogTitle>
          <DialogDescription>Prescribe tablets for {appointment.patientName} — goes to Pharmacy fulfillment and the patient portal.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Diagnosis</Label><Input value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="Diagnosis" /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Advice, precautions…" /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Tablets</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRows((l) => [...l, { name: "", dosage: "", frequency: "1-0-1", duration: "5 days", qty: "10", unit: "Tablet" }])}>+ Add Tablet</Button>
            </div>
            {rows.map((r, i) => (
              <div key={i} className="rounded-lg border p-2 space-y-1.5">
                <div className="grid grid-cols-[1fr_70px_70px_32px] gap-1.5 items-center">
                  <Input className="h-8 text-xs" placeholder="Tablet name" list={`rx-meds-${i}`} value={r.name} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <datalist id={`rx-meds-${i}`}>{medOptions.map((m) => <option key={m} value={m} />)}</datalist>
                  <Input className="h-8 text-xs" placeholder="Qty" type="number" min={0} value={r.qty} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                  <Select value={r.unit} onValueChange={(v) => setRows((l) => l.map((x, j) => (j === i ? { ...x, unit: v as RxRow["unit"] } : x)))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Tablet">Tabs</SelectItem><SelectItem value="Sheet">Sheets</SelectItem></SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRows((l) => l.filter((_, j) => j !== i))}><XCircle className="h-3.5 w-3.5" /></Button>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  <Input className="h-8 text-xs" placeholder="Dosage (500mg)" value={r.dosage} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, dosage: e.target.value } : x)))} />
                  <Input className="h-8 text-xs" placeholder="Frequency (1-0-1)" value={r.frequency} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, frequency: e.target.value } : x)))} />
                  <Input className="h-8 text-xs" placeholder="Duration (5 days)" value={r.duration} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, duration: e.target.value } : x)))} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Issuing…" : "Issue Prescription"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentTable({ appointments, invoices, onUpdateStatus, onOrderTest, onPrescribe, onCollect, onCancelVisit, onDeleteVisit, canDoctorTools, canCollect }: {
  appointments: Appointment[];
  invoices: Invoice[];
  onUpdateStatus: (apt: Appointment) => void;
  onOrderTest: (apt: Appointment) => void;
  onPrescribe: (apt: Appointment) => void;
  onCollect: (inv: Invoice) => void;
  onCancelVisit: (apt: Appointment) => void;
  onDeleteVisit: (apt: Appointment) => void;
  canDoctorTools: boolean;
  canCollect: boolean;
}) {
  const currentUser = useAppStore((s) => s.currentUser);
  // Cancel/delete is restricted: Admin + Receptionist on any visit, doctors
  // only on visits where they are the assigned doctor.
  const canManage = (apt: Appointment) => canManageAppointment(currentUser.role, currentUser.name, apt);
  // Payment status per visit: the bill raised for this patient on this date
  // (OPD fee at booking/acceptance). Updates automatically after collection.
  const billFor = (patientId: string, date: string): Invoice | undefined =>
    invoices.find((i) => i.patientId === patientId && i.date === date);
  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[60px]">Token</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead className="hidden md:table-cell">Doctor</TableHead>
            <TableHead className="hidden lg:table-cell">Department</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead className="hidden md:table-cell">Type</TableHead>
            <TableHead className="hidden lg:table-cell">Wait</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Bill</TableHead>
            <TableHead className={canDoctorTools ? "w-[170px]" : "w-[80px]"}>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {appointments.map((apt) => (
            <TableRow key={apt.id} className="hover:bg-muted/40 cursor-pointer">
              <TableCell>
                <Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{apt.token}</Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{apt.patientPhoto}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{apt.patientName}</p>
                    <p className="text-xs text-muted-foreground hidden sm:block">{apt.reason}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell text-sm">{apt.doctorName}</TableCell>
              <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{apt.department}</TableCell>
              <TableCell className="text-sm">{apt.date}</TableCell>
              <TableCell className="text-sm font-medium">{apt.time}</TableCell>
              <TableCell className="hidden md:table-cell">
                <Badge variant="outline" className={`text-[10px] ${typeColors[apt.type]}`}>{apt.type}</Badge>
              </TableCell>
              <TableCell className="hidden lg:table-cell text-xs">
                {apt.waitingTime > 0 ? `${apt.waitingTime} min` : "\u2014"}
              </TableCell>
              <TableCell><StatusBadge status={apt.status} /></TableCell>
              <TableCell>
                {(() => {
                  const inv = billFor(apt.patientId, apt.date);
                  if (!inv) return <span className="text-[11px] text-muted-foreground">—</span>;
                  const due = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                  return (
                    <div className="flex items-center gap-1">
                      <Badge variant="outline" className={`text-[10px] ${due <= 0 ? "border-success/40 text-success" : "border-warning/50 text-warning"}`}>
                        {due <= 0 ? `Paid ₹${(inv.paidAmount || 0).toLocaleString("en-IN")}` : `Due ₹${due.toLocaleString("en-IN")}`}
                      </Badge>
                      {due > 0 && canCollect && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-success" onClick={() => onCollect(inv)} title={`Collect ₹${due.toLocaleString("en-IN")} (${inv.invoiceNo})`}>
                          <IndianRupee className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onUpdateStatus(apt)}>
                    Update
                  </Button>
                  {canDoctorTools && (
                    <>
                      <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] text-info" onClick={() => onOrderTest(apt)} title="Order lab test">
                        Test
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] text-success" onClick={() => onPrescribe(apt)} title="Issue prescription">
                        Rx
                      </Button>
                    </>
                  )}
                  {canManage(apt) && ["Scheduled", "Follow Up", "Checked-in"].includes(apt.status) && (
                    <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] text-warning" onClick={() => onCancelVisit(apt)} title="Cancel this visit (stays in history as Cancelled)">
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {canManage(apt) && (
                    <Button size="sm" variant="ghost" className="h-7 px-1.5 text-[10px] text-destructive" onClick={() => onDeleteVisit(apt)} title="Delete this visit permanently (for duplicate bookings)">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {appointments.length === 0 && (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8 text-muted-foreground text-sm">
                No appointments in this category.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export function AppointmentsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { appointments, doctors, invoices, branch } = useBranchData();
  const addAppointment = useAppStore((s) => s.addAppointment);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const appointmentIO: EntityIOConfig<Appointment> = {
    entity: "appointments",
    filename: "appointments",
    columns: [
      { header: "patientName", sample: "Ravi Kumar" },
      { header: "patientId", sample: "" },
      { header: "doctorName", sample: "Dr. Smith" },
      { header: "doctorId", sample: "" },
      { header: "department", sample: "General Medicine" },
      { header: "date", sample: new Date().toISOString().split("T")[0] },
      { header: "time", sample: "10:00" },
      { header: "type", sample: "Walk-in" },
      { header: "status", sample: "Scheduled" },
      { header: "reason", sample: "Fever" },
      { header: "branch", sample: branch },
    ],
    toRow: (a) => [a.patientName, a.patientId, a.doctorName, a.doctorId, a.department, a.date, a.time, a.type, a.status, a.reason, a.branch],
    fromRow: (row, i) => {
      if (!row.patientName || !row.doctorName || !row.date) throw new Error("patientName, doctorName and date are required.");
      return {
        id: `a${Date.now()}${i}`,
        token: "",
        patientId: row.patientId || "",
        patientName: row.patientName,
        patientPhoto: row.patientName.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
        doctorId: row.doctorId || "",
        doctorName: row.doctorName,
        department: row.department || "",
        date: row.date,
        time: row.time || "09:00",
        type: ["Walk-in", "Online", "Emergency", "Referral"].includes(row.type) ? row.type : "Walk-in",
        status: "Scheduled",
        reason: row.reason || "",
        waitingTime: 0,
        branch: row.branch || branch,
      };
    },
    endpoint: "/api/appointments",
    onImported: (saved) => addAppointment(saved),
  };
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "calendar">("list");
  const todayStr = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [newAppointmentOpen, setNewAppointmentOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [acting, setActing] = useState(false);
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const deleteAppointment = useAppStore((s) => s.deleteAppointment);

  // Cancel keeps the row in Supabase with status Cancelled (+ who/when/why),
  // so it still shows in the appointments list and patient history.
  const confirmCancelVisit = async () => {
    if (!cancelTarget || acting) return;
    setActing(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cancelTarget.id, status: "Cancelled", cancelledBy: currentUser.name, cancelReason: cancelReason.trim(), ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to cancel.");
      updateAppointment(cancelTarget.id, body);
      useAppStore.getState().addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action: "APPOINTMENT_CANCELLED", target: cancelTarget.token, branch, details: `${currentUser.name} cancelled visit ${cancelTarget.token} (${cancelTarget.patientName} with ${cancelTarget.doctorName} on ${cancelTarget.date})${cancelReason.trim() ? `: ${cancelReason.trim()}` : ""}.` });
      toast({ title: "Visit Cancelled", description: `${cancelTarget.token} cancelled — it stays in history as Cancelled.` });
      setCancelTarget(null);
      setCancelReason("");
    } catch (e: any) {
      toast({ title: "Could not cancel visit", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };

  // Hard delete removes the row from Supabase — for duplicate bookings only.
  const confirmDeleteVisit = async () => {
    if (!deleteTarget || acting) return;
    setActing(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id, ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Failed to delete.");
      deleteAppointment(deleteTarget.id);
      useAppStore.getState().addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action: "APPOINTMENT_DELETED", target: deleteTarget.token, branch, details: `${currentUser.name} deleted visit ${deleteTarget.token} (${deleteTarget.patientName} with ${deleteTarget.doctorName} on ${deleteTarget.date} at ${deleteTarget.time}).` });
      toast({ title: "Visit Deleted", description: `${deleteTarget.token} removed permanently.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete visit", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };
  const [orderTarget, setOrderTarget] = useState<Appointment | null>(null);
  const [prescribeTarget, setPrescribeTarget] = useState<Appointment | null>(null);
  const showAdd = canAddPatient(currentUser.role);
  const canDoctorTools = isAdmin(currentUser.role) || isDoctorLikeRole(currentUser.role);

  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  const dateAppointments = useMemo(
    () => appointments.filter((a) => a.date === selectedDate).sort((x, y) => x.time.localeCompare(y.time)),
    [appointments, selectedDate]
  );
  const {
    pageItems: pagedDateAppointments, page: aptPage, setPage: setAptPage,
    pageSize: aptPageSize, setPageSize: setAptPageSize, totalPages: aptPages, total: aptTotal,
  } = usePagination(dateAppointments, selectedDate);

  const { past, present, future } = useMemo(() => categorizeAppointments(appointments), [appointments]);

  const statPast = past.length;
  const statPresent = present.length;
  const statFuture = future.length;
  const statCompleted = appointments.filter((a) => a.status === "Completed").length;
  const statCancelled = appointments.filter((a) => a.status === "Cancelled").length;

  const [queueDoctorId, setQueueDoctorId] = useState("");
  const activeQueueDoctor = queueDoctorId || doctors[0]?.id || "";

  const avgWaitTime = appointments.length > 0
    ? Math.round(appointments.reduce((s, a) => s + (a.waitingTime || 0), 0) / appointments.length)
    : 0;
  const completionRate = appointments.length > 0 ? Math.round((appointments.filter((a) => a.status === "Completed").length / appointments.length) * 100) : 0;
  const noShowRate = appointments.length > 0 ? Math.round((appointments.filter((a) => a.status === "No-show").length / appointments.length) * 100) : 0;

  const typeCounts = useMemo(() => {
    const counts = { "Walk-in": 0, Online: 0, Referral: 0, Emergency: 0 } as Record<Appointment["type"], number>;
    for (const a of appointments) counts[a.type] = (counts[a.type] || 0) + 1;
    return counts;
  }, [appointments]);

  const weeklyData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: appointments.filter((a) => a.date === iso).length,
      });
    }
    return days;
  }, [appointments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Manage patient appointments, scheduling, and queues"
        icon={CalendarClock}
        action={
          <>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button onClick={() => setView("list")} className={`rounded-md p-1.5 ${view === "list" ? "bg-background shadow-sm" : ""}`}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView("calendar")} className={`rounded-md p-1.5 ${view === "calendar" ? "bg-background shadow-sm" : ""}`}>
                <Grid3x3 className="h-4 w-4" />
              </button>
            </div>
            {showAdd && (
              <Button size="sm" className="gap-2" onClick={() => setNewAppointmentOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> New Appointment
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard title="Today" value={statPresent.toString()} icon={CalendarClock} color="primary" />
        <StatCard title="Completed" value={statCompleted.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Upcoming" value={statFuture.toString()} icon={Clock} color="info" />
        <StatCard title="Past" value={statPast.toString()} icon={CalIcon} color="warning" />
        <StatCard title="Cancelled" value={statCancelled.toString()} icon={XCircle} color="destructive" />
      </div>

      <VisitRequestsInbox />

      {view === "list" ? (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="text-base">Appointments</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftDate(-1)}>&#8249;</Button>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="h-8 w-[150px] text-xs"
                />
                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => shiftDate(1)}>&#8250;</Button>
                {selectedDate !== todayStr && (
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setSelectedDate(todayStr)}>Today</Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 pb-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pb-2">
              <p className="text-xs text-muted-foreground mr-auto">Showing all {aptTotal} appointment{aptTotal === 1 ? "" : "s"} on {selectedDate}.</p>
              {showAdd && <ImportExportButtons config={appointmentIO} items={dateAppointments} compact />}
            </div>
            <AppointmentTable appointments={pagedDateAppointments} invoices={invoices} onUpdateStatus={setStatusTarget} onOrderTest={setOrderTarget} onPrescribe={setPrescribeTarget} onCollect={setCollectInvoice} onCancelVisit={(apt) => { setCancelTarget(apt); setCancelReason(""); }} onDeleteVisit={setDeleteTarget} canDoctorTools={canDoctorTools} canCollect={canCollectPayment(currentUser.role)} />
      <OrderTestDialog open={!!orderTarget} onOpenChange={(v) => { if (!v) setOrderTarget(null); }} appointment={orderTarget} />
      <PrescribeDialog open={!!prescribeTarget} onOpenChange={(v) => { if (!v) setPrescribeTarget(null); }} appointment={prescribeTarget} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Visit Fee" />
            <div className="px-4 pt-3">
              <DataPagination page={aptPage} totalPages={aptPages} pageSize={aptPageSize} total={aptTotal} onPage={setAptPage} onPageSize={setAptPageSize} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Appointment Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => shiftDate(-1)}>&#8249;</Button>
              <span className="text-sm font-medium">{new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
              <Button variant="outline" size="sm" onClick={() => shiftDate(1)}>&#8250;</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-2">
                <div className="text-xs font-medium text-muted-foreground p-2">Time</div>
                {doctors.slice(0, 6).map((doc) => (
                  <div key={doc.id} className="text-xs font-medium text-center p-2 rounded-md bg-muted/50">
                    <p className="font-semibold truncate">{doc.name.split(" ").slice(-2).join(" ")}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doc.department}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {timeSlots.map((time) => (
                  <div key={time} className="grid grid-cols-[80px_repeat(6,1fr)] gap-1">
                    <div className="text-xs text-muted-foreground p-2 font-mono">{time}</div>
                    {doctors.slice(0, 6).map((doc) => {
                      const apt = dateAppointments.find((a) => a.doctorId === doc.id && a.time === time);
                      return (
                        <div
                          key={doc.id}
                          className={`min-h-[44px] rounded-md border p-1.5 transition-colors ${
                            apt
                              ? apt.type === "Emergency"
                                ? "bg-destructive/10 border-destructive/30"
                                : "bg-primary/5 border-primary/20"
                              : "border-dashed border-border hover:bg-muted/30 cursor-pointer"
                          }`}
                          onClick={apt ? undefined : () => setNewAppointmentOpen(true)}
                        >
                          {apt && (
                            <div className="h-full flex flex-col justify-center">
                              <p className="text-[11px] font-semibold truncate">{apt.patientName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge variant="outline" className="text-[9px] h-3.5 px-1">{apt.token}</Badge>
                                {apt.type === "Emergency" && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                                {apt.type === "Online" && <Video className="h-2.5 w-2.5 text-primary" />}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Live Queue
            </CardTitle>
            {doctors.length > 0 && (
              <Select value={activeQueueDoctor} onValueChange={setQueueDoctorId}>
                <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Select doctor" /></SelectTrigger>
                <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="px-4 pb-4 space-y-2">
                {present.filter((a) => a.doctorId === activeQueueDoctor).map((apt) => (
                  <div
                    key={apt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      apt.status === "In Consultation" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${
                      apt.status === "Completed" ? "bg-success/10 text-success" :
                      apt.status === "In Consultation" ? "bg-primary text-primary-foreground" :
                      apt.status === "Checked-in" ? "bg-warning/10 text-warning" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {apt.token.split("-")[1]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.time} &bull; {apt.reason}</p>
                    </div>
                    <StatusBadge status={apt.status} />
                    <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => setStatusTarget(apt)}>
                      Update
                    </Button>
                  </div>
                ))}
                {present.filter((a) => a.doctorId === activeQueueDoctor).length === 0 && (
                  <div className="py-12 text-center">
                    <p className="text-sm text-muted-foreground">No appointments in this doctor&apos;s queue today.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-info" /> Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Avg Wait Time</p>
                <p className="text-xl font-bold text-primary mt-1">{avgWaitTime} min</p>
              </div>
              <div className="rounded-lg bg-success/5 p-3">
                <p className="text-xs text-muted-foreground">Completion Rate</p>
                <p className="text-xl font-bold text-success mt-1">{completionRate}%</p>
              </div>
              <div className="rounded-lg bg-warning/5 p-3">
                <p className="text-xs text-muted-foreground">No-show Rate</p>
                <p className="text-xl font-bold text-warning mt-1">{noShowRate}%</p>
              </div>
              <div className="rounded-lg bg-info/5 p-3">
                <p className="text-xs text-muted-foreground">Online Appts</p>
                <p className="text-xl font-bold text-info mt-1">{typeCounts.Online}</p>
              </div>
            </div>
            <div className="pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">APPOINTMENT TYPES</p>
              <div className="space-y-2">
                {(["Walk-in", "Online", "Referral", "Emergency"] as const).map((t) => (
                  <div key={t} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${{ "Walk-in": "bg-info", Online: "bg-primary", Referral: "bg-warning", Emergency: "bg-destructive" }[t]}`} />
                    <span className="text-xs flex-1">{t}</span>
                    <span className="text-xs font-semibold">{typeCounts[t]}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalIcon className="h-4 w-4 text-primary" /> Appointments — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <Tooltip cursor={{ fill: "rgba(128,128,128,0.08)" }} />
                <Bar dataKey="count" name="Appointments" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      {newAppointmentOpen && <NewAppointmentDialog open={newAppointmentOpen} onOpenChange={(v) => { if (!v) setNewAppointmentOpen(false); }} />}
      <UpdateStatusDialog open={!!statusTarget} onOpenChange={(v) => { if (!v) setStatusTarget(null); }} appointment={statusTarget} />
      {cancelTarget && (
        <Dialog open={!!cancelTarget} onOpenChange={(v) => { if (!v && !acting) setCancelTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Cancel Visit</DialogTitle><DialogDescription>Cancel {cancelTarget.token} — {cancelTarget.patientName} with {cancelTarget.doctorName} on {cancelTarget.date} at {cancelTarget.time}? It stays in history as <strong>Cancelled</strong>.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2"><Label>Reason (optional)</Label><Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Patient requested, duplicate booking" /></div>
            </div>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={acting}>Keep Visit</Button></DialogClose><Button variant="destructive" onClick={confirmCancelVisit} disabled={acting}>{acting ? "Cancelling…" : "Cancel Visit"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !acting) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Visit</DialogTitle><DialogDescription>Permanently delete {deleteTarget.token} — {deleteTarget.patientName} with {deleteTarget.doctorName} on {deleteTarget.date} at {deleteTarget.time}? This removes it from Supabase and history. Use this for <strong>duplicate bookings</strong>; prefer Cancel otherwise.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={acting}>Keep</Button></DialogClose><Button variant="destructive" onClick={confirmDeleteVisit} disabled={acting}>{acting ? "Deleting…" : "Delete Permanently"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
