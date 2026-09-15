"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useBranchData } from "@/hooks/use-branch-data";
import {
  BedDouble, Activity, ClipboardList, Plus, Users, DollarSign,
  Stethoscope, FileText, ArrowRightLeft, Pill, FlaskConical,
  Receipt, AlertTriangle, CheckCircle2, Wrench, Clock,
  Pencil, Trash2, Search, LogOut,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { canAddAnything, canAddPatient, canEditModule, canDeleteModule, isAdmin, isDoctorAvailableOn, branchSetting, scheduleActor } from "@/lib/utils";
import { printInvoice } from "@/lib/invoice-print";
import { IPDBillingPanel } from "@/components/modules/ipd-billing";
import type { Bed, Patient, Doctor, Invoice } from "@/lib/types";

const wardColors = {
  "ICU": "from-destructive/20 to-destructive/5 border-destructive/20",
  "General Ward": "from-primary/20 to-primary/5 border-primary/20",
  "Private Room": "from-success/20 to-success/5 border-success/20",
  "Semi Private": "from-warning/20 to-warning/5 border-warning/20",
  "Emergency": "from-destructive/30 to-destructive/10 border-destructive/30",
  "Operation Theatre": "from-info/20 to-info/5 border-info/20",
};

const bedStatusStyles = {
  Available: "bg-success/10 text-success border-success/30 hover:bg-success/20",
  Occupied: "bg-destructive/10 text-destructive border-destructive/30",
  Maintenance: "bg-muted text-muted-foreground border-border",
  Reserved: "bg-warning/10 text-warning border-warning/30",
};

const WARDS = ["ICU", "General Ward", "Private Room", "Semi Private", "Emergency", "Operation Theatre"] as const;
const todayIso = () => new Date().toISOString().split("T")[0];

function daysAdmittedSince(admittedOn?: string): number {
  if (!admittedOn) return 1;
  const [y, m, d] = admittedOn.split("-").map(Number);
  if (!y || !m || !d) return 1;
  const admitted = new Date(y, m - 1, d);
  const now = new Date();
  const diff = Math.floor((now.getTime() - admitted.getTime()) / 86400000);
  return Math.max(1, diff + 1); // admission day counts as a billed day
}

// Per-day charge for a bed: the Admin-set ward rate (Settings, per-branch
// with global fallback) wins; the bed's own rate is the fallback.
function effectiveBedRate(bed: Pick<Bed, "ward" | "dailyRate" | "branch">, settings: Record<string, string>, branch?: string): number {
  const adminRate = parseInt(branchSetting(settings, branch ?? (bed as Bed).branch, `bedRate_${bed.ward}`) ?? "0") || 0;
  return adminRate > 0 ? adminRate : bed.dailyRate || 0;
}

function PatientPicker({ value, onChange, patients, placeholder }: {
  value: string;
  onChange: (id: string) => void;
  patients: Patient[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = patients.find((p) => p.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal h-9">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>
            {selected ? `${selected.name} (${selected.uhid})` : placeholder || "Search patient..."}
          </span>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Type name or UHID..." />
          <CommandList>
            <CommandEmpty>No patients found.</CommandEmpty>
            <CommandGroup>
              {patients.map((p) => (
                <CommandItem key={p.id} value={`${p.name} ${p.uhid}`} onSelect={() => { onChange(p.id); setOpen(false); }}>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.uhid}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ===== Beds Module =====
export function BedsModule() {
  const { beds, patients, branch } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const updateBed = useAppStore((s) => s.updateBed);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const { toast } = useToast();
  const settings = useAppStore((s) => s.settings);
  const cap = (key: string) => parseInt(branchSetting(settings, branch, key) ?? "0") || 0;
  const totalCapacity = cap("capacity_Total");
  const [admitBed, setAdmitBed] = useState<Bed | undefined>(undefined);
  const [dischargeBed, setDischargeBed] = useState<Bed | null>(null);
  const showEdit = canEditModule(currentUser.role, "beds");
  // Anyone who can manage beds (admit/discharge) can book a bed, not just Admin.
  const showAdd = canAddAnything(currentUser.role) || showEdit;

  const occupiedCount = beds.filter((b) => b.status === "Occupied").length;
  const occupancyRate = totalCapacity > 0
    ? Math.round((occupiedCount / totalCapacity) * 100)
    : beds.length > 0
    ? Math.round((occupiedCount / beds.length) * 100)
    : 0;

  const handleBedClick = (bed: Bed) => {
    if (bed.status === "Occupied" && showEdit) setDischargeBed(bed);
    else if (bed.status === "Available" && showAdd) setAdmitBed(bed);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bed Management"
        description="Real-time bed occupancy — click an available bed to admit, an occupied bed to discharge. New beds are added from IPD → New Admission."
        icon={BedDouble}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard title="Total Beds" value={beds.length.toString()} icon={BedDouble} color="primary" subtitle={totalCapacity > 0 ? `Capacity: ${totalCapacity} (Admin)` : undefined} />
        <StatCard title="Occupied" value={occupiedCount.toString()} icon={Activity} color="destructive" />
        <StatCard title="Available" value={beds.filter((b) => b.status === "Available").length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="ICU Capacity" value={cap("capacity_ICU") > 0 ? cap("capacity_ICU").toString() : "—"} icon={Activity} color="info" subtitle={`Occupied: ${beds.filter((b) => b.ward === "ICU" && b.status === "Occupied").length}`} />
        <StatCard title="Occupancy Rate" value={`${occupancyRate}%`} icon={DollarSign} color="warning" subtitle={totalCapacity > 0 ? `of ${totalCapacity} configured` : "of existing beds"} />
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">LEGEND:</span>
            {Object.entries(bedStatusStyles).map(([status, style]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded border ${style.split(" ").slice(0, 3).join(" ")}`} />
                <span>{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bed Map by Ward */}
      <div className="grid gap-4 lg:grid-cols-2">
        {WARDS.map((ward) => {
          const wardBeds = beds.filter((b) => b.ward === ward);
          const occupied = wardBeds.filter((b) => b.status === "Occupied").length;
          const wardCapacity = cap(`capacity_${ward}`);
          const rate = wardCapacity > 0
            ? Math.min(100, Math.round((occupied / wardCapacity) * 100))
            : wardBeds.length > 0
            ? Math.round((occupied / wardBeds.length) * 100)
            : 0;

          return (
            <motion.div key={ward} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`bg-gradient-to-br ${wardColors[ward as keyof typeof wardColors]}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {ward === "ICU" && <Activity className="h-4 w-4" />}
                      {ward === "Operation Theatre" && <Stethoscope className="h-4 w-4" />}
                      {ward === "Emergency" && <AlertTriangle className="h-4 w-4" />}
                      {(ward === "General Ward" || ward === "Private Room" || ward === "Semi Private") && <BedDouble className="h-4 w-4" />}
                      {ward}
                    </CardTitle>
                    <Badge variant="outline" className="bg-background/50">
                      {occupied}/{wardCapacity > 0 ? wardCapacity : wardBeds.length} {wardCapacity > 0 ? "capacity" : "beds"}
                    </Badge>
                  </div>
                  <Progress value={rate} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent>
                  {wardBeds.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">No beds added in this ward yet.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {wardBeds.map((bed) => (
                        <button
                          key={bed.id}
                          type="button"
                          onClick={() => handleBedClick(bed)}
                          className={`group relative rounded-lg border-2 p-2.5 transition-all text-left ${
                            (bed.status === "Available" && showAdd) || (bed.status === "Occupied" && showEdit)
                              ? `cursor-pointer hover:scale-105 ${bedStatusStyles[bed.status]}`
                              : `cursor-default ${bedStatusStyles[bed.status]}`
                          }`}
                          title={
                            bed.status === "Occupied"
                              ? `${bed.patientName} • ${daysAdmittedSince(bed.admittedOn)}d • ₹${bed.dailyRate}/day — click to discharge`
                              : bed.status === "Available"
                              ? "Click to admit a patient"
                              : bed.status
                          }
                        >
                          <div className="flex items-center justify-between mb-1">
                            <BedDouble className="h-3.5 w-3.5" />
                            {bed.status === "Maintenance" && <Wrench className="h-3 w-3" />}
                            {bed.status === "Reserved" && <Clock className="h-3 w-3" />}
                          </div>
                          <p className="text-[11px] font-bold">{bed.number}</p>
                          <p className="text-[9px] mt-0.5 opacity-80">
                            {bed.status === "Occupied" ? `${bed.patientName?.split(" ")[0]} • ${daysAdmittedSince(bed.admittedOn)}d` : bed.status}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  {wardBeds.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Daily Rate{cap(`bedRate_${ward}`) > 0 ? " (Admin)" : ""}</span>
                      <span className="font-semibold">₹{effectiveBedRate(wardBeds[0], settings).toLocaleString("en-IN")}/day</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {admitBed && (
        <NewAdmissionDialog
          key={admitBed.id}
          open
          onOpenChange={(v) => { if (!v) setAdmitBed(undefined); }}
          preselectedBed={admitBed}
        />
      )}
      {dischargeBed && (
        <DischargeDialog
          key={dischargeBed.id}
          open
          onOpenChange={(v) => { if (!v) setDischargeBed(null); }}
          bed={dischargeBed}
          onDischarged={(savedInvoice) => {
            updateBed(dischargeBed.id, {
              status: "Available", patientId: "", patientName: "", admittedOn: "",
              doctorName: "", diagnosis: "", department: "",
            });
            if (dischargeBed.patientId) {
              updatePatient(dischargeBed.patientId, { status: "Discharged" });
            }
            toast({
              title: "Patient discharged",
              description: `Invoice ${savedInvoice.invoiceNo} generated for ₹${(savedInvoice.total ?? 0).toLocaleString("en-IN")}.`,
            });
            setDischargeBed(null);
          }}
        />
      )}
    </div>
  );
}

// ===== Admission (IPD) =====
function NewAdmissionDialog({ open, onOpenChange, preselectedBed }: { open: boolean; onOpenChange: (v: boolean) => void; preselectedBed?: Bed }) {
  const { toast } = useToast();
  const updateBed = useAppStore((s) => s.updateBed);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const addBed = useAppStore((s) => s.addBed);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const { beds, patients, doctors } = useBranchData();
  const availableBeds = beds.filter((b) => b.status === "Available");
  const admittablePatients = patients.filter((p) => p.status !== "Admitted" && p.status !== "Discharged");
  const [form, setForm] = useState(() => ({
    patientId: "",
    doctorName: "",
    department: "",
    bedId: preselectedBed?.id ?? "",
    diagnosis: "",
    admissionDate: todayIso(),
    expectedLeave: "",
    payMode: "Cash",
  }));
  const [wardFilter, setWardFilter] = useState(preselectedBed?.ward ?? "");
  const [showAddBed, setShowAddBed] = useState(false);
  const [newBed, setNewBed] = useState<{ number: string; ward: string; type: string; dailyRate: string }>(() => ({
    number: `B-${String(beds.length + 1).padStart(3, "0")}`,
    ward: preselectedBed?.ward ?? "General Ward",
    type: "General",
    dailyRate: "",
  }));
  const [saving, setSaving] = useState(false);
  const [addingBed, setAddingBed] = useState(false);

  const wardBedOptions = availableBeds.filter((b) => !wardFilter || b.ward === wardFilter);
  const selectedBed = beds.find((b) => b.id === form.bedId);
  const selectedPatient = patients.find((p) => p.id === form.patientId);
  const selectedDoctor = doctors.find((d) => d.name === form.doctorName);
  const settings = useAppStore((s) => s.settings);
  const selectedBedRate = selectedBed ? effectiveBedRate(selectedBed, settings) : 0;
  const adminRateApplies = !!selectedBed && (parseInt(branchSetting(settings, selectedBed.branch, `bedRate_${selectedBed.ward}`) ?? "0") || 0) > 0;

  const handleDoctorChange = (name: string) => {
    const doc = doctors.find((d) => d.name === name);
    setForm((f) => ({ ...f, doctorName: name, department: doc?.department || f.department }));
  };

  const handleCreateBed = async () => {
    if (!newBed.number.trim()) { toast({ title: "Error", description: "Bed number is required", variant: "destructive" }); return; }
    setAddingBed(true);
    try {
      const res = await fetch("/api/beds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `bed${Date.now()}`,
          number: newBed.number.trim(),
          ward: newBed.ward,
          type: newBed.type,
          dailyRate: parseFloat(newBed.dailyRate) || 0,
          status: "Available",
          branch: activeBranch,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add the bed.");
      }
      const saved = await res.json();
      addBed(saved);
      setForm((f) => ({ ...f, bedId: saved.id }));
      setWardFilter(saved.ward);
      setShowAddBed(false);
      toast({ title: "Bed added", description: `${saved.number} (${saved.ward}) is ready for admission.` });
    } catch (e: any) {
      toast({ title: "Could not add bed", description: e.message, variant: "destructive" });
    }
    setAddingBed(false);
  };

  const handleSubmit = async () => {
    if (!form.patientId) { toast({ title: "Error", description: "Select a patient", variant: "destructive" }); return; }
    if (!form.bedId) { toast({ title: "Error", description: "Select an available bed", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const bedRes = await fetch("/api/beds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.bedId,
          status: "Occupied",
          patientId: form.patientId,
          patientName: selectedPatient?.name ?? "",
          admittedOn: form.admissionDate || todayIso(),
          doctorName: form.doctorName,
          department: form.department || selectedDoctor?.department || "",
          diagnosis: form.diagnosis,
        }),
      });
      if (!bedRes.ok) {
        const body = await bedRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to assign the bed.");
      }
      const savedBed = await bedRes.json();
      updateBed(form.bedId, savedBed);
      if (form.patientId) {
        const patRes = await fetch("/api/patients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: form.patientId, status: "Admitted" }),
        });
        if (patRes.ok) updatePatient(form.patientId, { status: "Admitted" });
      }
      // Mirror into the admissions ledger (031): one billing account per admission.
      // Best-effort — bed assignment above is the source of truth for the map.
      try {
        const currentUserName = useAppStore.getState().currentUser?.name ?? "";
        const activeBranch = useAppStore.getState().activeBranch;
        await fetch("/api/admissions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId: form.patientId,
            patientName: selectedPatient?.name ?? "",
            uhid: selectedPatient?.uhid ?? "",
            doctorName: form.doctorName,
            department: form.department || selectedDoctor?.department || "",
            bedId: savedBed.id,
            bedNumber: savedBed.number,
            room: (savedBed as Bed).type ?? "",
            ward: savedBed.ward,
            bedRate: savedBed.dailyRate ?? 0,
            admissionAt: form.admissionDate ? new Date(`${form.admissionDate}T00:00:00`).toISOString() : undefined,
            expectedDischargeDate: form.expectedLeave || undefined,
            payMode: form.payMode as "Cash" | "Insurance" | "Corporate" | "TPA" | "Government Scheme",
            notes: form.diagnosis,
            branch: activeBranch,
            createdBy: currentUserName,
          }),
        });
      } catch { /* ledger mirror is best-effort */ }
      toast({ title: "Admitted", description: `${selectedPatient?.name} admitted to bed ${savedBed.number} (${savedBed.ward})${savedBed.department ? ` • ${savedBed.department}` : ""}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not admit patient", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Admission</DialogTitle><DialogDescription>Link the patient, doctor, department, and an available bed</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label>Patient *</Label>
          <PatientPicker value={form.patientId} onChange={(id) => setForm({ ...form, patientId: id })} patients={admittablePatients} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Doctor</Label>
            <Select value={form.doctorName} onValueChange={handleDoctorChange}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select doctor" /></SelectTrigger>
              <SelectContent>{doctors.map((d: Doctor) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Input
              className="h-9"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder={selectedDoctor ? `Auto: ${selectedDoctor.department}` : "Auto-filled from doctor"}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Ward</Label>
          <Select value={wardFilter} onValueChange={setWardFilter}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All wards" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all-wards">All wards</SelectItem>
              {WARDS.map((w) => <SelectItem key={w} value={w}>{w} — {availableBeds.filter((b) => b.ward === w).length} free</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Bed * <span className="text-[11px] font-normal text-muted-foreground">({wardBedOptions.length} free{wardFilter && wardFilter !== "all-wards" ? ` in ${wardFilter}` : ""})</span></Label>
          <Select value={form.bedId} onValueChange={(v) => setForm({ ...form, bedId: v })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select bed" /></SelectTrigger>
            <SelectContent>
              {wardBedOptions.map((b: Bed) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.number} — {b.ward}{b.type ? ` • ${b.type}` : ""} • ₹{(settings && effectiveBedRate(b, settings) || b.dailyRate).toLocaleString("en-IN")}/day
                </SelectItem>
              ))}
              {wardBedOptions.length === 0 && (
                <div className="px-3 py-2 text-xs text-muted-foreground">No free beds in this ward — add one below.</div>
              )}
            </SelectContent>
          </Select>
        </div>
        {!showAddBed ? (
          <button type="button" onClick={() => setShowAddBed(true)} className="text-[11px] text-primary hover:underline text-left">
            + Add a new bed (not listed?)
          </button>
        ) : (
          <div className="space-y-3 rounded-lg border border-info/20 bg-info/5 p-3">
            <p className="text-xs font-semibold">Add new bed</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-[11px]">Number *</Label><Input className="h-8" value={newBed.number} onChange={(e) => setNewBed({ ...newBed, number: e.target.value })} /></div>
              <div className="space-y-1"><Label className="text-[11px]">Ward</Label><Select value={newBed.ward} onValueChange={(v) => setNewBed({ ...newBed, ward: v })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{WARDS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[11px]">Type</Label><Select value={newBed.type} onValueChange={(v) => setNewBed({ ...newBed, type: v })}><SelectTrigger className="h-8"><SelectValue /></SelectTrigger><SelectContent>{["General", "Private", "Semi-Private", "ICU", "Emergency", "Operation Theatre", "Day Care"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-1"><Label className="text-[11px]">Daily rate (₹, 0 = Admin rate)</Label><Input className="h-8" type="number" value={newBed.dailyRate} onChange={(e) => setNewBed({ ...newBed, dailyRate: e.target.value })} /></div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setShowAddBed(false)}>Cancel</Button>
              <Button type="button" size="sm" onClick={handleCreateBed} disabled={addingBed}>{addingBed ? "Adding..." : "Create & select"}</Button>
            </div>
          </div>
        )}
        {selectedBed && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Bed</span><span className="font-medium">{selectedBed.number} • {selectedBed.ward}{selectedBed.type ? ` • ${selectedBed.type}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Daily charge</span><span className="font-medium">₹{selectedBedRate.toLocaleString("en-IN")}/day{adminRateApplies ? " (Admin rate)" : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Doctor / Dept</span><span className="font-medium">{form.doctorName || "—"}{form.department ? ` • ${form.department}` : ""}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Admission date</span><span className="font-medium">{todayIso()} (day 1 billed)</span></div>
            <p className="text-[11px] text-muted-foreground">Total is calculated automatically at discharge: days × daily charge.</p>
          </div>
        )}
        <div className="space-y-2"><Label>Diagnosis</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Primary diagnosis" /></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Joining date</Label><Input type="date" className="h-9" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></div>
          <div className="space-y-2"><Label>Expected leave</Label><Input type="date" className="h-9" value={form.expectedLeave} onChange={(e) => setForm({ ...form, expectedLeave: e.target.value })} /></div>
          <div className="space-y-2"><Label>Pay mode</Label><Select value={form.payMode} onValueChange={(v) => setForm({ ...form, payMode: v })}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{["Cash", "Insurance", "Corporate", "TPA", "Government Scheme"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <p className="text-[11px] text-muted-foreground">Bed amount accrues automatically: joining → leave × daily rate, straight into the single bill.</p>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Admitting..." : "Admit Patient"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Discharge (creates invoice in Supabase) =====
function stayDaysBetween(admittedOn: string, dischargeOn: string): number {
  const [y1, m1, d1] = admittedOn.split("-").map(Number);
  const [y2, m2, d2] = dischargeOn.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;
  const diff = Math.floor((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000);
  return Math.max(1, diff + 1); // both admission and discharge day are billed
}

function DischargeDialog({ open, onOpenChange, bed, onDischarged }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bed: Bed;
  onDischarged: (invoice: Invoice) => void;
}) {
  const { toast } = useToast();
  const settings = useAppStore((s) => s.settings);
  const patients = useAppStore((s) => s.patients);
  const [saving, setSaving] = useState(false);
  const [admittedOn, setAdmittedOn] = useState(bed.admittedOn || todayIso());
  const [dischargeOn, setDischargeOn] = useState(todayIso()); // sudden exit: today by default
  const [paidInput, setPaidInput] = useState(""); // blank = full payment
  const days = stayDaysBetween(admittedOn, dischargeOn);
  const rate = effectiveBedRate(bed, settings);
  const adminRateApplies = (parseInt(branchSetting(settings, bed.branch, `bedRate_${bed.ward}`) ?? "0") || 0) > 0;
  const total = days * rate;
  const paidAmount = paidInput === "" ? total : Math.max(0, parseFloat(paidInput) || 0);
  const invoiceStatus = paidAmount >= total ? "Paid" : paidAmount > 0 ? "Partial" : "Pending";

  const handleDischarge = async () => {
    if (dischargeOn < admittedOn) {
      toast({ title: "Invalid dates", description: "Discharge date cannot be before the admission date.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `inv${Date.now()}`,
          patientId: bed.patientId ?? "",
          patientName: bed.patientName ?? "Patient",
          date: dischargeOn,
          items: [{
            description: `IPD Stay — Bed ${bed.number} (${bed.ward}) • ${admittedOn} → ${dischargeOn}`,
            category: "IPD",
            quantity: days,
            rate,
            amount: total,
          }],
          subtotal: total,
          tax: 0,
          discount: 0,
          total,
          paidAmount,
          status: invoiceStatus,
          paymentMethod: "Cash",
          branch: bed.branch,
          paidDate: dischargeOn,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create the discharge invoice.");
      }
      const invoice = await res.json();
      const bedRes = await fetch("/api/beds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bed.id,
          status: "Available",
          patientId: "",
          patientName: "",
          admittedOn: "",
          doctorName: "",
          diagnosis: "",
          department: "",
        }),
      });
      if (!bedRes.ok) throw new Error("Invoice created, but freeing the bed failed.");
      // Close the matching admissions-ledger row (best-effort). Bed accrual is
      // automatic: discharging re-runs joining → leave × rate, so the full stay
      // lands in the single bill with no duplicate manual post.
      try {
        const admRes = await fetch(`/api/admissions?branch=${encodeURIComponent(bed.branch)}`);
        const adms = admRes.ok ? await admRes.json() : [];
        const match = Array.isArray(adms) ? adms.find((a: { patientId?: string; status?: string }) => a.patientId === bed.patientId && a.status === "Admitted") : null;
        if (match?.id) {
          await fetch("/api/admissions", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: match.id, status: "Discharged", dischargeAt: new Date(`${dischargeOn}T00:00:00`).toISOString(), billingStatus: "Discharge Pending", actorName: useAppStore.getState().currentUser?.name ?? "Staff" }),
          });
        }
      } catch { /* ledger mirror is best-effort */ }
      onDischarged(invoice);
      // Hand the printed/PDF invoice to the front desk immediately.
      if (!printInvoice(invoice, settings, patients.find((p) => p.id === (bed.patientId ?? "")))) {
        toast({ title: "Invoice ready to download", description: "Allow pop-ups for auto-print, or download it from Billing." });
      }
    } catch (e: any) {
      toast({ title: "Could not discharge", description: e.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Discharge Patient</DialogTitle><DialogDescription>Edit dates if needed — the amount calculates automatically</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground">Patient</span><span className="font-medium">{bed.patientName}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Bed</span><span className="font-medium">{bed.number} • {bed.ward}</span></div>
          {bed.diagnosis && <div className="flex justify-between"><span className="text-muted-foreground">Diagnosis</span><span className="font-medium">{bed.diagnosis}</span></div>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Admitted on (editable)</Label>
            <Input type="date" className="h-9" value={admittedOn} onChange={(e) => setAdmittedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Discharge date</Label>
            <Input type="date" className="h-9" value={dischargeOn} onChange={(e) => setDischargeOn(e.target.value)} />
          </div>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm space-y-1.5">
          <div className="flex justify-between"><span className="text-muted-foreground">Stay period</span><span className="font-medium">{days} day{days === 1 ? "" : "s"} (incl. both days)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Daily charge{adminRateApplies ? " (Admin rate)" : ""}</span><span className="font-medium">₹{rate.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total charges</span><span className="text-primary">₹{total.toLocaleString("en-IN")}</span></div>
          <p className="text-[11px] text-muted-foreground">Auto-calculated: {days} × ₹{rate.toLocaleString("en-IN")}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Amount paid by customer (₹) — leave blank for full payment</Label>
          <Input type="number" min={0} className="h-9" placeholder={`Full ₹${total.toLocaleString("en-IN")}`} value={paidInput} onChange={(e) => setPaidInput(e.target.value)} />
          <div className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Invoice status</span>
            <StatusBadge status={invoiceStatus} />
          </div>
          {paidAmount < total && (
            <p className="text-[11px] text-warning">Balance due: ₹{(total - paidAmount).toLocaleString("en-IN")} (recorded in Billing)</p>
          )}
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleDischarge} disabled={saving} className="gap-1.5"><LogOut className="h-3.5 w-3.5" />{saving ? "Discharging..." : "Discharge & Generate Invoice"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Edit Admission (dates, doctor, department, diagnosis) =====
function EditAdmissionDialog({ open, onOpenChange, bed, onSaved }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bed: Bed;
  onSaved: (updates: Partial<Bed>) => void;
}) {
  const { toast } = useToast();
  const settings = useAppStore((s) => s.settings);
  const { doctors } = useBranchData();
  const [form, setForm] = useState(() => ({
    admittedOn: bed.admittedOn || todayIso(),
    doctorName: bed.doctorName ?? "",
    department: bed.department ?? "",
    diagnosis: bed.diagnosis ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const days = stayDaysBetween(form.admittedOn, todayIso());
  const rate = effectiveBedRate(bed, settings);
  const total = days * rate;
  const invalid = !form.admittedOn || form.admittedOn > todayIso();

  const handleSubmit = async () => {
    if (invalid) {
      toast({ title: "Invalid date", description: "Admission date cannot be in the future.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/beds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: bed.id,
          admittedOn: form.admittedOn,
          doctorName: form.doctorName,
          department: form.department,
          diagnosis: form.diagnosis,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update the admission.");
      }
      const updates: Partial<Bed> = {
        admittedOn: form.admittedOn,
        doctorName: form.doctorName,
        department: form.department,
        diagnosis: form.diagnosis,
      };
      onSaved(updates);
      toast({ title: "Admission updated", description: `Now ${days} day${days === 1 ? "" : "s"} • ₹${total.toLocaleString("en-IN")}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update admission", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Edit Admission</DialogTitle><DialogDescription>Correct dates or details — charges recalculate automatically</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Admitted on *</Label>
            <Input type="date" className="h-9" value={form.admittedOn} onChange={(e) => setForm({ ...form, admittedOn: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Doctor</Label>
            <Select value={form.doctorName} onValueChange={(v) => {
              const doc = doctors.find((d) => d.name === v);
              setForm({ ...form, doctorName: v, department: doc?.department || form.department });
            }}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Select doctor" /></SelectTrigger>
              <SelectContent>{doctors.map((d: Doctor) => <SelectItem key={d.id} value={d.name}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Department</Label>
          <Input className="h-9" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Auto-filled from doctor" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Diagnosis</Label>
          <Input className="h-9" value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Primary diagnosis" />
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Stay</span><span className="font-medium">{days} day{days === 1 ? "" : "s"} ({form.admittedOn} → {todayIso()})</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Rate/Day</span><span className="font-medium">₹{rate.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between text-base font-bold"><span>Total so far</span><span className="text-primary">₹{total.toLocaleString("en-IN")}</span></div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== OPD Module =====
export function OPDModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const addAppointment = useAppStore((s) => s.addAppointment);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const { appointments, patients, doctors, invoices, branch } = useBranchData();
  const { toast } = useToast();
  const [newOPDOpen, setNewOPDOpen] = useState(false);
  const showAdd = canAddPatient(currentUser.role);
  const settings = useAppStore((s) => s.settings);
  const opdTarget = parseInt(branchSetting(settings, branch, "capacity_OPD") ?? "0") || 0;
  const showEdit = canEditModule(currentUser.role, "opd");
  const showDelete = canDeleteModule(currentUser.role, "opd");

  const todayStr = todayIso();
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const shiftDate = (delta: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + delta);
    setSelectedDate(d.toISOString().split("T")[0]);
  };
  const dateApts = useMemo(
    () => appointments.filter((a) => a.date === selectedDate).sort((a, b) => a.token.localeCompare(b.token, undefined, { numeric: true })),
    [appointments, selectedDate]
  );
  const doctorById = useMemo(() => new Map(doctors.map((d) => [d.id, d])), [doctors]);
  const feeFor = (apt: (typeof dateApts)[number]) => {
    const patient = patients.find((p) => p.id === apt.patientId);
    if (patient && (patient.opFees ?? 0) > 0) return patient.opFees!;
    return doctorById.get(apt.doctorId)?.consultationFee ?? 0;
  };
  const inConsultation = dateApts.filter((a) => a.status === "In Consultation").length;
  const waiting = dateApts.filter((a) => a.status === "Scheduled" || a.status === "Checked-in").length;
  const opdRevenue = invoices
    .filter((i) => i.date === selectedDate && (i.items ?? []).some((it) => it.category === "OPD"))
    .reduce((s, i) => s + (i.total ?? 0), 0);

  const handleStatusChange = async (aptId: string, status: string) => {
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: aptId, status, ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update status.");
      }
      updateAppointment(aptId, { status: status as never });
    } catch (e: any) {
      toast({ title: "Could not update status", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD — Outpatient Department"
        description="Live outpatient queue with real tokens, fees, and consultation status"
        icon={ClipboardList}
        action={showAdd ? <Button size="sm" className="gap-2" onClick={() => setNewOPDOpen(true)}><Plus className="h-3.5 w-3.5" /> New OPD Visit</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard title="OPD Patients" value={dateApts.length.toString()} icon={Users} color="primary" subtitle={`on ${selectedDate}${opdTarget > 0 ? ` • of ${opdTarget} target` : ""}`} />
        <StatCard title="Daily Target" value={opdTarget > 0 ? opdTarget.toString() : "—"} icon={ClipboardList} color="info" subtitle={opdTarget > 0 ? "set by Admin" : "not configured"} />
        <StatCard title="In Consultation" value={inConsultation.toString()} icon={Stethoscope} color="warning" />
        <StatCard title="Waiting" value={waiting.toString()} icon={Clock} color="info" />
        <StatCard title="OPD Revenue" value={`₹${opdRevenue.toLocaleString("en-IN")}`} icon={DollarSign} color="success" subtitle={`on ${selectedDate}`} />
      </div>

      {/* OPD Workflow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">OPD Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {["Registration", "Consultation", "Prescription", "Billing", "Follow-up"].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{i + 1}</span>
                  <span className="text-xs font-medium whitespace-nowrap">{step}</span>
                </div>
                {i < arr.length - 1 && <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">OPD Queue — {selectedDate} ({dateApts.length})</CardTitle>
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
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Doctor</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                   <TableHead>Status</TableHead>
                  </TableRow>
               </TableHeader>
               <TableBody>
                 {dateApts.map((apt) => (
                   <TableRow key={apt.id} className="hover:bg-muted/40">
                     <TableCell><Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{apt.token}</Badge></TableCell>
                     <TableCell className="font-medium text-sm">{apt.patientName}</TableCell>
                     <TableCell className="hidden md:table-cell text-sm">{apt.doctorName || "—"}</TableCell>
                     <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{apt.department}</TableCell>
                     <TableCell className="text-sm">{apt.time}</TableCell>
                     <TableCell className="text-right text-sm font-medium">{feeFor(apt) > 0 ? `₹${feeFor(apt).toLocaleString("en-IN")}` : "—"}</TableCell>
                     <TableCell>
                       {showEdit ? (
                         <div onClick={(e) => e.stopPropagation()}>
                           <Select value={apt.status} onValueChange={(v) => handleStatusChange(apt.id, v)}>
                             <SelectTrigger className="h-7 w-[130px] text-xs border-0 bg-transparent px-2 shadow-none"><SelectValue /></SelectTrigger>
                             <SelectContent>{["Scheduled", "Checked-in", "In Consultation", "Completed", "Cancelled", "No-show", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                           </Select>
                         </div>
                       ) : (
                         <StatusBadge status={apt.status} />
                       )}
                     </TableCell>
                   </TableRow>
                 ))}
                  {dateApts.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">
                        No OPD visits on {selectedDate}. Use “New OPD Visit” to register a walk-in.
                      </TableCell>
                    </TableRow>
                 )}
               </TableBody>
             </Table>
           </div>
         </CardContent>
       </Card>
      {newOPDOpen && <NewOPDDialog key={selectedDate} open presetDate={selectedDate} onOpenChange={(v) => { if (!v) setNewOPDOpen(false); }} />}
    </div>
  );
}

// ===== New OPD Visit (real: appointment + consultation invoice) =====
function NewOPDDialog({ open, onOpenChange, presetDate }: { open: boolean; onOpenChange: (v: boolean) => void; presetDate?: string }) {
  const { toast } = useToast();
  const addAppointment = useAppStore((s) => s.addAppointment);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  const settings = useAppStore((s) => s.settings);
  const { patients, doctors } = useBranchData();
  const visitDate = presetDate || todayIso();
  const [form, setForm] = useState({ patientId: "", doctorId: "", fee: "", collected: true });
  const [saving, setSaving] = useState(false);

  const availablePatients = patients.filter((p) => p.status !== "Admitted");
  const selectedPatient = patients.find((p) => p.id === form.patientId);
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const availableDoctors = useMemo(
    () => doctors.filter((d) => isDoctorAvailableOn(d, visitDate, { schedules: doctorSchedules, branch: activeBranch })),
    [doctors, visitDate, doctorSchedules, activeBranch]
  );
  const effectiveFee = form.fee !== "" ? parseFloat(form.fee) : selectedDoctor?.consultationFee ?? 0;

  const handleSubmit = async () => {
    if (!form.patientId) { toast({ title: "Error", description: "Select a patient", variant: "destructive" }); return; }
    if (!form.doctorId) { toast({ title: "Error", description: "Select a doctor", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const now = new Date();
      const time = visitDate === todayIso() ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "09:00";
      const aptRes = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `a${Date.now()}`,
          token: "",
          patientId: form.patientId,
          patientName: selectedPatient?.name ?? "Patient",
          patientPhoto: selectedPatient?.photo ?? "??",
          doctorId: form.doctorId,
          doctorName: selectedDoctor?.name ?? "",
          department: selectedDoctor?.department ?? "",
          date: visitDate,
          time,
          type: "Walk-in",
          status: visitDate === todayIso() ? "Checked-in" : "Scheduled",
          reason: "OPD Registration",
          waitingTime: 0,
          branch: activeBranch,
        }),
      });
      if (!aptRes.ok) {
        const body = await aptRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create the OPD visit.");
      }
      const savedApt = await aptRes.json();
      addAppointment(savedApt);

      let invoiceNo = "";
      if (effectiveFee > 0) {
        const invRes = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `inv${Date.now()}`,
            patientId: form.patientId,
            patientName: selectedPatient?.name ?? "Patient",
            date: visitDate,
            items: [{
              description: `OPD Consultation — ${selectedDoctor?.name ?? "Doctor"}`,
              category: "OPD",
              quantity: 1,
              rate: effectiveFee,
              amount: effectiveFee,
            }],
            subtotal: effectiveFee,
            tax: 0,
            discount: 0,
            total: effectiveFee,
            paidAmount: form.collected ? effectiveFee : 0,
            status: form.collected ? "Paid" : "Pending",
            paymentMethod: form.collected ? "Cash" : "",
            branch: activeBranch,
            paidDate: form.collected ? visitDate : "",
          }),
        });
        if (invRes.ok) {
          const savedInv = await invRes.json();
          addInvoice(savedInv);
          invoiceNo = savedInv.invoiceNo;
          // Print/PDF the fee bill immediately for the patient.
          if (!printInvoice(savedInv, settings, selectedPatient)) {
            toast({ title: "Bill ready to download", description: "Allow pop-ups for auto-print, or download it from Billing." });
          }
        }
      }

      toast({
        title: "OPD visit registered",
        description: `Token ${savedApt.token} • ${selectedPatient?.name}${invoiceNo ? (form.collected ? ` • Fee ₹${effectiveFee.toLocaleString("en-IN")} collected (${invoiceNo})` : ` • Fee ₹${effectiveFee.toLocaleString("en-IN")} pending (${invoiceNo}) — collect from Billing`) : ""}`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not register OPD visit", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New OPD Visit</DialogTitle><DialogDescription>Creates a live token and collects the consultation fee</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2">
          <Label>Patient *</Label>
          <PatientPicker value={form.patientId} onChange={(id) => setForm({ ...form, patientId: id })} patients={availablePatients} />
        </div>
        <div className="space-y-2">
          <Label>Doctor * <span className="text-[11px] font-normal text-muted-foreground">({availableDoctors.length} available today)</span></Label>
          <Select value={form.doctorId} onValueChange={(v) => setForm({ ...form, doctorId: v, fee: "" })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Select doctor" /></SelectTrigger>
            <SelectContent>
              {availableDoctors.map((d: Doctor) => (
                <SelectItem key={d.id} value={d.id}>{d.name}{d.consultationFee > 0 ? ` — ₹${d.consultationFee}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Consultation Fee (₹){selectedDoctor && selectedDoctor.consultationFee > 0 ? " — auto-filled" : ""}</Label>
          <Input type="number" value={form.fee} onChange={(e) => setForm({ ...form, fee: e.target.value })} placeholder={String(selectedDoctor?.consultationFee ?? 0)} />
        </div>
        <div className="space-y-2">
          <Label>Fee Payment</Label>
          <Select value={form.collected ? "collected" : "pending"} onValueChange={(v) => setForm({ ...form, collected: v === "collected" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="collected">Collected now — Paid bill in Billing</SelectItem>
              <SelectItem value="pending">Not collected — Pending bill, collect later</SelectItem>
            </SelectContent>
          </Select>
          {!form.collected && <p className="text-[11px] text-warning">The fee stays pending in Billing — collect it anytime from Billing or the patient profile.</p>}
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Registering..." : "Register Visit"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== IPD Module =====
export function IPDModule() {
  const { beds, invoices, branch } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const updateBed = useAppStore((s) => s.updateBed);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const { toast } = useToast();
  const [newAdmissionOpen, setNewAdmissionOpen] = useState(false);
  const [dischargeBed, setDischargeBed] = useState<Bed | null>(null);
  const [editBed, setEditBed] = useState<Bed | null>(null);
  const showAdd = canAddPatient(currentUser.role);
  const settings = useAppStore((s) => s.settings);
  const totalCapacity = parseInt(branchSetting(settings, branch, "capacity_Total") ?? "0") || 0;

  const admissions = beds
    .filter((b) => b.status === "Occupied")
    .map((b) => {
      const days = daysAdmittedSince(b.admittedOn);
      const rate = effectiveBedRate(b, settings);
      return { ...b, days, rate, totalCharges: days * rate };
    });
  const todayStr = todayIso();
  const monthStr = todayStr.slice(0, 7);
  const ipdInvoices = invoices.filter((i) => (i.items ?? []).some((it) => it.category === "IPD"));
  const dischargesToday = ipdInvoices.filter((i) => i.date === todayStr).length;
  const avgStay = admissions.length > 0 ? (admissions.reduce((s, a) => s + a.days, 0) / admissions.length).toFixed(1) : "0";
  const accruedCharges = admissions.reduce((s, a) => s + a.totalCharges, 0);
  const ipdRevenueMonth = ipdInvoices
    .filter((i) => (i.date || "").startsWith(monthStr))
    .reduce((s, i) => s + (i.total ?? 0), 0);

  const handleDischarged = (bed: Bed, savedInvoice: Invoice) => {
    updateBed(bed.id, {
      status: "Available", patientId: "", patientName: "", admittedOn: "",
      doctorName: "", diagnosis: "", department: "",
    });
    if (bed.patientId) updatePatient(bed.patientId, { status: "Discharged" });
    addInvoice(savedInvoice);
    toast({
      title: "Patient discharged",
      description: `Invoice ${savedInvoice.invoiceNo} generated for ₹${(savedInvoice.total ?? 0).toLocaleString("en-IN")}.`,
    });
    setDischargeBed(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="IPD — Inpatient Department"
        description="Current admissions with live stay duration and charges — discharge generates a real invoice"
        icon={BedDouble}
        action={showAdd ? <Button size="sm" className="gap-2" onClick={() => setNewAdmissionOpen(true)}><Plus className="h-3.5 w-3.5" /> New Admission</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard title="Admitted Patients" value={admissions.length.toString()} icon={BedDouble} color="warning" subtitle={totalCapacity > 0 ? `of ${totalCapacity} capacity` : undefined} />
        <StatCard title="Bed Capacity" value={totalCapacity > 0 ? totalCapacity.toString() : "—"} icon={Activity} color="info" subtitle={totalCapacity > 0 ? "set by Admin" : "not configured"} />
        <StatCard title="Discharges Today" value={dischargesToday.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Avg Stay" value={`${avgStay} days`} icon={Clock} color="info" />
        <StatCard title="IPD Revenue (Month)" value={`₹${ipdRevenueMonth.toLocaleString("en-IN")}`} icon={DollarSign} color="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Admissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Patient</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead className="hidden md:table-cell">Doctor</TableHead>
                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                    <TableHead className="hidden lg:table-cell">Diagnosis</TableHead>
                    <TableHead className="hidden md:table-cell">Admitted</TableHead>
                    <TableHead className="hidden md:table-cell">Days</TableHead>
                    <TableHead className="hidden lg:table-cell text-right">Rate/Day</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                    <TableHead className="w-[130px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admissions.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {p.patientName?.split(" ").map((n) => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.patientName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px]">{p.number}</Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{p.ward}</p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{p.doctorName || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.department || "—"}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.diagnosis || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{p.admittedOn || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{p.days}d</TableCell>
                      <TableCell className="hidden lg:table-cell text-right text-sm">
                        ₹{p.rate.toLocaleString("en-IN")}
                        {(parseInt(branchSetting(settings, p.branch, `bedRate_${p.ward}`) ?? "0") || 0) > 0 && (
                          <span className="ml-1 text-[10px] text-primary">(Admin)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        ₹{p.totalCharges.toLocaleString("en-IN")}
                        <p className="text-[10px] text-muted-foreground font-normal">{p.days}d × ₹{p.rate.toLocaleString("en-IN")}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit admission (dates, doctor, diagnosis)" onClick={() => setEditBed(p)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setDischargeBed(p)}>
                            <LogOut className="h-3 w-3" /> Discharge
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {admissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-sm text-muted-foreground">
                        No patients admitted. Use “New Admission” to assign an available bed.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Charges Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-warning/5 p-3 border border-warning/20">
              <p className="text-xs text-muted-foreground">Accrued charges (current admissions)</p>
              <p className="text-2xl font-bold text-warning mt-1">₹{accruedCharges.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">Days × daily rate, updated live</p>
            </div>
            <div className="rounded-lg bg-success/5 p-3 border border-success/20">
              <p className="text-xs text-muted-foreground">IPD revenue collected (this month)</p>
              <p className="text-2xl font-bold text-success mt-1">₹{ipdRevenueMonth.toLocaleString("en-IN")}</p>
              <p className="text-[11px] text-muted-foreground mt-1">From {ipdInvoices.length} discharge invoice{ipdInvoices.length === 1 ? "" : "s"}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">Discharges today</p>
              <p className="text-xl font-bold">{dischargesToday}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Discharging a patient automatically creates a Paid invoice (stay days × bed rate) in the Billing module and frees the bed.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => useAppStore.getState().setActiveModule("surgery")}
            >
              Open Surgery & OT →
            </Button>
          </CardContent>
        </Card>
      </div>
      <IPDBillingPanel compact />
      {newAdmissionOpen && <NewAdmissionDialog open onOpenChange={(v) => { if (!v) setNewAdmissionOpen(false); }} />}
      {editBed && (
        <EditAdmissionDialog
          key={editBed.id}
          open
          onOpenChange={(v) => { if (!v) setEditBed(null); }}
          bed={editBed}
          onSaved={(updates) => updateBed(editBed.id, updates)}
        />
      )}
      {dischargeBed && (
        <DischargeDialog
          key={dischargeBed.id}
          open
          onOpenChange={(v) => { if (!v) setDischargeBed(null); }}
          bed={dischargeBed}
          onDischarged={(inv) => handleDischarged(dischargeBed, inv)}
        />
      )}
    </div>
  );
}
