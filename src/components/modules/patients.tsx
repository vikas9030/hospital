"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { canAddPatient, canEditPatient, canDeletePatient, isAdmin, fetchWithRetry, sameBranch, samePerson, samePhone, canCollectPayment, scheduleActor, canManageAppointment } from "@/lib/utils";
import {
  Users, Search, Filter, Plus, QrCode, ArrowLeft, Phone, Mail, MapPin,
  Heart, AlertTriangle, Calendar, FileText, Activity, Pill, Receipt,
  Stethoscope, FlaskConical, ScanLine, CreditCard, RefreshCw, Shield,
  Download, MoreHorizontal, IdCard, Pencil, Trash2, Check, X, Wallet, Eye, Smartphone,
  HeartPulse, Thermometer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { isDoctorAvailableOn, weekdayOf } from "@/lib/utils";
import type { Patient, Appointment, Invoice, Prescription, VitalsEntry, FirstAidEntry } from "@/lib/types";
import { vitalsKey, NURSE_FIRSTAID_KEY, parseVitals, parseFirstAid, conditionStyles } from "@/lib/nursing";
import { printOPSummary, printMedicalRecord, printLabReport, printRadiologyReport, buildMedicalRecordHtml, buildLabReportHtml, buildRadiologyReportHtml, type ReportDoc } from "@/lib/documents";
import { ReportViewerDialog } from "@/components/shared/report-viewer";
import { printInvoice } from "@/lib/invoice-print";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { InvoiceViewDialog } from "@/components/shared/invoice-view-dialog";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";

function PatientFormDialog({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient?: Patient }) {
  const { toast } = useToast();
  const addPatient = useAppStore((s) => s.addPatient);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const branchData = useAppStore((s) => {
    const branch = isAdmin(s.currentUser.role) ? s.activeBranch : s.currentUser.branch;
    return branch || "MediCore Main Campus";
  });
  const isEdit = !!patient;
  const { doctors, appointments, branch: dialogBranch } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const addAppointment = useAppStore((s) => s.addAppointment);
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  const [form, setForm] = useState(() => {
    if (patient) {
      return {
        name: patient.name, phone: patient.phone, email: patient.email,
        gender: patient.gender, age: String(patient.age), bloodGroup: patient.bloodGroup,
        address: patient.address, emergencyContact: patient.emergencyContact,
        insuranceProvider: patient.insuranceProvider, insurancePolicy: patient.insurancePolicy,
        status: patient.status,
        opDate: patient.opDate ?? "", opFees: String(patient.opFees ?? 0),
        doctorId: patient.doctorId ?? "",
      };
    }
    return {
      name: "", phone: "", email: "", gender: "Male" as "Male" | "Female" | "Other",
      age: "", bloodGroup: "O+", address: "", emergencyContact: "",
      insuranceProvider: "", insurancePolicy: "", status: "OPD" as Patient["status"],
      opDate: new Date().toISOString().split("T")[0], opFees: "",
      doctorId: "",
    };
  });
  // Only doctors scheduled for the selected OP date are offered.
  const availableDoctors = useMemo(
    () => doctors.filter((d) => isDoctorAvailableOn(d, form.opDate, { schedules: doctorSchedules, branch: dialogBranch })),
    [doctors, form.opDate, doctorSchedules, dialogBranch]
  );
  // Optional narrowing by department and shift for faster assignment.
  const [doctorFilters, setDoctorFilters] = useState({ department: "", shift: "" });
  const doctorDepartments = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.department).filter(Boolean))).sort(),
    [doctors]
  );
  const matchedDoctors = useMemo(
    () =>
      availableDoctors.filter(
        (d) =>
          (!doctorFilters.department || d.department === doctorFilters.department) &&
          (!doctorFilters.shift || d.shift === doctorFilters.shift)
      ),
    [availableDoctors, doctorFilters]
  );
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const listedIds = new Set(matchedDoctors.map((d) => d.id));
  const selectedOffSchedule = !!selectedDoctor && !isDoctorAvailableOn(selectedDoctor, form.opDate, { schedules: doctorSchedules, branch: dialogBranch });
  const selectedFilteredOut = !!selectedDoctor && !selectedOffSchedule && !listedIds.has(selectedDoctor.id);
  const doctorOptions =
    selectedDoctor && !listedIds.has(selectedDoctor.id) ? [selectedDoctor, ...matchedDoctors] : matchedDoctors;
  const handleOpDateChange = (value: string) => {
    setForm((f) => {
      const current = doctors.find((d) => d.id === f.doctorId);
      const stillOk = !current || isDoctorAvailableOn(current, value, { schedules: doctorSchedules, branch: dialogBranch });
      return { ...f, opDate: value, doctorId: stillOk ? f.doctorId : "" };
    });
  };
  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    setForm({
      ...form,
      doctorId,
      opFees: doctor && doctor.consultationFee > 0 ? String(doctor.consultationFee) : form.opFees,
    });
  };

  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      toast({ title: "Missing fields", description: "Name and phone are required.", variant: "destructive" });
      return;
    }
    // Each patient keeps an individual phone number — flag clashes up front
    // (the server re-checks and returns 409 as the final guard).
    const clash = useAppStore.getState().patients.find((p) => (!isEdit || p.id !== patient?.id) && samePhone(p.phone, form.phone));
    if (clash) {
      toast({ title: "Duplicate phone number", description: `This number already belongs to ${clash.name} (${clash.uhid}). Each patient needs their own number.`, variant: "destructive" });
      return;
    }
    if (isEdit && patient) {
      const updates = {
        name: form.name, phone: form.phone, email: form.email || "-",
        gender: form.gender, age: parseInt(form.age) || 0, bloodGroup: form.bloodGroup,
        address: form.address || "-", emergencyContact: form.emergencyContact || "-",
        insuranceProvider: form.insuranceProvider || "Self Pay", insurancePolicy: form.insurancePolicy || "-",
        status: form.status,
        photo: form.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(),
        opDate: form.opDate,
        opFees: parseFloat(form.opFees) || 0,
        doctorId: form.doctorId,
        doctorName: selectedDoctor?.name ?? "",
      };
      setSaving(true);
      try {
      const res = await fetchWithRetry("/api/patients", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: patient.id, ...updates }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to save changes.");
        }
        const saved = await res.json();

        const finalOpDate = updates.opDate;
        const finalDoctorId = updates.doctorId;
        const linkedApts = appointments.filter(
          (a) =>
            a.patientId === patient.id &&
            a.reason === "OPD Registration" &&
            ["Scheduled", "Checked-in"].includes(a.status)
        );

        if (finalOpDate && finalDoctorId && updates.status !== "Admitted") {
          if (linkedApts.length > 0) {
            const apt = linkedApts[0];
            const needsUpdate =
              apt.date !== finalOpDate ||
              apt.doctorId !== finalDoctorId ||
              apt.doctorName !== (selectedDoctor?.name ?? "") ||
              apt.department !== (selectedDoctor?.department ?? "");
            if (needsUpdate) {
              const now = new Date();
              const aptRes = await fetchWithRetry("/api/appointments", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: apt.id,
                  date: finalOpDate,
                  time: finalOpDate === todayIso() ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : apt.time || "09:00",
                  doctorId: finalDoctorId,
                  doctorName: selectedDoctor?.name ?? "",
                  department: selectedDoctor?.department ?? "",
                }),
              });
              if (aptRes.ok) {
                const savedApt = await aptRes.json();
                updateAppointment(apt.id, savedApt);
              }
              toast({ title: "Visit updated", description: `OPD appointment synced to ${finalOpDate} with ${selectedDoctor?.name ?? "doctor"}.` });
            }
          } else {
            const now = new Date();
            const aptRes = await fetchWithRetry("/api/appointments", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: `a${Date.now()}`,
                token: "",
                patientId: patient.id,
                patientName: saved.name ?? form.name,
                patientPhoto: saved.photo ?? "??",
                doctorId: finalDoctorId,
                doctorName: selectedDoctor?.name ?? "",
                department: selectedDoctor?.department ?? "",
                date: finalOpDate,
                time: finalOpDate === todayIso() ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "09:00",
                type: "Walk-in",
                status: "Scheduled",
                reason: "OPD Registration",
                waitingTime: 0,
                branch: branchData,
              }),
            });
            if (aptRes.ok) {
              const savedApt = await aptRes.json();
              addAppointment(savedApt);
              toast({ title: "Visit scheduled", description: `OPD appointment created for ${finalOpDate} (token ${savedApt.token}).` });
            }
          }
        } else if (linkedApts.length > 0) {
          for (const apt of linkedApts) {
            const aptRes = await fetchWithRetry("/api/appointments", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: apt.id, status: "Cancelled", ...scheduleActor(currentUser.role, currentUser.name) }),
            });
            if (aptRes.ok) {
              const savedApt = await aptRes.json();
              updateAppointment(apt.id, savedApt);
            }
          }
          toast({ title: "Visit cancelled", description: "OPD appointment cancelled (doctor or date removed, or patient admitted)." });
        }

        setSaving(false);
        updatePatient(patient.id, saved);
        toast({ title: "Patient Updated", description: `${form.name} has been updated.` });
        onOpenChange(false);
      } catch (e: any) {
        setSaving(false);
        toast({ title: "Could not update patient", description: e.message, variant: "destructive" });
      }
      return;
    }
    const id = `p${Date.now()}`;
    const uhid = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;
    const newPatient = {
      id, uhid, name: form.name, photo: form.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(),
      gender: form.gender, age: parseInt(form.age) || 0, phone: form.phone, email: form.email || "-",
      bloodGroup: form.bloodGroup, address: form.address || "-", emergencyContact: form.emergencyContact || "-",
      insuranceProvider: form.insuranceProvider || "Self Pay", insurancePolicy: form.insurancePolicy || "-",
      allergies: [] as string[], chronicDiseases: [] as string[], status: form.status,
      lastVisit: new Date().toISOString().split("T")[0], registeredOn: new Date().toISOString().split("T")[0],
      branch: branchData,
      opDate: form.opDate || new Date().toISOString().split("T")[0],
      opFees: parseFloat(form.opFees) || 0,
      doctorId: form.doctorId,
      doctorName: selectedDoctor?.name ?? "",
    };
    setSaving(true);
    try {
      const res = await fetchWithRetry("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPatient),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save the patient.");
      }
      // Collect the OP fee at registration: doctor assigned + fee > 0 → Paid invoice.
      const fee = parseFloat(form.opFees) || 0;
      let invoiceNo = "";
      if (fee > 0) {
        try {
          const invRes = await fetchWithRetry("/api/invoices", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: `inv${Date.now()}`,
              patientId: id,
              patientName: newPatient.name,
              date: newPatient.opDate,
              items: [{
                description: `OPD Consultation — ${selectedDoctor?.name ?? "Doctor"}${selectedDoctor?.department ? ` (${selectedDoctor.department})` : ""}`,
                category: "OPD",
                quantity: 1,
                rate: fee,
                amount: fee,
              }],
              subtotal: fee,
              tax: 0,
              discount: 0,
              total: fee,
              paidAmount: fee,
              status: "Paid",
              paymentMethod: "Cash",
              branch: newPatient.branch,
              paidDate: newPatient.opDate,
            }),
          });
          if (invRes.ok) {
            const savedInv = await invRes.json();
            addInvoice(savedInv);
            invoiceNo = savedInv.invoiceNo;
          }
        } catch (e: any) {
          // Patient is saved; only the fee invoice failed — warn, don't block.
          toast({ title: "Fee invoice failed", description: e.message, variant: "destructive" });
        }
      }

      // Create the OPD appointment so the visit shows in the calendar on the OP date.
      let appointmentToken = "";
      if (form.doctorId && newPatient.status !== "Admitted") {
        try {
          const now = new Date();
          const aptRes = await fetchWithRetry("/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: `a${Date.now()}`,
              token: "",
              patientId: newPatient.id,
              patientName: newPatient.name,
              patientPhoto: newPatient.photo,
              doctorId: form.doctorId,
              doctorName: selectedDoctor?.name ?? "",
              department: selectedDoctor?.department ?? "",
              date: newPatient.opDate,
              time: newPatient.opDate === todayIso() ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "09:00",
              type: "Walk-in",
              status: "Scheduled",
              reason: "OPD Registration",
              waitingTime: 0,
              branch: newPatient.branch,
            }),
          });
          if (aptRes.ok) {
            const savedApt = await aptRes.json();
            addAppointment(savedApt);
            appointmentToken = savedApt.token;
          }
        } catch {
          // Non-fatal: patient + invoice are saved; appointment can be booked manually.
        }
      }
      setSaving(false);
      addPatient(newPatient);
      toast({
        title: "Patient Created",
        description: `${form.name} registered.${appointmentToken ? ` OPD visit on ${newPatient.opDate} (token ${appointmentToken}).` : ""}${invoiceNo ? ` Fee ₹${fee.toLocaleString("en-IN")} collected (${invoiceNo}) — open it from Billing anytime.` : ""}`,
      });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add patient", description: e.message, variant: "destructive" });
      setSaving(false);
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Patient" : "New Patient"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update patient information" : "Register a new patient in the system."}</DialogDescription>
        </DialogHeader>
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
        <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="Patient name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Phone *</Label><Input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2"><Label>Gender</Label><Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" | "Other" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
            <div className="space-y-2"><Label>Age</Label><Input type="number" placeholder="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
            <div className="space-y-2"><Label>Blood Group</Label><Select value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Emergency Contact</Label><Input placeholder="Emergency phone" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>
            <div className="space-y-2"><Label>Insurance Provider</Label><Input placeholder="Provider name" value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Insurance Policy Number</Label><Input placeholder="Policy number" value={form.insurancePolicy} onChange={(e) => setForm({ ...form, insurancePolicy: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Patient["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Admitted">Admitted</SelectItem><SelectItem value="OPD">OPD</SelectItem><SelectItem value="Discharged">Discharged</SelectItem><SelectItem value="Follow Up">Follow Up</SelectItem></SelectContent></Select></div>
          </div>
          <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={doctorFilters.department} onValueChange={(v) => setDoctorFilters((f) => ({ ...f, department: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All departments" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all-depts">All departments</SelectItem>
                      {doctorDepartments.map((dep) => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Shift</Label>
                  <Select value={doctorFilters.shift} onValueChange={(v) => setDoctorFilters((f) => ({ ...f, shift: v }))}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Any shift" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any-shift">Any shift</SelectItem>
                      <SelectItem value="Morning">Morning</SelectItem>
                      <SelectItem value="Evening">Evening</SelectItem>
                      <SelectItem value="Night">Night</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {(doctorFilters.department || doctorFilters.shift) && (
                <button
                  type="button"
                  onClick={() => setDoctorFilters({ department: "", shift: "" })}
                  className="text-[11px] text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
              <div className="space-y-2">
                <Label>Assign Doctor{form.opDate ? ` — ${weekdayOf(form.opDate)}` : ""}{matchedDoctors.length > 0 ? ` (${matchedDoctors.length} available)` : ""}</Label>
                <Select value={form.doctorId} onValueChange={handleDoctorChange}>
                  <SelectTrigger><SelectValue placeholder={doctorOptions.length === 0 ? "No matching doctors" : "Select doctor"} /></SelectTrigger>
                  <SelectContent>
                    {doctorOptions.map((d) => {
                      const offSchedule = !isDoctorAvailableOn(d, form.opDate, { schedules: doctorSchedules, branch: dialogBranch });
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                          {d.consultationFee > 0 ? ` — ₹${d.consultationFee}` : ""}
                          {d.shift ? ` • ${d.shift}` : ""}
                          {offSchedule ? " (off schedule)" : ""}
                        </SelectItem>
                      );
                    })}
                    {doctorOptions.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">No doctors match the selected department/shift for this weekday.</div>
                    )}
                  </SelectContent>
                </Select>
                {selectedOffSchedule && (
                  <p className="text-[11px] text-destructive">{selectedDoctor!.name} is not scheduled on {weekdayOf(form.opDate)}. Pick another doctor or change the OP date.</p>
                )}
                {selectedFilteredOut && (
                  <p className="text-[11px] text-muted-foreground">{selectedDoctor!.name} is currently hidden by the department/shift filters.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>OP Date</Label><Input type="date" value={form.opDate} onChange={(e) => handleOpDateChange(e.target.value)} /></div>
                <div className="space-y-2"><Label>OP Fees (₹){selectedDoctor && selectedDoctor.consultationFee > 0 && !isEdit ? " — auto-filled" : ""}</Label><Input type="number" placeholder="Consultation fees" value={form.opFees} onChange={(e) => setForm({ ...form, opFees: e.target.value })} /></div>
              </div>
            </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : isEdit ? "Update Patient" : "Register Patient"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePatientDialog({ open, onOpenChange, patientName, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; patientName: string; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Delete Patient</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{patientName}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={onConfirm}>Delete</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// No QR camera library is available, so "Scan QR" is a fast lookup by patient
// ID, UHID (registration number), or phone. On a hit we open the patient's
// detail via the same selectPatient mechanism used by the table rows.
function FindPatientDialog({ open, onOpenChange, patients, onFound }: { open: boolean; onOpenChange: (v: boolean) => void; patients: Patient[]; onFound: (id: string) => void }) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const handleSearch = () => {
    const raw = query.trim();
    const q = raw.toLowerCase();
    if (!q) {
      toast({ title: "Enter a value", description: "Type a patient ID, UHID, or phone number to search.", variant: "destructive" });
      return;
    }
    const digits = q.replace(/\D/g, "");
    const match = patients.find((p) => {
      const id = p.id.toLowerCase();
      const uhid = p.uhid.toLowerCase();
      const phone = p.phone.replace(/\D/g, "");
      return (
        id === q ||
        uhid === q ||
        uhid.includes(q) ||
        (digits.length > 0 && phone.includes(digits))
      );
    });
    if (match) {
      onFound(match.id);
      onOpenChange(false);
      setQuery("");
    } else {
      toast({ title: "No patient found", description: `No patient matches "${raw}".`, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setQuery(""); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> Find Patient</DialogTitle>
          <DialogDescription>Scan or type a patient ID, UHID, or phone number to open their record.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Patient ID / UHID / Phone</Label>
          <Input
            autoFocus
            placeholder="e.g. MC-2024-000123 or 98765..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSearch(); } }}
          />
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSearch}>Find Patient</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  if (isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const todayIso = () => new Date().toISOString().split("T")[0];

export function PatientsModule() {
  const { selectedPatientId, selectPatient } = useAppStore();
  const allPatients = useAppStore((s) => s.patients);
  const deletePatient = useAppStore((s) => s.deletePatient);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const opExpiryDays = parseInt(useAppStore((s) => s.settings.opExpiryDays ?? "30")) || 0;
  const patientFilterDoctor = useAppStore((s) => s.patientFilterDoctor);
  const setPatientFilterDoctor = useAppStore((s) => s.setPatientFilterDoctor);
  const patients = useMemo(() => {
    const branch = isAdmin(currentUser.role) ? activeBranch : currentUser.branch;
    let list = allPatients.filter((p) => sameBranch(p.branch, branch));
    if (patientFilterDoctor) list = list.filter((p) => samePerson(p.doctorName, patientFilterDoctor));
    return list;
  }, [allPatients, currentUser.role, currentUser.branch, activeBranch, patientFilterDoctor]);
  const showAddPatient = canAddPatient(currentUser.role);
  const showEditPatient = canEditPatient(currentUser.role);
  const showDeletePatient = canDeletePatient(currentUser.role);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [genderFilter, setGenderFilter] = useState("All");
  const [bloodGroupFilter, setBloodGroupFilter] = useState("All");
  const [scanOpen, setScanOpen] = useState(false);
  const addPatient = useAppStore((s) => s.addPatient);
  const importBranch = isAdmin(currentUser.role) ? activeBranch : currentUser.branch;
  const patientIO: EntityIOConfig<Patient> = {
    entity: "patients",
    filename: "patients",
    columns: [
      { header: "name", sample: "Ravi Kumar" },
      { header: "gender", sample: "Male" },
      { header: "age", sample: "34" },
      { header: "phone", sample: "9876543210" },
      { header: "email", sample: "ravi@example.com" },
      { header: "bloodGroup", sample: "O+" },
      { header: "address", sample: "12 MG Road" },
      { header: "emergencyContact", sample: "9876500000" },
      { header: "insuranceProvider", sample: "Self Pay" },
      { header: "insurancePolicy", sample: "-" },
      { header: "status", sample: "OPD" },
      { header: "branch", sample: importBranch },
      { header: "doctorName", sample: "" },
      { header: "opDate", sample: new Date().toISOString().split("T")[0] },
      { header: "opFees", sample: "500" },
    ],
    toRow: (p) => [p.name, p.gender, p.age, p.phone, p.email, p.bloodGroup, p.address, p.emergencyContact, p.insuranceProvider, p.insurancePolicy, p.status, p.branch, p.doctorName || "", p.opDate || "", p.opFees ?? 0],
    fromRow: (row, idx?: number) => {
      if (!row.name || !row.phone) throw new Error("name and phone are required.");
      const today = new Date().toISOString().split("T")[0];
      const stamp = Date.now();
      return {
        id: `p${stamp}${idx ?? 0}`,
        uhid: `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`,
        name: row.name,
        photo: row.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
        gender: ["Male", "Female", "Other"].includes(row.gender) ? row.gender : "Male",
        age: parseInt(row.age) || 0,
        phone: row.phone,
        email: row.email || "-",
        bloodGroup: row.bloodGroup || "O+",
        address: row.address || "-",
        emergencyContact: row.emergencyContact || "-",
        insuranceProvider: row.insuranceProvider || "Self Pay",
        insurancePolicy: row.insurancePolicy || "-",
        allergies: [],
        chronicDiseases: [],
        status: ["Active", "Admitted", "OPD", "Discharged", "Follow Up"].includes(row.status) ? row.status : "OPD",
        lastVisit: today,
        registeredOn: today,
        branch: row.branch || importBranch,
        opDate: row.opDate || today,
        opFees: parseFloat(row.opFees) || 0,
        doctorId: "",
        doctorName: row.doctorName || "",
      };
    },
    endpoint: "/api/patients",
    onImported: (saved) => addPatient(saved),
  };
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [portalTarget, setPortalTarget] = useState<Patient | null>(null);
  const [portalLogins, setPortalLogins] = useState<Record<string, { phone: string; mustChangePassword: boolean }>>({});
  const invoices = useAppStore((s) => s.invoices);

  const loadPortalLogins = async () => {
    try {
      const res = await fetch("/api/portal/access");
      if (!res.ok) return;
      const all = await res.json();
      if (Array.isArray(all)) {
        const map: Record<string, { phone: string; mustChangePassword: boolean }> = {};
        for (const r of all) map[r.patientId] = { phone: r.phone, mustChangePassword: !!r.mustChangePassword };
        setPortalLogins(map);
      }
    } catch {
      // Portal store unavailable; column stays neutral.
    }
  };
  useEffect(() => { loadPortalLogins(); }, []);

  // Per-patient billing rollup (OP fees + lab + radiology + all bills).
  const billingByPatient = useMemo(() => {
    const map = new Map<string, { billed: number; due: number; oldestPending: Invoice | null }>();
    for (const inv of invoices) {
      const entry = map.get(inv.patientId) ?? { billed: 0, due: 0, oldestPending: null };
      entry.billed += inv.total || 0;
      const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
      entry.due += outstanding;
      if (outstanding > 0 && (!entry.oldestPending || (inv.date || "") < (entry.oldestPending.date || ""))) {
        entry.oldestPending = inv;
      }
      map.set(inv.patientId, entry);
    }
    return map;
  }, [invoices]);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Hooks must run before the early return below (Rules of Hooks).
  const filtered = patients.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.uhid.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search);
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    const matchGender = genderFilter === "All" || p.gender === genderFilter;
    const matchBlood = bloodGroupFilter === "All" || p.bloodGroup === bloodGroupFilter;
    return matchSearch && matchStatus && matchGender && matchBlood;
  });

  // Popover filters applied before pagination (status has its own segmented control).
  const activeFilterCount = (genderFilter !== "All" ? 1 : 0) + (bloodGroupFilter !== "All" ? 1 : 0);
  const {
    page: currentPage, setPage: goToPage, pageSize, setPageSize,
    totalPages, pageItems: paginated, total: filteredTotal,
  } = usePagination(filtered, `${search}|${statusFilter}|${genderFilter}|${bloodGroupFilter}|${patientFilterDoctor}`);

  if (selectedPatient) {
    return <PatientDetail patientId={selectedPatient.id} onBack={() => selectPatient(null)} />;
  }

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetchWithRetry("/api/patients", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete patient.");
      }
      // The server cascades the delete (appointments, invoices + items, lab
      // tests, radiology orders, claims, bed assignment). Mirror the purge in
      // the local store so nothing orphaned lingers in Doctors, Appointments,
      // Billing, Lab or Radiology views.
      const st = useAppStore.getState();
      const removedAppointments = st.appointments.filter((a) => a.patientId === deleteTarget.id).length;
      for (const a of st.appointments.filter((a) => a.patientId === deleteTarget.id)) st.deleteAppointment(a.id);
      for (const t of st.labTests.filter((t) => t.patientId === deleteTarget.id)) st.deleteLabTest(t.id);
      for (const r of st.radiologyOrders.filter((r) => r.patientId === deleteTarget.id)) st.deleteRadiologyOrder(r.id);
      for (const i of st.invoices.filter((i) => i.patientId === deleteTarget.id)) st.deleteInvoice(i.id);
      for (const c of st.insuranceClaims.filter((c) => c.patientId === deleteTarget.id)) st.deleteInsuranceClaim(c.id);
      for (const m of st.medicalRecords.filter((m) => m.patientId === deleteTarget.id)) st.deleteMedicalRecord(m.id);
      for (const b of st.beds.filter((b) => b.patientId === deleteTarget.id)) {
        st.updateBed(b.id, { patientId: "", patientName: "", status: "Available", admittedOn: "" } as Partial<typeof b>);
      }
      deletePatient(deleteTarget.id);
      toast({
        title: "Patient Deleted",
        description: `${deleteTarget.name} removed${removedAppointments > 0 ? ` along with ${removedAppointments} appointment${removedAppointments === 1 ? "" : "s"}` : ""}.`,
      });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete patient", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="Manage patient records, profiles, and medical history"
        icon={Users}
        action={
          <>
            {showAddPatient && <ImportExportButtons config={patientIO} items={filtered} compact />}
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setScanOpen(true)}>
              <QrCode className="h-3.5 w-3.5" /> Scan QR
            </Button>
            {showAddPatient && (
              <Button size="sm" className="gap-2" onClick={() => { setEditPatient(undefined); setNewPatientOpen(true); }}>
                <Plus className="h-3.5 w-3.5" /> New Patient
              </Button>
            )}
          </>
        }
      />

      {patientFilterDoctor && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <Stethoscope className="h-3.5 w-3.5 text-primary" />
          <span>Showing patients assigned to <span className="font-semibold text-foreground">{patientFilterDoctor}</span></span>
          <Button variant="ghost" size="sm" className="ml-auto h-6 px-2 text-[11px]" onClick={() => setPatientFilterDoctor(null)}>
            Show all
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Patients" value={patients.length.toLocaleString()} icon={Users} color="primary" />
        <StatCard title="Admitted" value={patients.filter(p => p.status === "Admitted").length.toString()} icon={Activity} color="warning" subtitle="Currently in IPD" />
        <StatCard title="OPD Today" value={patients.filter(p => p.status === "OPD").length.toString()} icon={Stethoscope} color="info" subtitle="Outpatient visits" />
        <StatCard title="New This Week" value={patients.filter((p) => {
          if (!p.registeredOn) return false;
          const reg = new Date(p.registeredOn);
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          return reg >= weekAgo;
        }).length.toString()} icon={Plus} color="success" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
              <div className="relative flex-1 min-w-[160px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, UHID, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2 h-9 relative shrink-0">
                    <Filter className="h-3.5 w-3.5" /> Filters
                    {activeFilterCount > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                        {activeFilterCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-64 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Filters</p>
                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => { setGenderFilter("All"); setBloodGroupFilter("All"); }}
                        className="text-[11px] text-primary hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Gender</Label>
                    <Select value={genderFilter} onValueChange={setGenderFilter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All genders</SelectItem>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Blood Group</Label>
                    <Select value={bloodGroupFilter} onValueChange={setBloodGroupFilter}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="All">All blood groups</SelectItem>
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => (
                          <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
              {["All", "Active", "Admitted", "OPD", "Discharged", "Follow Up"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[60px]">UHID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Assigned Doctor</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Blood</TableHead>
                  <TableHead className="hidden xl:table-cell">Insurance</TableHead>
                  <TableHead className="hidden xl:table-cell">OP Fees</TableHead>
                  <TableHead className="hidden xl:table-cell">OP Date</TableHead>
                  <TableHead className="hidden md:table-cell">Last Visit</TableHead>
                  <TableHead className="hidden xl:table-cell text-right">Billed</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[52px]">Portal</TableHead>
                  {(showEditPatient || showDeletePatient) && <TableHead className="w-[110px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => selectPatient(p.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.uhid}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{p.photo}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.gender}, {p.age} yrs</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {p.doctorName ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <Stethoscope className="h-3 w-3 text-primary" /> {p.doctorName}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <p className="text-xs">{p.phone}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="font-mono">{p.bloodGroup}</Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-xs">{p.insuranceProvider}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs">{typeof p.opFees === "number" && p.opFees > 0 ? `₹${p.opFees.toLocaleString("en-IN")}` : "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-xs">
                      {p.opDate ? (
                        (() => {
                          const expiry = opExpiryDays > 0 ? addDaysIso(p.opDate, opExpiryDays) : "";
                          const expired = expiry && expiry < todayIso();
                          return (
                            <span className={expired ? "text-destructive font-medium" : "font-medium"} title={expiry ? `Valid till ${expiry}` : undefined}>
                              {p.opDate}{expired ? " (expired)" : ""}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.lastVisit}</TableCell>
                    {(() => {
                      const b = billingByPatient.get(p.id);
                      return (
                        <>
                          <TableCell className="hidden xl:table-cell text-xs text-right">{b && b.billed > 0 ? `₹${b.billed.toLocaleString("en-IN")}` : "—"}</TableCell>
                          <TableCell className={`text-xs text-right font-medium ${b && b.due > 0 ? "text-destructive" : "text-muted-foreground"}`}>{b && b.due > 0 ? `₹${b.due.toLocaleString("en-IN")}` : "—"}</TableCell>
                        </>
                      );
                    })()}
                    <TableCell>
                      {showEditPatient ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={p.status}
                            onValueChange={async (v) => {
                              const status = v as Patient["status"];
                              try {
                const res = await fetchWithRetry("/api/patients", {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: p.id, status }),
                                });
                                if (!res.ok) {
                                  const body = await res.json().catch(() => ({}));
                                  throw new Error(body.error || "Failed to update status.");
                                }
                                updatePatient(p.id, { status });
                              } catch (e: any) {
                                toast({ title: "Could not update status", description: e.message, variant: "destructive" });
                              }
                            }}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs border-0 bg-transparent hover:bg-muted/60 px-2 shadow-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {["Active", "Admitted", "OPD", "Discharged", "Follow Up"].map((s) => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <StatusBadge status={p.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const login = portalLogins[p.id];
                        if (!login) {
                          return (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" title="No portal login — click to issue" onClick={(e) => { e.stopPropagation(); setPortalTarget(p); }}>
                              <Smartphone className="h-3.5 w-3.5" />
                            </Button>
                          );
                        }
                        return (
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-success"
                            title={`Portal login active (${login.phone})${login.mustChangePassword ? " — password reset pending" : ""} — click to reset password`}
                            onClick={(e) => { e.stopPropagation(); setPortalTarget(p); }}
                          >
                            <span className="relative">
                              <Smartphone className="h-3.5 w-3.5" />
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success border border-background" />
                            </span>
                          </Button>
                        );
                      })()}
                    </TableCell>
                    {(showEditPatient || showDeletePatient) && (
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const due = billingByPatient.get(p.id)?.due ?? 0;
                            const oldest = billingByPatient.get(p.id)?.oldestPending ?? null;
                            return due > 0 && oldest && canCollectPayment(currentUser.role) ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-success" title={`Collect due ₹${due.toLocaleString("en-IN")} (oldest: ${oldest.invoiceNo})`} onClick={() => setCollectInvoice(oldest)}>
                                <Wallet className="h-3.5 w-3.5" />
                              </Button>
                            ) : null;
                          })()}
                          {showEditPatient && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditPatient(p); setNewPatientOpen(true); }} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {showDeletePatient && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(p)} title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <DataPagination page={currentPage} totalPages={totalPages} pageSize={pageSize} total={filteredTotal} onPage={goToPage} onPageSize={setPageSize} />
          {filteredTotal !== patients.length && (
            <p className="text-xs text-muted-foreground">Filtered from {patients.length} patients</p>
          )}
        </CardContent>
      </Card>

      {newPatientOpen && <PatientFormDialog key={editPatient?.id ?? "new"} open={newPatientOpen} onOpenChange={(v) => { setNewPatientOpen(v); if (!v) setEditPatient(undefined); }} patient={editPatient} />}
      {deleteTarget && <DeletePatientDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }} patientName={deleteTarget.name} onConfirm={handleDelete} />}
      <FindPatientDialog open={scanOpen} onOpenChange={setScanOpen} patients={patients} onFound={(id) => selectPatient(id)} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Payment" />
      <PortalAccessDialog open={!!portalTarget} onOpenChange={(v) => { if (!v) { setPortalTarget(null); loadPortalLogins(); } }} patient={portalTarget} />
    </div>
  );
}

function PortalAccessDialog({ open, onOpenChange, patient }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient | null }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [phone, setPhone] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [confirmTemp, setConfirmTemp] = useState("");
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [hasLogin, setHasLogin] = useState(false);
  const [result, setResult] = useState<{ phone: string; tempPassword: string } | null>(null);
  const prevId = useState<string | null>(null);

  if (patient && patient.id !== prevId[0]) {
    prevId[1](patient.id);
    setPhone(patient.phone || "");
    setTempPassword("");
    setConfirmTemp("");
    setResult(null);
    setHasLogin(false);
    setChecking(true);
    fetch(`/api/portal/access?patientId=${patient.id}`)
      .then((r) => r.json())
      .then((b) => {
        if (b.exists) {
          setHasLogin(true);
          setPhone(b.phone || patient.phone || "");
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }
  if (!patient) return null;

  const handleSave = async () => {
    if (!phone.trim()) { toast({ title: "Phone required", description: "Enter the patient's mobile number for portal login.", variant: "destructive" }); return; }
    const chosen = tempPassword.trim();
    if (chosen && chosen.length < 8) { toast({ title: "Too short", description: "Temporary password must be at least 8 characters (or leave blank for the default).", variant: "destructive" }); return; }
    if (chosen && chosen !== confirmTemp.trim()) { toast({ title: "Mismatch", description: "Temporary password and confirmation must match.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/portal/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          phone: phone.trim(),
          ...(chosen ? { tempPassword: chosen } : {}),
          actorEmail: currentUser.email,
          actorName: currentUser.name,
          branch: patient.branch,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save portal access.");
      setResult({ phone: body.phone, tempPassword: body.tempPassword });
      setHasLogin(true);
      setTempPassword("");
      setConfirmTemp("");
      toast({ title: hasLogin ? "Password Reset" : "Portal Access Ready", description: `Share the temporary password with ${patient.name}.` });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-info" /> {hasLogin ? "Reset Portal Password" : "Patient Portal Access"}</DialogTitle>
          <DialogDescription>
            {hasLogin
              ? <span><strong>{patient.name}</strong> already has portal login — use this forgot-password method to set a new temporary password.</span>
              : <span>Issue login for <strong>{patient.name}</strong>. The patient signs in with their phone number.</span>}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {checking ? (
            <p className="text-xs text-muted-foreground">Checking existing login…</p>
          ) : hasLogin ? (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-xs">
              <p className="font-semibold text-success">Login active for {phone || patient.phone}</p>
              <p className="text-muted-foreground mt-0.5">Patient signs in at <span className="font-mono">/portal</span> and is forced to set their own password.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Login Phone Number</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>{hasLogin ? "New Temporary Password" : "Temporary Password (optional)"}</Label>
              <Input type="password" value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} placeholder="Blank = default" />
            </div>
            <div className="space-y-2">
              <Label>Confirm</Label>
              <Input type="password" value={confirmTemp} onChange={(e) => setConfirmTemp(e.target.value)} placeholder="Re-enter password" />
            </div>
          </div>
          {result ? (
            <div className="rounded-lg border border-success/40 bg-success/10 p-3 text-xs space-y-1">
              <p><span className="text-muted-foreground">Login at:</span> <span className="font-mono font-semibold">/portal</span></p>
              <p><span className="text-muted-foreground">Phone:</span> <span className="font-mono font-semibold">{result.phone}</span></p>
              <p><span className="text-muted-foreground">Temporary password:</span> <span className="font-mono font-semibold">{result.tempPassword}</span></p>
              <p className="text-muted-foreground pt-1">The patient must set their own password on next login. Every change is audit-logged with date and time.</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Leave blank to use the default temporary password. The patient is always forced to set their own on next login.</p>
          )}
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving || checking}>{saving ? "Saving…" : hasLogin ? "Set New Password" : "Issue Portal Access"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientEditNextVisitDialog({ open, onOpenChange, appointment }: { open: boolean; onOpenChange: (v: boolean) => void; appointment: Appointment | null }) {
  const { toast } = useToast();
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [saving, setSaving] = useState(false);
  const prevId = useState<string | null>(null);

  if (appointment && appointment.id !== prevId[0]) {
    prevId[1](appointment.id);
    setDate(appointment.date);
    setTime(appointment.time);
  }

  const handleSubmit = async () => {
    if (!appointment || !date || !time) return;
    setSaving(true);
    try {
      const res = await fetchWithRetry("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: appointment.id, date, time }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update.");
      }
      const saved = await res.json();
      updateAppointment(appointment.id, saved);
      setSaving(false);
      toast({ title: "Visit Rescheduled", description: `Visit moved to ${date} at ${time}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule Visit</DialogTitle>
          <DialogDescription>Change the date/time for {appointment?.patientName}&apos;s visit</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">Current: <span className="font-medium text-foreground">{appointment?.date} at {appointment?.time}</span></p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>New Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>New Time</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Reschedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleNextVisitDialog({ open, onOpenChange, patient, lastAppointment }: { open: boolean; onOpenChange: (v: boolean) => void; patient: Patient; lastAppointment: Appointment | null }) {
  const { toast } = useToast();
  const addAppointment = useAppStore((s) => s.addAppointment);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [reason, setReason] = useState("Follow-up checkup");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!date || !time) {
      toast({ title: "Missing fields", description: "Date and time are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const newApt = {
        id: `a${Date.now()}`,
        token: "",
        patientId: patient.id,
        patientName: patient.name,
        patientPhoto: patient.photo,
        doctorId: lastAppointment?.doctorId || patient.doctorId || "",
        doctorName: lastAppointment?.doctorName || patient.doctorName || "",
        department: lastAppointment?.department || "",
        date,
        time,
        type: "Walk-in" as const,
        status: "Follow Up" as const,
        reason,
        waitingTime: 0,
        branch: patient.branch,
        reminderMinutesBefore: 30,
      };
      const res = await fetchWithRetry("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newApt),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to schedule.");
      }
      const saved = await res.json();
      addAppointment(saved);
      setSaving(false);
      toast({ title: "Next Visit Scheduled", description: `${patient.name} — ${date} at ${time} with ${newApt.doctorName || "doctor"}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule Next Visit</DialogTitle>
          <DialogDescription>Book the next follow-up for {patient.name}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {lastAppointment && (
            <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-xs">
              <p className="font-medium text-success">Last visit completed: {lastAppointment.date} at {lastAppointment.time}</p>
              <p className="text-muted-foreground">with {lastAppointment.doctorName} — {lastAppointment.department}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Next Date *</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-2"><Label>Time *</Label><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Follow-up checkup" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? "Scheduling..." : "Schedule Visit"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PatientNursingSection({ patient }: { patient: Patient }) {
  const settings = useAppStore((s) => s.settings);
  const [vitals, setVitals] = useState<VitalsEntry[]>([]);
  const [aid, setAid] = useState<FirstAidEntry[]>([]);

  useEffect(() => {
    let live = true;
    (async () => {
      // Vitals: backend table first, synced-settings fallback.
      try {
        const r = await fetch(`/api/nurse-vitals?patientId=${encodeURIComponent(patient.id)}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) setVitals(data);
      } catch {
        if (live) setVitals(parseVitals(settings[vitalsKey(patient.id)]));
      }
      // First aid: backend filtered to this patient, settings fallback.
      try {
        const r = await fetch(`/api/nurse-firstaid?branch=${encodeURIComponent(patient.branch || "")}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setAid((data as FirstAidEntry[]).filter((f) => f.patientId === patient.id));
        }
      } catch {
        if (live) setAid(parseFirstAid(settings[NURSE_FIRSTAID_KEY]).filter((f) => f.patientId === patient.id));
      }
    })();
    return () => { live = false; };
  }, [patient.id, patient.branch, settings]);

  if (vitals.length === 0 && aid.length === 0) {
    return (
      <div className="py-12 text-center">
        <HeartPulse className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <p className="text-sm font-medium">No nursing checks yet</p>
        <p className="text-xs text-muted-foreground mt-1">Vitals, status checks and first aid recorded by nurses will appear here.</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {vitals.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vitals & Status ({vitals.length})</p>
          {vitals.map((v) => (
            <div key={v.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${conditionStyles(v.condition)}`}>{v.condition}</Badge>
                <span className="text-[11px] text-muted-foreground">{new Date(v.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} • {v.nurse}</span>
              </div>
              <p className="text-xs mt-1.5">
                {[v.bpSys && `BP ${v.bpSys}/${v.bpDia}`, v.pulse && `Pulse ${v.pulse}`, v.temp && `Temp ${v.temp}°F`, v.spo2 && `SpO₂ ${v.spo2}%`, v.sugar && `Sugar ${v.sugar}`].filter(Boolean).join(" • ") || "No vitals recorded"}
              </p>
              {v.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{v.notes}</p>}
            </div>
          ))}
        </div>
      )}
      {aid.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">First Aid ({aid.length})</p>
          {aid.map((f) => (
            <div key={f.id} className="rounded-lg border p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-semibold flex-1">{f.kind}{f.bedNumber ? ` • Bed ${f.bedNumber}` : ""}</p>
                {(f.amount ?? 0) > 0 && <Badge variant="outline" className="text-[10px]">₹{(f.amount ?? 0).toLocaleString("en-IN")}{Math.max(0, (f.amount ?? 0) - (f.paidAmount ?? 0)) > 0 ? ` • Due ₹${Math.max(0, (f.amount ?? 0) - (f.paidAmount ?? 0)).toLocaleString("en-IN")}` : " • Paid"}</Badge>}
              </div>
              {f.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{f.notes}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">{f.nurse} • {new Date(f.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const allPatients = useAppStore((s) => s.patients);
  const currentUser = useAppStore((s) => s.currentUser);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const opExpiryDays = parseInt(useAppStore((s) => s.settings.opExpiryDays ?? "30")) || 0;
  const settings = useAppStore((s) => s.settings);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const { toast } = useToast();
  const { appointments, invoices, labTests, radiologyOrders } = useBranchData();
  const medicalRecords = useAppStore((s) => s.medicalRecords);
  const [rxList, setRxList] = useState<Prescription[]>([]);
  const patients = useMemo(() => {
    const branch = isAdmin(currentUser.role) ? activeBranch : currentUser.branch;
    return allPatients.filter((p) => sameBranch(p.branch, branch));
  }, [allPatients, currentUser.role, currentUser.branch, activeBranch]);
  const patient = patients.find((p) => p.id === patientId)!;
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/prescriptions?patientId=${patientId}`);
        if (res.ok && !cancelled) setRxList(await res.json());
      } catch {
        // Prescriptions table may predate migration 006.
      }
    })();
    return () => { cancelled = true; };
  }, [patientId]);

  const patientAppointments = useMemo(
    () => appointments
      .filter((a) => a.patientId === patient.id)
      .sort((x, y) => (y.date + y.time).localeCompare(x.date + x.time)),
    [appointments, patient.id]
  );
  const patientInvoices = useMemo(
    () => invoices.filter((i) => i.patientId === patient.id),
    [invoices, patient.id]
  );
  const totalBilled = patientInvoices.reduce((s, i) => s + (i.total || 0), 0);
  const outstanding = patientInvoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);
  const lastVisitDate = patientAppointments[0]?.date || patient.lastVisit || "";
  const [editVisitTarget, setEditVisitTarget] = useState<Appointment | null>(null);
  const [scheduleNextOpen, setScheduleNextOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Appointment | null>(null);
  const [acting, setActing] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const deleteAppointment = useAppStore((s) => s.deleteAppointment);
  // Cancel/delete permission: Admin + Receptionist on any visit, doctors only
  // on visits where they are the assigned doctor.
  const canManageVisit = (apt: Appointment) => canManageAppointment(currentUser.role, currentUser.name, apt);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);
  const openDocPreview = (doc: ReportDoc, onDownload: () => void) => {
    setViewDoc(doc);
    viewDownloadRef.current = onDownload;
  };
  const updateAppointment = useAppStore((s) => s.updateAppointment);

  // Manual visit flow: staff marks the visit completed (optionally booking the
  // next one right away), or cancels the schedule anytime. Nothing auto-runs.
  const markCompleted = async (apt: Appointment) => {
    setCompletingId(apt.id);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: apt.id, status: "Completed", ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      if (!res.ok) throw new Error("Failed");
      updateAppointment(apt.id, await res.json());
      toast({ title: "Visit Completed", description: `${apt.token} marked completed. Book the next visit below.` });
      setScheduleNextOpen(true);
    } catch {
      toast({ title: "Could not complete visit", variant: "destructive" });
    } finally {
      setCompletingId(null);
    }
  };

  const confirmCancel = async () => {
    if (!cancelTarget || acting) return;
    setActing(true);
    try {
      const res = await fetch("/api/appointments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: cancelTarget.id, status: "Cancelled", cancelledBy: currentUser.name, cancelReason: cancelReason.trim(), ...scheduleActor(currentUser.role, currentUser.name) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      updateAppointment(cancelTarget.id, await res.json());
      useAppStore.getState().addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action: "APPOINTMENT_CANCELLED", target: cancelTarget.token, branch: patient.branch, details: `${currentUser.name} cancelled visit ${cancelTarget.token} for ${patient.name}${cancelReason.trim() ? `: ${cancelReason.trim()}` : ""}.` });
      toast({ title: "Schedule Cancelled", description: `${cancelTarget.token} cancelled — it stays in history as Cancelled.` });
      setCancelTarget(null);
      setCancelReason("");
    } catch (e: any) {
      toast({ title: "Could not cancel schedule", description: e.message, variant: "destructive" });
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed");
      }
      deleteAppointment(deleteTarget.id);
      useAppStore.getState().addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action: "APPOINTMENT_DELETED", target: deleteTarget.token, branch: patient.branch, details: `${currentUser.name} deleted visit ${deleteTarget.token} for ${patient.name} (${deleteTarget.date} at ${deleteTarget.time}).` });
      toast({ title: "Visit Deleted", description: `${deleteTarget.token} removed permanently.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete visit", description: e.message, variant: "destructive" });
    } finally {
      setActing(false);
    }
  };
  const [qrOpen, setQrOpen] = useState(false);

  // Styled OP patient file (branded header + demographics + visits + billing) → print / Save as PDF.
  const handleExport = () => {
    if (!printOPSummary(patient, patientAppointments, patientInvoices, settings)) {
      toast({ title: "Popup blocked", description: "Allow popups for this site to export the patient record.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </Button>

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-info/15 to-primary/10" />
        <CardContent className="p-6 -mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold h-full">{patient.photo}</AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{patient.name}</h1>
                  <StatusBadge status={patient.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{patient.uhid} • {patient.gender}, {patient.age} years • {patient.bloodGroup}</p>
                {patient.doctorName && (
                  <p className="text-xs mt-1"><span className="text-muted-foreground">Assigned Doctor:</span> <span className="font-medium text-foreground">{patient.doctorName}</span>{typeof patient.opFees === "number" && patient.opFees > 0 ? <span className="text-muted-foreground"> • OP Fees ₹{patient.opFees}{patient.opDate ? ` on ${patient.opDate}` : ""}</span> : null}</p>
                )}
                {patient.opDate && opExpiryDays > 0 && (() => {
                  const expiry = addDaysIso(patient.opDate, opExpiryDays);
                  const expired = expiry && expiry < new Date().toISOString().split("T")[0];
                  return (
                    <p className="text-xs mt-1">
                      <span className="text-muted-foreground">OP Expiry:</span>{" "}
                      <span className={`font-medium ${expired ? "text-destructive" : "text-success"}`}>
                        {expiry || "—"}{expired ? " (Expired)" : " (Valid)"}
                      </span>
                      <span className="text-muted-foreground"> • {opExpiryDays}-day validity set by Admin</span>
                    </p>
                  );
                })()}
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {patient.address}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setQrOpen(true)}>
                <QrCode className="h-3.5 w-3.5" /> QR Code
              </Button>
              <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                <FileText className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" className="gap-2" onClick={() => { setActiveModule("appointments"); toast({ title: "Book a new appointment", description: `for ${patient.name}` }); }}>
                <Plus className="h-3.5 w-3.5" /> New Visit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Visits" value={patientAppointments.length.toString()} icon={Calendar} color="primary" subtitle="Booked appointments" />
        <StatCard title="Last Visit" value={lastVisitDate || "—"} icon={Activity} color="info" subtitle="Most recent" />
        <StatCard title="Total Billed" value={`₹${totalBilled.toLocaleString("en-IN")}`} icon={Receipt} color="success" subtitle={`${patientInvoices.length} invoices`} />
        <StatCard title="Outstanding" value={`₹${outstanding.toLocaleString("en-IN")}`} icon={CreditCard} color={outstanding > 0 ? "warning" : "success"} subtitle={outstanding > 0 ? "Dues pending" : "No dues"} />
      </div>

      <Tabs defaultValue="timeline">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="timeline">Patient Timeline</TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="nursing">Nursing</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Visit History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {patientAppointments.length === 0 ? (
                <div className="py-12 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No visits recorded yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Booked appointments for this patient will appear here.</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />
                  <div className="space-y-1">
                    {patientAppointments.map((event, idx) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="relative flex gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary/10 text-primary">
                          <Stethoscope className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{event.token} • {event.department || event.type}</p>
                            <StatusBadge status={event.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{event.reason || "Visit"}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {event.date} {event.time}</span>
                            {event.doctorName && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {event.doctorName}</span>}
                            {canManageVisit(event) && ["Scheduled", "Follow Up", "Checked-in"].includes(event.status) && (
                              <button
                                className="flex items-center gap-1 font-medium text-warning hover:underline"
                                onClick={(e) => { e.stopPropagation(); setCancelTarget(event); setCancelReason(""); }}
                                title="Cancel this visit (stays in history as Cancelled)"
                              >
                                <X className="h-3 w-3" /> Cancel
                              </button>
                            )}
                            {canManageVisit(event) && (
                              <button
                                className="flex items-center gap-1 font-medium text-destructive hover:underline"
                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(event); }}
                                title="Delete this visit permanently (for duplicate bookings)"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground mb-3">CARE WORKFLOW</p>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {["Appointment", "Consultation", "Prescription", "Lab", "Radiology", "Billing", "Payment", "Follow-up"].map((step, i, arr) => (
                    <div key={step} className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1">
                        <span className="text-[10px] font-semibold text-primary">{i + 1}</span>
                        <span className="text-[11px] font-medium">{step}</span>
                      </div>
                      {i < arr.length - 1 && <div className="h-px w-3 bg-primary/30" />}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="medical" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Allergies & Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.allergies.length > 0 ? (
                  patient.allergies.map((a) => (
                    <div key={a} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium">{a}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No known allergies</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Chronic Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.chronicDiseases.length > 0 ? (
                  patient.chronicDiseases.map((d) => (
                    <div key={d} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <Heart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{d}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No chronic conditions</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-info" /> Insurance & Emergency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium">{patient.insuranceProvider}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Policy Number</span>
                      <span className="font-mono text-xs">{patient.insurancePolicy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Branch</span>
                      <span className="font-medium">{patient.branch}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Emergency Contact</span>
                      <span className="font-medium">{patient.emergencyContact}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registered On</span>
                      <span className="font-medium">{patient.registeredOn}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right text-xs">{patient.address}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="followups" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Checkup Schedule & Follow-ups
                </CardTitle>
                <Button size="sm" className="gap-2" onClick={() => setScheduleNextOpen(true)}>
                  <Plus className="h-3.5 w-3.5" /> Schedule Next Visit
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {patientAppointments.length === 0 ? (
                <div className="py-8 text-center">
                  <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No visits scheduled</p>
                  <p className="text-xs text-muted-foreground mt-1">Click &quot;Schedule Next Visit&quot; to book the first checkup.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {patientAppointments.map((apt, idx) => {
                    const isUpcoming = apt.status === "Scheduled" || apt.status === "Follow Up";
                    const isCompleted = apt.status === "Completed";
                    const isMissed = apt.status === "No-show" || apt.status === "Cancelled";
                    return (
                      <div
                        key={apt.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 ${
                          isCompleted ? "bg-success/5 border-success/20" :
                          isMissed ? "bg-destructive/5 border-destructive/20" :
                          isUpcoming ? "bg-primary/5 border-primary/20" :
                          "bg-muted/50 border-border"
                        }`}
                      >
                        <span className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCompleted ? "bg-success/20 text-success" :
                          isMissed ? "bg-destructive/20 text-destructive" :
                          isUpcoming ? "bg-primary/20 text-primary" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {patientAppointments.length - idx}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{apt.date} at {apt.time}</p>
                            <StatusBadge status={apt.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {apt.doctorName && <span>{apt.doctorName}</span>}
                            {apt.department && <span> — {apt.department}</span>}
                            {apt.reason && <span> — {apt.reason}</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {isUpcoming && (
                            <>
                              <Button size="sm" className="h-7 text-[11px] gap-1 bg-success hover:bg-success/90" onClick={() => markCompleted(apt)} disabled={completingId === apt.id}>
                                <Check className="h-2.5 w-2.5" /> {completingId === apt.id ? "Saving..." : "Complete"}
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setEditVisitTarget(apt)}>
                                <Pencil className="h-2.5 w-2.5" /> Reschedule
                              </Button>
                            {canManageVisit(apt) && (
                              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-warning hover:bg-warning/10" onClick={() => { setCancelTarget(apt); setCancelReason(""); }}>
                                <X className="h-2.5 w-2.5" /> Cancel
                              </Button>
                            )}
                            {canManageVisit(apt) && (
                              <Button size="sm" variant="ghost" className="h-7 text-[11px] gap-1 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(apt)} title="Delete this visit permanently">
                                <Trash2 className="h-2.5 w-2.5" /> Delete
                              </Button>
                            )}
                            </>
                          )}
                          {isCompleted && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setScheduleNextOpen(true)}>
                              <Plus className="h-2.5 w-2.5" /> Follow-up
                            </Button>
                          )}
                          {isMissed && (
                            <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1" onClick={() => setEditVisitTarget(apt)}>
                              <Pencil className="h-2.5 w-2.5" /> Reschedule
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Medical Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const records = medicalRecords.filter((r) => r.patientId === patient.id);
                const labs = labTests.filter((t) => t.patientId === patient.id);
                const rads = radiologyOrders.filter((r) => r.patientId === patient.id);
                const medItems = patientInvoices.flatMap((inv) =>
                  (inv.items ?? []).filter((it) => it.category === "Pharmacy").map((it) => ({ inv, it }))
                );
                const popupToast = () => toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the document.", variant: "destructive" });
                if (records.length === 0 && labs.length === 0 && rads.length === 0 && medItems.length === 0 && rxList.length === 0) {
                  return (
                    <div className="py-12 text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">No documents yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Lab reports, prescriptions, and scans will appear here once added.</p>
                    </div>
                  );
                }
                const DocRow = ({ icon: Icon, title, sub, onDownload, onView }: { icon: typeof FileText; title: string; sub: string; onDownload: () => void; onView?: () => void }) => (
                  <div className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/40 transition-colors">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <p className="text-xs text-muted-foreground truncate">{sub}</p>
                    </div>
                    {onView && <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="View (no download needed)" onClick={onView}><Eye className="h-3.5 w-3.5" /></Button>}
                    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Download / print" onClick={onDownload}><Download className="h-3.5 w-3.5" /></Button>
                  </div>
                );
                return (
                  <div className="space-y-4">
                    {records.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medical Records ({records.length})</p>
                        {records.map((r) => (
                          <DocRow key={r.id} icon={FileText} title={r.title || r.type} sub={`${r.type} • ${r.doctor || "—"} • ${r.recordDate}`} onView={() => openDocPreview(buildMedicalRecordHtml(r, patient, settings), () => { if (!printMedicalRecord(r, patient, settings)) popupToast(); })} onDownload={() => { if (!printMedicalRecord(r, patient, settings)) popupToast(); }} />
                        ))}
                      </div>
                    )}
                    {labs.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Lab Reports ({labs.length})</p>
                        {labs.map((t) => (
                          <DocRow key={t.id} icon={FlaskConical} title={t.test} sub={`${t.category} • ${t.status} • ${(t.orderedOn || "").split("T")[0]}`} onView={() => openDocPreview(buildLabReportHtml(t, patient, settings), () => { if (!printLabReport(t, patient, settings)) popupToast(); })} onDownload={() => { if (!printLabReport(t, patient, settings)) popupToast(); }} />
                        ))}
                      </div>
                    )}
                    {rads.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Radiology Reports ({rads.length})</p>
                        {rads.map((r) => (
                          <DocRow key={r.id} icon={ScanLine} title={`${r.modality} — ${r.region}`} sub={`${r.status} • ${(r.orderedOn || "").split("T")[0]}`} onView={() => openDocPreview(buildRadiologyReportHtml(r, patient, settings), () => { if (!printRadiologyReport(r, patient, settings)) popupToast(); })} onDownload={() => { if (!printRadiologyReport(r, patient, settings)) popupToast(); }} />
                        ))}
                      </div>
                    )}
                    {medItems.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dispensed Medicines ({medItems.length})</p>
                        {medItems.map(({ inv, it }, idx) => (
                          <DocRow key={`${inv.id}-${idx}`} icon={Pill} title={it.description} sub={`${inv.date} • Bill ${inv.invoiceNo} • ₹${(it.amount || 0).toLocaleString("en-IN")} • ${inv.status}`} onView={() => setViewInvoice(inv)} onDownload={() => { if (!printInvoice(inv, settings, patient)) popupToast(); }} />
                        ))}
                      </div>
                    )}
                    {rxList.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prescriptions ({rxList.length})</p>
                        {rxList.map((rx) => (
                          <div key={rx.id} className="rounded-lg border p-3">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium flex-1">{rx.diagnosis || "Prescription"} • {rx.date}</p>
                              <Badge variant="outline" className="text-[10px]">{rx.status}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground">Dr. {rx.doctorName || "—"}{rx.notes ? ` • ${rx.notes}` : ""}</p>
                            {rx.items.map((it, i) => (
                              <p key={i} className="text-xs mt-1">{it.medicineName} — {it.quantity} {it.unit === "Sheet" ? "sheet(s)" : "tab(s)"}{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" • ")}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nursing" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> Nursing Checks</CardTitle>
            </CardHeader>
            <CardContent>
              <PatientNursingSection patient={patient} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              {patientInvoices.length === 0 ? (
                <div className="py-12 text-center">
                  <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">No invoices yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Invoices generated for this patient will appear here.</p>
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[150px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {patientInvoices.map((inv) => {
                        const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                        return (
                          <TableRow key={inv.id} className="hover:bg-muted/40">
                            <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
                            <TableCell className="text-xs">{inv.date}</TableCell>
                            <TableCell className="text-xs">{inv.items?.length ?? 0} items</TableCell>
                            <TableCell className="text-right font-medium">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right text-xs">₹{(inv.paidAmount || 0).toLocaleString("en-IN")}</TableCell>
                            <TableCell><StatusBadge status={inv.status} /></TableCell>
                            <TableCell>
                              <div className="flex items-center gap-0.5">
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewInvoice(inv)} title="View bill"><Eye className="h-3.5 w-3.5" /></Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!printInvoice(inv, settings, patient)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the bill.", variant: "destructive" }); }} title="Download / print bill"><Download className="h-3.5 w-3.5" /></Button>
                                {outstanding > 0 && canCollectPayment(currentUser.role) && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => setCollectInvoice(inv)} title={`Collect outstanding ₹${outstanding.toLocaleString("en-IN")}`}>
                                    <Wallet className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      <PatientEditNextVisitDialog open={!!editVisitTarget} onOpenChange={(v) => { if (!v) setEditVisitTarget(null); }} appointment={editVisitTarget} />
      {cancelTarget && (
        <Dialog open={!!cancelTarget} onOpenChange={(v) => { if (!v && !acting) setCancelTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Cancel Schedule</DialogTitle><DialogDescription>Cancel the {cancelTarget.date} at {cancelTarget.time} visit ({cancelTarget.token}) for <strong>{cancelTarget.patientName}</strong>? It stays in history as <strong>Cancelled</strong>.</DialogDescription></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-2"><Label>Reason (optional)</Label><Input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Patient requested, duplicate booking" /></div>
            </div>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={acting}>Keep Schedule</Button></DialogClose><Button variant="destructive" onClick={confirmCancel} disabled={acting}>{acting ? "Cancelling…" : "Cancel Visit"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v && !acting) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Visit</DialogTitle><DialogDescription>Permanently delete {deleteTarget.token} — {deleteTarget.date} at {deleteTarget.time} with {deleteTarget.doctorName} for <strong>{deleteTarget.patientName}</strong>? This removes it from Supabase and history. Use for <strong>duplicate bookings</strong>; prefer Cancel otherwise.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline" disabled={acting}>Keep</Button></DialogClose><Button variant="destructive" onClick={confirmDeleteVisit} disabled={acting}>{acting ? "Deleting…" : "Delete Permanently"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <ScheduleNextVisitDialog open={scheduleNextOpen} onOpenChange={setScheduleNextOpen} patient={patient} lastAppointment={patientAppointments.find((a) => a.status === "Completed") ?? null} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Payment" />
      <InvoiceViewDialog invoice={viewInvoice} patient={patient} onOpenChange={(v) => { if (!v) setViewInvoice(null); }} />
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><QrCode className="h-4 w-4 text-primary" /> Patient ID</DialogTitle>
            <DialogDescription>Share or quote this unique code to look up {patient.name}.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-6 py-5 text-center">
              <p className="font-mono text-3xl font-bold tracking-widest text-foreground break-all">{patient.uhid}</p>
            </div>
            <p className="text-xs text-muted-foreground">Universal Health ID (UHID)</p>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" className="w-full">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
