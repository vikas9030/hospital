"use client";

import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Users, DollarSign, CalendarClock, BedDouble, LogOut, Activity,
  AlertTriangle, ShieldAlert, Pill, FlaskConical, ScanLine, TrendingUp,
  Heart, UserPlus, RefreshCw, LayoutDashboard, ArrowUpRight, ArrowDownRight,
  FolderOpen, Eye, Download, HeartPulse, Fingerprint,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, LineChart, Line,
} from "recharts";
import { useChartData } from "@/hooks/use-chart-data";
import { useBranchData } from "@/hooks/use-branch-data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";
import { canAddPatient, isAdmin, samePerson } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { ReportViewerDialog } from "@/components/shared/report-viewer";
import { printLabReport, printRadiologyReport, buildLabReportHtml, buildRadiologyReportHtml, type ReportDoc } from "@/lib/documents";
import type { Invoice, VitalsEntry, NurseAssignment, AttendanceRecord } from "@/lib/types";

const CHART_COLORS = {
  primary: "oklch(0.55 0.22 259)",
  success: "oklch(0.62 0.19 155)",
  warning: "oklch(0.72 0.18 70)",
  destructive: "oklch(0.58 0.24 27)",
  info: "oklch(0.6 0.13 230)",
};

function RegisterPatientDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addPatient = useAppStore((s) => s.addPatient);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", phone: "", gender: "", bloodGroup: "", email: "", address: "" });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.phone) {
      toast({ title: "Error", description: "Name and Phone are required", variant: "destructive" });
      return;
    }
    const id = `p${Date.now()}`;
    const uhid = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;
    const payload = {
      id, uhid, name: form.name, photo: form.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
      gender: (form.gender || "Other") as "Male" | "Female" | "Other", age: 0, phone: form.phone, email: form.email || "-",
      bloodGroup: form.bloodGroup || "O+", address: form.address || "-", emergencyContact: "-",
      insuranceProvider: "Self Pay", insurancePolicy: "-",
      allergies: [] as string[], chronicDiseases: [] as string[], status: "OPD" as const,
      lastVisit: new Date().toISOString().split("T")[0], registeredOn: new Date().toISOString().split("T")[0],
      branch: branchData.branch,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to register patient");
      }
      const saved = await res.json();
      addPatient(saved);
      toast({ title: "Success", description: `Patient ${form.name} registered successfully` });
      setForm({ name: "", phone: "", gender: "", bloodGroup: "", email: "", address: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not register patient", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Register Patient</DialogTitle><DialogDescription>Register a new patient in the hospital system</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Patient name" /></div>
          <div className="space-y-2"><Label>Phone *</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Gender</Label><Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger><SelectContent>{["Male", "Female", "Other"].map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Blood Group</Label><Select value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}><SelectTrigger><SelectValue placeholder="Select blood group" /></SelectTrigger><SelectContent>{["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email address" /></div>
        <div className="space-y-2"><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Residential address" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Registering…" : "Register"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DashboardModule() {
  const { setActiveModule } = useAppStore();
  const currentUser = useAppStore((s) => s.currentUser);
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const branchData = useBranchData();
  const { revenueTrend: revenueTrendData, patientGrowth: patientGrowthData, departmentPerformance: departmentPerformanceData } = useChartData();
  const [regPatientOpen, setRegPatientOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);

  // ---- My attendance snapshot (every staff dashboard) ----
  const [myAtt, setMyAtt] = useState<{ checkIn: string; checkOut: string; status: string; pct: number | null } | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const me = (branchData.staffMembers ?? []).find(
          (s: any) => (s.email || "").toLowerCase() === (currentUser.email || "").toLowerCase()
        ) as any;
        if (!me) return;
        const b = encodeURIComponent(branchData.branch || "");
        const res = await fetch(`/api/attendance?branch=${b}`);
        if (!res.ok) return;
        const rows = (await res.json()) as AttendanceRecord[];
        if (!live) return;
        const today = new Date().toISOString().split("T")[0];
        const mk = today.slice(0, 7);
        const mine = rows.filter((r) => r.staffId === me.id);
        const todayRow = mine.find((r) => r.date === today);
        const mRows = mine.filter((r) => (r.date || "").startsWith(mk));
        let pct: number | null = null;
        if (mRows.length > 0) {
          const [y, m] = mk.split("-").map(Number);
          const dim = new Date(y, m, 0).getDate();
          const elapsed = Math.min(new Date().getDate(), dim);
          const equiv = mRows.reduce((s, r) => s + (r.status === "Present" ? 1 : r.status === "Half Day" ? 0.5 : 0), 0);
          pct = elapsed > 0 ? Math.round((equiv / elapsed) * 100) : null;
        }
        setMyAtt({ checkIn: todayRow?.checkIn || "", checkOut: todayRow?.checkOut || "", status: todayRow?.status || "", pct });
      } catch {
        // Attendance widget is optional.
      }
    })();
    return () => { live = false; };
  }, [branchData.branch, branchData.staffMembers, currentUser.email]);

  // ---- Nurse rounds snapshot (own duties on the dashboard) ----
  const isNurseUser = currentUser.role === "Nurse";
  const [nurseSnap, setNurseSnap] = useState<{ mine: number; critical: string[]; unchecked: number; beds: number } | null>(null);
  useEffect(() => {
    if (!isNurseUser) return;
    let live = true;
    (async () => {
      try {
        const b = encodeURIComponent(branchData.branch || "");
        const [ar, vr] = await Promise.all([
          fetch(`/api/nurse-assignments?branch=${b}`),
          fetch(`/api/nurse-vitals?branch=${b}`),
        ]);
        if (!live) return;
        const assigns: NurseAssignment[] = ar.ok ? await ar.json().catch(() => []) : [];
        const vitals: VitalsEntry[] = vr.ok ? await vr.json().catch(() => []) : [];
        const me = (branchData.staffMembers ?? []).find(
          (s: any) => s.role === "Nurse" && (s.email || "").toLowerCase() === (currentUser.email || "").toLowerCase()
        ) as any;
        if (!me) {
          if (live) setNurseSnap({ mine: 0, critical: [], unchecked: 0, beds: 0 });
          return;
        }
        const mine = assigns.find((a) => a.nurseId === me.id);
        const docIds = mine?.doctorIds ?? [];
        const bedIds = mine?.bedIds ?? [];
        const wards = mine?.wards ?? [];
        const bedPatientIds = new Set(
          branchData.beds.filter((x) => bedIds.includes(x.id) || wards.includes(x.ward)).map((x) => x.patientId).filter(Boolean) as string[]
        );
        const scoped = branchData.patients.filter((p) => {
          const byId = p.doctorId && docIds.includes(p.doctorId);
          const byName = !!p.doctorName && branchData.doctors.filter((d) => docIds.includes(d.id)).some((d) => samePerson(d.name, p.doctorName));
          return byId || byName || bedPatientIds.has(p.id);
        });
        const latest = new Map<string, VitalsEntry>();
        for (const v of vitals) {
          if (!latest.has(v.patientId)) latest.set(v.patientId, v);
        }
        const critical = scoped.filter((p) => latest.get(p.id)?.condition === "Critical").map((p) => p.name);
        const unchecked = scoped.filter((p) => !latest.has(p.id)).length;
        const myBeds = branchData.beds.filter((x) => bedIds.includes(x.id) || wards.includes(x.ward)).length;
        setNurseSnap({ mine: scoped.length, critical, unchecked, beds: myBeds });
      } catch {
        if (live) setNurseSnap({ mine: 0, critical: [], unchecked: 0, beds: 0 });
      }
    })();
    return () => { live = false; };
  }, [isNurseUser, branchData.branch, branchData.staffMembers, branchData.beds, branchData.patients, currentUser.email]);

  // Latest lab + radiology reports across the branch, newest first.
  const latestReports = [
    ...branchData.labTests.map((t) => ({ kind: "lab" as const, id: t.id, title: t.test, patient: t.patientName, date: (t.orderedOn || "").split("T")[0], status: t.status, ref: t })),
    ...branchData.radiologyOrders.map((r) => ({ kind: "rad" as const, id: r.id, title: `${r.modality} — ${r.region}`, patient: r.patientName, date: (r.orderedOn || "").split("T")[0], status: r.status, ref: r })),
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

  const downloadReport = (entry: (typeof latestReports)[number]) => {
    const blocked = () => toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" });
    if (entry.kind === "lab") {
      const t = entry.ref;
      if (!printLabReport(t, branchData.patients.find((p) => p.id === t.patientId), settings)) blocked();
    } else {
      const r = entry.ref;
      if (!printRadiologyReport(r, branchData.patients.find((p) => p.id === r.patientId), settings)) blocked();
    }
  };

  const openReportPreview = (entry: (typeof latestReports)[number]) => {
    if (entry.kind === "lab") {
      const t = entry.ref;
      setViewDoc(buildLabReportHtml(t, branchData.patients.find((p) => p.id === t.patientId), settings));
      viewDownloadRef.current = () => { if (!printLabReport(t, branchData.patients.find((p) => p.id === t.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); };
    } else {
      const r = entry.ref;
      setViewDoc(buildRadiologyReportHtml(r, branchData.patients.find((p) => p.id === r.patientId), settings));
      viewDownloadRef.current = () => { if (!printRadiologyReport(r, branchData.patients.find((p) => p.id === r.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); };
    }
  };
  const showAddPatient = canAddPatient(currentUser.role);
  const isUserAdmin = isAdmin(currentUser.role);

  const todayStr = new Date().toISOString().split("T")[0];

  const todayAppointments = branchData.appointments.filter((a) => a.date === todayStr);
  const admittedPatients = branchData.patients.filter((p) => p.status === "Admitted");
  const dischargedPatients = branchData.patients.filter((p) => p.status === "Discharged");
  const emergencyBeds = branchData.beds.filter((b) => b.ward === "Emergency" && b.status === "Occupied").length;

  const todayRevenue = branchData.invoices
    .filter((i) => i.date === todayStr)
    .reduce((s, i) => s + (i.paidAmount || 0), 0);

  const pendingBills = branchData.invoices.filter((i) => i.status === "Pending" || i.status === "Partial" || i.status === "Overdue");
  const pendingBillsOutstanding = pendingBills.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);

  const moneyCollected = branchData.invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);

  const pendingInsuranceClaims = branchData.insuranceClaims.filter((c) => c.status === "Pending" || c.status === "Pre-Auth");

  const pharmacyRevenue = branchData.invoices
    .reduce((s, inv) => s + inv.items.filter((it) => it.category === "Pharmacy").reduce((is, it) => is + it.amount, 0), 0);

  const pendingLabReports = branchData.labTests.filter((t) => !t.reportReady);

  const claimsByStatus = ["Approved", "Pending", "Rejected", "Settled"].map((status) => ({
    status,
    count: branchData.insuranceClaims.filter((c) => c.status === status).length,
  }));

  const pharmacySalesTrend = (() => {
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const map = new Map<string, { month: string; sales: number }>();
    for (const inv of branchData.invoices) {
      if (!inv.date) continue;
      const [y, m] = inv.date.split("-");
      const label = `${monthNames[parseInt(m, 10) - 1] ?? m} ${String(y).slice(2)}`;
      const entry = map.get(label) ?? { month: label, sales: 0 };
      entry.sales += inv.items.filter((it) => it.category === "Pharmacy").reduce((s, it) => s + (it.amount || 0), 0);
      map.set(label, entry);
    }
    return Array.from(map.values());
  })();

  const opdPatients = branchData.patients.filter((p) => p.status === "OPD").length;
  const ipdPatients = branchData.patients.filter((p) => p.status === "Admitted").length;
  const opdIpdTotal = opdPatients + ipdPatients || 1;
  const opdPercent = Math.round((opdPatients / opdIpdTotal) * 100);
  const ipdPercent = 100 - opdPercent;

  const avgDoctorRating = branchData.doctors.length > 0
    ? (branchData.doctors.reduce((s, d) => s + d.rating, 0) / branchData.doctors.length).toFixed(1)
    : "0";

  const pendingRadiology = branchData.radiologyOrders.filter((r) => r.status === "Ordered" || r.status === "In Progress").length;

  const lowStockMedicines = branchData.medicines.filter((m) => m.status === "Low Stock" || m.status === "Out of Stock").length;

  const referralPatients = branchData.leads.filter((l) => l.source === "Referral").length;

  const bedOccupancy = branchData.beds.filter((b) => b.status === "Occupied").length;
  const bedTotal = branchData.beds.length;
  const occupancyRate = bedTotal > 0 ? Math.round((bedOccupancy / bedTotal) * 100) : 0;

  const availableDoctors = branchData.doctors.filter((d) => d.availability === "Available").length;

  const fmtLakh = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${n.toLocaleString("en-IN")}`;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadFromSupabase();
      toast({ title: "Dashboard refreshed" });
    } finally {
      setRefreshing(false);
    }
  };

  const handleGenerateReport = () => {
    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to generate the report", variant: "destructive" });
      return;
    }
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const hospitalName = settings.hospitalName || settings.invoiceHospitalName || "MediCore Hospital";
    const generatedAt = new Date().toLocaleString("en-IN");

    const apptScheduled = todayAppointments.filter((a) => a.status === "Scheduled").length;
    const apptCheckedIn = todayAppointments.filter((a) => a.status === "Checked-in").length;
    const apptInConsult = todayAppointments.filter((a) => a.status === "In Consultation").length;
    const apptCompleted = todayAppointments.filter((a) => a.status === "Completed").length;
    const apptCancelled = todayAppointments.filter((a) => a.status === "Cancelled").length;
    const leadsValue = branchData.leads.reduce((s, l) => s + l.estimatedValue, 0);

    const section = (title: string, rows: [string, string][]) => `
      <div class="section">
        <h2>${esc(title)}</h2>
        <table><tbody>
          ${rows.map(([k, v]) => `<tr><td class="k">${esc(k)}</td><td class="v">${esc(v)}</td></tr>`).join("")}
        </tbody></table>
      </div>`;

    const overview = section("Overview", [
      ["Total Patients", String(branchData.patients.length)],
      ["Appointments Today", String(todayAppointments.length)],
      ["Admissions", String(admittedPatients.length)],
      ["Discharges", String(dischargedPatients.length)],
      ["Emergency Beds Occupied", String(emergencyBeds)],
    ]);

    const appointments = section("Appointment Status (Today)", [
      ["Scheduled", String(apptScheduled)],
      ["Checked-in", String(apptCheckedIn)],
      ["In Consultation", String(apptInConsult)],
      ["Completed", String(apptCompleted)],
      ["Cancelled", String(apptCancelled)],
      ["Total", String(todayAppointments.length)],
    ]);

    const capacity = section("Capacity & Staff", [
      ["Bed Occupancy", `${occupancyRate}% (${bedOccupancy}/${bedTotal})`],
      ["Available Doctors", `${availableDoctors}/${branchData.doctors.length}`],
      ["OPD vs IPD", `${opdPercent}% / ${ipdPercent}%`],
      ["Avg. Doctor Rating", `${avgDoctorRating} / 5.0`],
    ]);

    const operations = section("Operations", [
      ["Pending Lab Reports", String(pendingLabReports.length)],
      ["Radiology Queue", `${pendingRadiology} pending`],
      ["Low Stock Medicines", `${lowStockMedicines} items`],
      ["New Leads", String(branchData.leads.length)],
      ["Referral Patients", String(referralPatients)],
    ]);

    const financials = isUserAdmin
      ? section("Financials", [
          ["Today's Revenue", fmtLakh(todayRevenue)],
          ["Pharmacy Sales", fmtLakh(pharmacyRevenue)],
          ["Pending Bills", `${pendingBills.length} (${fmtLakh(pendingBillsOutstanding)} outstanding)`],
          ["Insurance Claims Pending", String(pendingInsuranceClaims.length)],
          ["Leads Est. Value", fmtLakh(leadsValue)],
        ])
      : "";

    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Dashboard Report — ${esc(branchData.branch)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 32px; max-width: 800px; margin: 0 auto; }
      .head { text-align: center; border-bottom: 3px solid #111827; padding-bottom: 14px; margin-bottom: 20px; }
      .hname { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
      .hsub { font-size: 13px; color: #6b7280; margin-top: 4px; }
      .hmeta { font-size: 12px; color: #9ca3af; margin-top: 6px; }
      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
      .section { break-inside: avoid; }
      h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 6px; margin: 0 0 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 13px; }
      td { padding: 6px 2px; border-bottom: 1px solid #f1f5f9; }
      td.k { color: #6b7280; }
      td.v { text-align: right; font-weight: 700; }
      .foot { margin-top: 28px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #d1d5db; padding-top: 12px; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="head">
        <div class="hname">${esc(hospitalName)}</div>
        <div class="hsub">Dashboard Report — ${esc(branchData.branch)}</div>
        <div class="hmeta">Generated ${esc(generatedAt)}</div>
      </div>
      <div class="grid">
        ${overview}
        ${appointments}
        ${capacity}
        ${operations}
        ${financials}
      </div>
      <div class="foot">Generated from the ${esc(branchData.branch)} dashboard${isUserAdmin ? "" : " • Financial figures hidden"}.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={`Welcome back, Dr. Aditya! Here's what's happening at ${branchData.branch} today.`}
        icon={LayoutDashboard}
        action={
          <>
            {showAddPatient && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setRegPatientOpen(true)}>
                <UserPlus className="h-3.5 w-3.5" /> Add Patient
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button size="sm" className="gap-2" onClick={handleGenerateReport}>
              <TrendingUp className="h-3.5 w-3.5" /> Generate Report
            </Button>
          </>
        }
      />

      {/* Stat Widgets Row 1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Today's Patients" value={branchData.patients.length.toString()} icon={Users} color="primary" delay={0} />
        {isUserAdmin && <StatCard title="Today's Revenue" value={fmtLakh(todayRevenue)} icon={DollarSign} color="success" delay={0.05} />}
        <StatCard title="Appointments" value={todayAppointments.length.toString()} icon={CalendarClock} color="info" delay={0.1} />
        <StatCard title="Admissions" value={admittedPatients.length.toString()} icon={Activity} color="warning" delay={0.15} />
        <StatCard title="Discharges" value={dischargedPatients.length.toString()} icon={LogOut} color="success" delay={0.2} />
        <StatCard title="Emergency" value={emergencyBeds.toString()} icon={AlertTriangle} color="destructive" delay={0.25} />
      </div>

      {/* Stat Widgets Row 2 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Doctor Availability" value={`${availableDoctors}/${branchData.doctors.length}`} icon={Heart} color="primary" subtitle="Available now" delay={0.3} />
        <StatCard title="Bed Occupancy" value={`${occupancyRate}%`} icon={BedDouble} color="warning" subtitle={`${bedOccupancy}/${bedTotal} occupied`} delay={0.35} />
        {isUserAdmin && <StatCard title="Pending Bills" value={pendingBills.length.toString()} icon={ShieldAlert} color="destructive" subtitle={fmtLakh(pendingBillsOutstanding) + " outstanding"} delay={0.4} />}
        {isUserAdmin && <StatCard title="Insurance Claims" value={pendingInsuranceClaims.length.toString()} icon={ShieldAlert} color="warning" subtitle="Pending approval" delay={0.45} />}
        {isUserAdmin && <StatCard title="Pharmacy Sales" value={fmtLakh(pharmacyRevenue)} icon={Pill} color="success" delay={0.5} />}
        <StatCard title="Lab Reports" value={pendingLabReports.length.toString()} icon={FlaskConical} color="info" subtitle="Pending" delay={0.55} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Clinical Links</CardTitle>
          <CardDescription className="text-xs">Open linked clinical modules directly from the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Laboratory", module: "laboratory" as const, icon: FlaskConical, metric: `${pendingLabReports.length} pending` },
              { label: "Pharmacy", module: "pharmacy" as const, icon: Pill, metric: `${lowStockMedicines} low stock` },
              { label: "Radiology", module: "radiology" as const, icon: ScanLine, metric: `${pendingRadiology} pending` },
              { label: "Medical Records", module: "records" as const, icon: FolderOpen, metric: `${branchData.patients.length} patients` },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Button key={item.module} variant="outline" className="h-auto justify-start gap-3 p-3" onClick={() => setActiveModule(item.module)}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 text-left">
                    <span className="block text-sm font-semibold truncate">{item.label}</span>
                    <span className="block text-xs text-muted-foreground truncate">{item.metric}</span>
                  </span>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* My Attendance — every staff dashboard */}
      {myAtt && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-3 sm:p-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
            <span className="font-semibold text-sm flex items-center gap-2"><Fingerprint className="h-4 w-4 text-primary" /> My Attendance Today</span>
            {myAtt.status ? (
              <>
                <Badge variant="outline" className="text-[11px]">{myAtt.status}</Badge>
                <span>In <strong>{myAtt.checkIn || "—"}</strong></span>
                <span>Out <strong>{myAtt.checkOut || "—"}</strong></span>
                {myAtt.pct !== null && <span>Month <strong>{myAtt.pct}%</strong></span>}
              </>
            ) : (
              <span className="text-muted-foreground">Not punched yet today.</span>
            )}
            <Button variant="outline" size="sm" className="text-xs ml-auto" onClick={() => setActiveModule("attendance")}>Open Attendance</Button>
          </CardContent>
        </Card>
      )}
      {/* My Nursing Rounds — nurse duties summary on the dashboard */}
      {isNurseUser && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><HeartPulse className="h-4 w-4 text-primary" /> My Nursing Rounds</CardTitle>
              <CardDescription className="text-xs">Your doctors, beds and patient checks — without leaving the dashboard</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setActiveModule("nursing")}>Open Nursing Station</Button>
          </CardHeader>
          <CardContent>
            {!nurseSnap ? (
              <p className="text-xs text-muted-foreground py-2">Loading your duties…</p>
            ) : nurseSnap.mine === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No patients assigned yet — ask Admin to assign you doctors, wards or beds in Nursing → Assign Nurses.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border bg-background p-2.5"><p className="text-lg font-bold">{nurseSnap.mine}</p><p className="text-[11px] text-muted-foreground">My patients</p></div>
                <div className="rounded-lg border bg-background p-2.5"><p className="text-lg font-bold">{nurseSnap.beds}</p><p className="text-[11px] text-muted-foreground">My beds</p></div>
                <div className="rounded-lg border bg-background p-2.5"><p className="text-lg font-bold">{nurseSnap.unchecked}</p><p className="text-[11px] text-muted-foreground">Not checked yet</p></div>
                <div className="rounded-lg border bg-background p-2.5">
                  <p className={`text-lg font-bold ${nurseSnap.critical.length > 0 ? "text-destructive" : ""}`}>{nurseSnap.critical.length}</p>
                  <p className="text-[11px] text-muted-foreground truncate" title={nurseSnap.critical.join(", ")}>Critical{nurseSnap.critical.length > 0 ? `: ${nurseSnap.critical.slice(0, 2).join(", ")}${nurseSnap.critical.length > 2 ? "…" : ""}` : ""}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Trend - Admin Only */}
        {isUserAdmin ? (
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Revenue Trend</CardTitle>
                <CardDescription className="text-xs">Monthly revenue (OPD vs IPD)</CardDescription>
              </div>
              <Badge variant="outline" className="text-success border-success/20 bg-success/10">
                <ArrowUpRight className="h-3 w-3 mr-1" /> 18.2%
              </Badge>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueTrendData} margin={{ left: -20, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="opdGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.25} />
                      <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.008 240)", fontSize: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
                    formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                  />
                  <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#revGrad)" name="Total Revenue" />
                  <Area type="monotone" dataKey="opd" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#opdGrad)" name="OPD" />
                  <Area type="monotone" dataKey="ipd" stroke={CHART_COLORS.warning} strokeWidth={2} fill="none" name="IPD" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        ) : (
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Appointment Overview</CardTitle>
              <CardDescription className="text-xs">Today's appointment breakdown by status</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={[
                  { status: "Scheduled", count: branchData.appointments.filter(a => a.date === todayStr && a.status === "Scheduled").length },
                  { status: "Checked-in", count: branchData.appointments.filter(a => a.date === todayStr && a.status === "Checked-in").length },
                  { status: "In Consult.", count: branchData.appointments.filter(a => a.date === todayStr && a.status === "In Consultation").length },
                  { status: "Completed", count: branchData.appointments.filter(a => a.date === todayStr && a.status === "Completed").length },
                  { status: "Cancelled", count: branchData.appointments.filter(a => a.date === todayStr && a.status === "Cancelled").length },
                ]} margin={{ left: -20, right: 10, top: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} name="Appointments">
                    {[
                      CHART_COLORS.primary,
                      CHART_COLORS.warning,
                      CHART_COLORS.info,
                      CHART_COLORS.success,
                      CHART_COLORS.destructive,
                    ].map((c, i) => (
                      <Cell key={i} fill={c} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* OPD vs IPD Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OPD vs IPD</CardTitle>
            <CardDescription className="text-xs">Patient distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "OPD", value: opdPercent, fill: CHART_COLORS.primary },
                    { name: "IPD", value: ipdPercent, fill: CHART_COLORS.success },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {[CHART_COLORS.primary, CHART_COLORS.success].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.primary }} />
                <span className="text-xs text-muted-foreground">OPD <span className="font-semibold text-foreground">{opdPercent}%</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.success }} />
                <span className="text-xs text-muted-foreground">IPD <span className="font-semibold text-foreground">{ipdPercent}%</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Patient Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Patient Growth</CardTitle>
            <CardDescription className="text-xs">New patients per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={patientGrowthData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="new" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="New Patients" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Department Performance</CardTitle>
              <CardDescription className="text-xs">Patients treated by department</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("reports")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={departmentPerformanceData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="patients" radius={[6, 6, 0, 0]} name="Patients">
                  {departmentPerformanceData.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.destructive, CHART_COLORS.primary][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Appointment Trends */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Appointment Trends</CardTitle>
            <CardDescription className="text-xs">Weekly appointment statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={(() => {
                const days: { day: string; booked: number; completed: number; remaining: number }[] = [];
                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  const iso = d.toISOString().split("T")[0];
                  const dayAppts = branchData.appointments.filter((a) => a.date === iso);
                  days.push({
                    day: d.toLocaleDateString("en-US", { weekday: "short" }),
                    booked: dayAppts.length,
                    completed: dayAppts.filter((a) => a.status === "Completed").length,
                    remaining: dayAppts.filter((a) => a.status !== "Completed" && a.status !== "Cancelled" && a.status !== "No-show").length,
                  });
                }
                return days;
              })()} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="booked" stackId="a" fill={CHART_COLORS.primary} radius={[0, 0, 0, 0]} name="Booked" />
                <Bar dataKey="completed" stackId="b" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} name="Completed" />
                <Bar dataKey="remaining" stackId="c" fill={CHART_COLORS.warning} radius={[0, 0, 0, 0]} name="Remaining" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bed Occupancy Radial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bed Occupancy</CardTitle>
            <CardDescription className="text-xs">{bedOccupancy} of {bedTotal} beds occupied</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" barSize={14} data={[{ name: "Occupied", value: occupancyRate, fill: CHART_COLORS.warning }]}>
                <RadialBar background={{ fill: "oklch(0.93 0.008 240)" }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="mt-[-140px] mb-[100px] text-center">
              <p className="text-3xl font-bold">{occupancyRate}%</p>
              <p className="text-xs text-muted-foreground">Occupied</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <p className="text-sm font-semibold text-success">{branchData.beds.filter(b => b.status === "Available").length}</p>
                <p className="text-[10px] text-muted-foreground">Available</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-warning">{branchData.beds.filter(b => b.status === "Reserved").length}</p>
                <p className="text-[10px] text-muted-foreground">Reserved</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-destructive">{branchData.beds.filter(b => b.status === "Maintenance").length}</p>
                <p className="text-[10px] text-muted-foreground">Maint.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Today's Appointments + Recent Activity + Leads */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Today's Appointments</CardTitle>
              <CardDescription className="text-xs">Live queue & consultation status</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("appointments")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <div className="divide-y px-4">
                  {branchData.appointments.map((apt) => (
                    <div key={apt.id} className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                        {apt.patientPhoto}
                      </div>
                      <div className="min-w-0 flex-1 basis-32">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-semibold truncate">{apt.patientName}</p>
                          <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{apt.token}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{apt.doctorName} • {apt.department}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium whitespace-nowrap">{apt.time}</p>
                        <p className="text-[10px] text-muted-foreground">{apt.type}</p>
                      </div>
                      <StatusBadge status={apt.status} className="shrink-0 max-w-[110px] truncate" />
                    </div>
                  ))}
                </div>
              </ScrollArea>
          </CardContent>
        </Card>

        {/* Money Collection */}
        {isUserAdmin && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Money Collection</CardTitle>
              <CardDescription className="text-xs">
                Total collected: <span className="font-semibold text-success">₹{moneyCollected.toLocaleString("en-IN")}</span> • Outstanding: <span className="font-semibold text-destructive">₹{pendingBillsOutstanding.toLocaleString("en-IN")}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[320px]">
                <div className="divide-y px-4">
                  {pendingBills.length === 0 && (
                    <p className="py-6 text-sm text-muted-foreground text-center">No pending bills. All invoices are fully collected.</p>
                  )}
                  {pendingBills.map((inv) => {
                    const due = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                    return (
                      <div key={inv.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                        <div className="min-w-0 flex-1 basis-40">
                          <div className="flex items-center gap-2 min-w-0">
                            <p className="text-sm font-semibold truncate">{inv.patientName}</p>
                            <Badge variant="outline" className="text-[10px] h-4 px-1 shrink-0">{inv.invoiceNo}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Paid ₹{(inv.paidAmount || 0).toLocaleString("en-IN")} of ₹{(inv.total || 0).toLocaleString("en-IN")}{inv.paymentMethod ? ` • ${inv.paymentMethod}` : ""}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium text-destructive">₹{due.toLocaleString("en-IN")}</p>
                          <p className="text-[10px] text-muted-foreground">outstanding</p>
                        </div>
                        <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 max-w-full" onClick={() => setCollectInvoice(inv)}>
                          <DollarSign className="h-3 w-3 mr-1 shrink-0" /> <span className="truncate">Collect</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Recent Activity / Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Insights</CardTitle>
            <CardDescription className="text-xs">Key metrics today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Patient Satisfaction</span>
                <span className="text-xs font-semibold">{avgDoctorRating} / 5.0</span>
              </div>
              <Progress value={parseFloat(avgDoctorRating) * 20} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><ScanLine className="h-3 w-3" /> Radiology Queue</span>
                <span className="text-xs font-semibold">{pendingRadiology} pending</span>
              </div>
              <Progress value={branchData.radiologyOrders.length > 0 ? Math.round((pendingRadiology / branchData.radiologyOrders.length) * 100) : 0} className="h-1.5" />
            </div>
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Pill className="h-3 w-3" /> Low Stock Items</span>
                <span className={`text-xs font-semibold ${lowStockMedicines > 0 ? "text-destructive" : ""}`}>{lowStockMedicines} items</span>
              </div>
              <Progress value={branchData.medicines.length > 0 ? Math.round((lowStockMedicines / branchData.medicines.length) * 100) : 0} className="h-1.5" />
            </div>
            {/* New Leads */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus className="h-3 w-3" /> New Leads</p>
                  <p className="text-lg font-bold mt-0.5">{branchData.leads.length}</p>
                </div>
                {isUserAdmin && <div className="text-right">
                  <p className="text-xs text-muted-foreground">Est. Value</p>
                  <p className="text-sm font-semibold text-success">₹{(branchData.leads.reduce((s, l) => s + l.estimatedValue, 0) / 1000).toFixed(0)}K</p>
                </div>}
              </div>
            </div>
            {/* Referral Patients */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Referral Patients</p>
                  <p className="text-lg font-bold mt-0.5">{referralPatients}</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">
                  <ArrowUpRight className="h-3 w-3 mr-1" /> Active
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Latest Reports — view any lab/radiology report inline, no download needed */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">Latest Reports</CardTitle>
            <CardDescription className="text-xs">Newest lab & radiology reports — eye icon previews instantly</CardDescription>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("laboratory")}>Lab</Button>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("radiology")}>Radiology</Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {latestReports.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground text-center">No reports yet. Lab and radiology reports will appear here.</p>
          ) : (
            <div className="divide-y px-4">
              {latestReports.map((rep) => {
                const Icon = rep.kind === "lab" ? FlaskConical : ScanLine;
                return (
                  <div key={`${rep.kind}-${rep.id}`} className="flex items-center gap-3 py-2.5">
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${rep.kind === "lab" ? "bg-info/10 text-info" : "bg-warning/10 text-warning"}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold truncate">{rep.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{rep.patient} • {rep.date || "—"}</p>
                    </div>
                    <StatusBadge status={rep.status} className="shrink-0 max-w-[110px] truncate hidden sm:inline-flex" />
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openReportPreview(rep)} title="View report (no download needed)"><Eye className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => downloadReport(rep)} title="Download / print"><Download className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insurance + Pharmacy Charts - Admin Only */}
      {isUserAdmin && <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Insurance Claims Status</CardTitle>
            <CardDescription className="text-xs">Claims distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={claimsByStatus} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Claims">
                  {claimsByStatus.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.destructive, CHART_COLORS.info][i % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pharmacy Sales vs Purchases</CardTitle>
            <CardDescription className="text-xs">Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={pharmacySalesTrend} margin={{ left: -10, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Area type="monotone" dataKey="sales" stroke={CHART_COLORS.success} strokeWidth={2.5} fill="url(#salesGrad)" name="Pharmacy Sales" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>}
      <RegisterPatientDialog open={regPatientOpen} onOpenChange={setRegPatientOpen} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} />
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
    </div>
  );
}
