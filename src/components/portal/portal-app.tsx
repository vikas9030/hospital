"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  HeartPulse, CalendarDays, Pill, FlaskConical, Receipt, FileText,
  Download, LogOut, Lock, Phone, ScanLine, Stethoscope, Clock, Eye,
  AlertTriangle, CheckCircle2, Plus, IndianRupee, RefreshCw,
  Sparkles, ChevronRight, ShieldCheck, User, Bell,
} from "lucide-react";
import type {
  Patient, Appointment, Prescription, LabTest, RadiologyOrder, Invoice, MedicalRecord,
  Doctor, DoctorBranchSchedule, AppointmentRequest,
} from "@/lib/types";
import { isDoctorAvailableOn, weekdayOf } from "@/lib/utils";
import { formatSchedule } from "@/components/shared/schedule-builder";
import { useBranding } from "@/lib/branding";
import { printLabReport, printRadiologyReport, printMedicalRecord, buildLabReportHtml, buildRadiologyReportHtml, buildMedicalRecordHtml, type ReportDoc } from "@/lib/documents";
import { printInvoice, buildInvoiceHtml } from "@/lib/invoice-print";
import { ReportViewerDialog } from "@/components/shared/report-viewer";

const TOKEN_KEY = "medicore-portal-token";
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"];

interface PortalData {
  patient: Patient;
  mustChangePassword: boolean;
  appointments: Appointment[];
  prescriptions: Prescription[];
  labTests: LabTest[];
  radiologyOrders: RadiologyOrder[];
  invoices: Invoice[];
  medicalRecords: MedicalRecord[];
  requests: AppointmentRequest[];
  doctors: Doctor[];
  schedules: DoctorBranchSchedule[];
  clinic: { name: string; opExpiryDays: number };
}

type Screen = "loading" | "login" | "reset" | "dashboard";

function addDaysIso(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
function todayIso(): string {
  return new Date().toISOString().split("T")[0];
}
function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

const AVATAR_GRADS = [
  "from-teal-500 to-emerald-600",
  "from-sky-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export function PortalApp() {
  const { toast } = useToast();
  const [screen, setScreen] = useState<Screen>("loading");
  const [token, setToken] = useState("");
  const [data, setData] = useState<PortalData | null>(null);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [forceReset, setForceReset] = useState(true);
  const [bookTab, setBookTab] = useState("visits");
  const [refreshing, setRefreshing] = useState(false);
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);
  const openPreview = (doc: ReportDoc, onDownload: () => void) => {
    setViewDoc(doc);
    viewDownloadRef.current = onDownload;
  };

  const branding = useBranding();
  const [bookDoctorId, setBookDoctorId] = useState("");
  const [bookDate, setBookDate] = useState(todayIso());
  const [bookTime, setBookTime] = useState("10:00");
  const [bookReason, setBookReason] = useState("");
  const [booking, setBooking] = useState(false);

  const loadData = async (tok: string): Promise<PortalData | null> => {
    const res = await fetch(`/api/portal/data?token=${encodeURIComponent(tok)}`);
    if (res.status === 401) return null;
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Could not load your records.");
    }
    return res.json();
  };

  const refresh = async (silent = true) => {
    if (!token) return;
    if (!silent) setRefreshing(true);
    try {
      const d = await loadData(token);
      if (d) {
        setData(d);
        if (!silent) toast({ title: "Refreshed", description: "Your latest visits, reports and bills are shown." });
      }
    } catch {
      if (!silent) toast({ title: "Refresh failed", description: "Check your connection and try again.", variant: "destructive" });
    } finally {
      if (!silent) setRefreshing(false);
    }
  };

  useEffect(() => {
    (async () => {
      const stored = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
      if (!stored) { setScreen("login"); return; }
      try {
        const d = await loadData(stored);
        if (!d) { localStorage.removeItem(TOKEN_KEY); setScreen("login"); return; }
        setToken(stored);
        setData(d);
        setForceReset(d.mustChangePassword);
        setScreen(d.mustChangePassword ? "reset" : "dashboard");
      } catch {
        setScreen("login");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/portal/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Login failed.");
      localStorage.setItem(TOKEN_KEY, body.token);
      setToken(body.token);
      const d = await loadData(body.token);
      if (!d) throw new Error("Could not load your records.");
      setData(d);
      setForceReset(d.mustChangePassword);
      setScreen(d.mustChangePassword ? "reset" : "dashboard");
      toast(d.mustChangePassword
        ? { title: "First login", description: "Please set a new password to continue." }
        : { title: `Welcome back, ${d.patient.name.split(" ")[0]}!` });
    } catch (err: any) {
      toast({ title: "Login failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/portal/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword, currentPassword: forceReset ? undefined : currentPassword }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Password reset failed.");
      toast({ title: "Password updated", description: "Use your new password from now on." });
      const d = await loadData(token);
      if (d) {
        setData(d);
        setForceReset(false);
        setNewPassword(""); setConfirmPassword(""); setCurrentPassword("");
        setScreen("dashboard");
      }
    } catch (err: any) {
      toast({ title: "Reset failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleBook = async () => {
    if (!data) return;
    const doctor = data.doctors.find((d) => d.id === bookDoctorId);
    if (!doctor) { toast({ title: "Choose a doctor", description: "Pick your doctor to continue.", variant: "destructive" }); return; }
    if (!bookDate || bookDate < todayIso()) { toast({ title: "Invalid date", description: "Pick today or a future date.", variant: "destructive" }); return; }
    if (!isDoctorAvailableOn(doctor, bookDate, { schedules: data.schedules, branch: data.patient.branch })) {
      toast({ title: "Doctor unavailable", description: `${doctor.name} is not available on ${weekdayOf(bookDate)}s. Pick another day.`, variant: "destructive" });
      return;
    }
    setBooking(true);
    try {
      const res = await fetch("/api/appointment-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: data.patient.id,
          patientName: data.patient.name,
          phone: data.patient.phone,
          doctorId: doctor.id,
          doctorName: doctor.name,
          department: doctor.department,
          date: bookDate,
          time: bookTime,
          reason: bookReason.trim() || "Patient request",
          fee: doctor.consultationFee ?? 0,
          branch: data.patient.branch,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not send the request.");
      toast({ title: "Request Sent", description: `Your visit with ${doctor.name} on ${bookDate} at ${bookTime} is awaiting confirmation. The token appears here once accepted.` });
      setBookReason("");
      await refresh();
    } catch (err: any) {
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
    } finally {
      setBooking(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(""); setData(null); setPassword("");
    setScreen("login");
  };

  const popupToast = () => toast({ title: "Pop-up blocked", description: "Allow pop-ups to download.", variant: "destructive" });

  if (screen === "loading") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-gradient-to-b from-teal-50 via-white to-emerald-50">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-xl animate-pulse">
          <HeartPulse className="h-8 w-8" />
        </div>
        <p className="font-semibold text-teal-800">Loading your health portal…</p>
      </div>
    );
  }

  if (screen === "login" || screen === "reset") {
    const isLogin = screen === "login";
    return (
      <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900 p-4 flex items-center justify-center">
        <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <Card className="relative w-full max-w-sm shadow-2xl border-0 rounded-3xl overflow-hidden">
          <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-6 pt-6 pb-8 text-white text-center">
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur shadow overflow-hidden">
              {isLogin ? (
                branding.appLogo ? (
                  <img src={branding.appLogo} alt="Clinic logo" className="h-12 w-12 object-contain" />
                ) : (
                  <HeartPulse className="h-7 w-7" />
                )
              ) : (
                <ShieldCheck className="h-7 w-7" />
              )}
            </div>
            <CardTitle className="text-xl text-white">{isLogin ? `${branding.appName} — Patient Portal` : forceReset ? "Set Your Password" : "Change Password"}</CardTitle>
            <CardDescription className="text-teal-100">
              {isLogin ? "Visits • Reports • Medicines • Bills" : forceReset ? "Required on first login — cannot be skipped" : "Current password plus a new one"}
            </CardDescription>
          </div>
          <CardContent className="pt-5">
            {isLogin ? (
              <form onSubmit={handleLogin} className="grid gap-4">
                <div className="space-y-2">
                  <Label>Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 h-11 rounded-xl" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9 h-11 rounded-xl" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 font-semibold text-base shadow" disabled={busy}>{busy ? "Signing in…" : "Sign In"}</Button>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/60 rounded-xl px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                  First time? Use the temporary password from reception, then set your own.
                </div>
              </form>
            ) : (
              <form onSubmit={handleReset} className="grid gap-4">
                {!forceReset && (
                  <div className="space-y-2"><Label>Current Password</Label><Input className="h-11 rounded-xl" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div>
                )}
                <div className="space-y-2"><Label>New Password (min 8 chars)</Label><Input className="h-11 rounded-xl" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" /></div>
                <div className="space-y-2"><Label>Confirm New Password</Label><Input className="h-11 rounded-xl" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" /></div>
                <Button type="submit" className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 font-semibold shadow" disabled={busy}>{busy ? "Saving…" : forceReset ? "Set Password & Continue" : "Update Password"}</Button>
                {!forceReset && <Button type="button" variant="outline" className="w-full rounded-xl" onClick={() => { setScreen("dashboard"); setNewPassword(""); setConfirmPassword(""); setCurrentPassword(""); }}>Back</Button>}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;
  const { patient } = data;
  const upcoming = data.appointments.filter((a) => a.status !== "Cancelled" && a.status !== "Completed");
  const outstanding = data.invoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);
  const pendingRequests = data.requests.filter((r) => r.status === "Requested");

  const opDays = data.clinic.opExpiryDays;
  const opExpiry = patient.opDate && opDays > 0 ? addDaysIso(patient.opDate, opDays) : "";
  const opExpired = !!opExpiry && opExpiry < todayIso();
  const opExpiringSoon = !!opExpiry && !opExpired && addDaysIso(todayIso(), 3) >= opExpiry;

  const selectedDoctor = data.doctors.find((d) => d.id === bookDoctorId);
  const dayAvailable = selectedDoctor && bookDate ? isDoctorAvailableOn(selectedDoctor, bookDate, { schedules: data.schedules, branch: patient.branch }) : true;

  return (
    <div className="min-h-screen bg-slate-100 pb-12">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-800 text-white">
        <div className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="relative mx-auto max-w-3xl px-4 pt-5 pb-16">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur font-bold text-base ring-2 ring-white/40 shrink-0">
              {initials(patient.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-teal-200">{data.clinic.name}</p>
              <p className="font-bold text-lg leading-tight truncate">Hello, {patient.name.split(" ")[0]}!</p>
              <p className="text-[11px] text-teal-100">{patient.uhid} • {patient.phone}</p>
            </div>
          <div className="flex items-center gap-1.5 shrink-0 relative">
            <span className="hidden sm:inline rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-semibold backdrop-blur" title="Your registered branch — doctors and bills shown are from this branch only">{patient.branch}</span>
            <PortalBell data={data} outstanding={outstanding} opExpired={opExpired} opExpiry={opExpiry} goTab={setBookTab} />
            <IconBtn title="Refresh my records" onClick={() => refresh(false)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            </IconBtn>
              <IconBtn title="Change password" onClick={() => { setForceReset(false); setScreen("reset"); }}>
                <Lock className="h-4 w-4" />
              </IconBtn>
              <IconBtn title="Sign out" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-[11px]">
            <span className={`rounded-full px-2.5 py-1 font-semibold ${opExpired ? "bg-amber-400 text-amber-950" : "bg-white/20 text-white"}`}>
              {opExpiry ? (opExpired ? `OP expired ${opExpiry}` : `OP valid till ${opExpiry}`) : `${patient.age} yrs • ${patient.gender}`}
            </span>
            {outstanding > 0 && <span className="rounded-full bg-rose-500 px-2.5 py-1 font-semibold">₹{outstanding.toLocaleString("en-IN")} due</span>}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 -mt-10 space-y-4 relative">
        {(opExpired || opExpiringSoon) && (
          <Card className="border-0 shadow-lg rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-amber-950">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/40 shrink-0"><AlertTriangle className="h-5 w-5" /></div>
              <p className="text-xs flex-1 font-medium">
                {opExpired ? <>Your OP expired on <b>{opExpiry}</b>. Renew below — pay at the hospital counter.</> : <>Your OP expires on <b>{opExpiry}</b>. Book your next visit in time.</>}
              </p>
              <Button size="sm" className="h-9 rounded-xl bg-amber-950 text-white hover:bg-amber-900 text-xs font-bold shrink-0" onClick={() => setBookTab("book")}>Renew OP</Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-2.5">
          <Stat icon={CalendarDays} value={String(upcoming.length)} label="Visits" grad="from-teal-500 to-emerald-500" />
          <Stat icon={FlaskConical} value={String(data.labTests.length + data.radiologyOrders.length)} label="Reports" grad="from-sky-500 to-indigo-500" />
          <Stat icon={Pill} value={String(data.prescriptions.length)} label="Medicines" grad="from-violet-500 to-purple-500" />
          <Stat icon={Receipt} value={outstanding > 0 ? `₹${outstanding.toLocaleString("en-IN")}` : "Clear"} label="Dues" grad="from-rose-500 to-pink-500" />
        </div>

        <Tabs value={bookTab} onValueChange={setBookTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 h-auto bg-white shadow rounded-2xl p-1.5 border-0">
            <TabBtn value="visits" icon={CalendarDays} label="Visits" />
            <TabBtn value="book" icon={Plus} label="Book" highlight />
            <TabBtn value="meds" icon={Pill} label="Meds" />
            <TabBtn value="labs" icon={FlaskConical} label="Lab" />
            <TabBtn value="bills" icon={Receipt} label="Bills" />
            <TabBtn value="notes" icon={FileText} label="Notes" />
            <TabBtn value="profile" icon={User} label="Profile" />
          </TabsList>

          <TabsContent value="visits" className="space-y-2.5 mt-3">
            {pendingRequests.length > 0 && (
              <Card className="border-0 shadow rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
                <CardContent className="p-3.5 space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider opacity-90">Awaiting confirmation ({pendingRequests.length})</p>
                  {pendingRequests.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-xs bg-white/15 rounded-xl px-2.5 py-2">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      <span className="flex-1 font-medium">{r.doctorName} • {r.date} at {r.time}</span>
                      <Badge className="text-[10px] bg-white/25 text-white border-0">Requested</Badge>
                    </div>
                  ))}
                  <p className="text-[11px] opacity-90">Reception confirms shortly — your token appears here once accepted.</p>
                </CardContent>
              </Card>
            )}
            {data.appointments.length === 0 && pendingRequests.length === 0 && <Empty icon={CalendarDays} text="No visits yet" actionLabel="Book your first visit" onAction={() => setBookTab("book")} />}
            {data.appointments.map((a) => {
              const inv = data.invoices.find((i) => i.patientId === a.patientId && i.date === a.date);
              const due = inv ? Math.max(0, (inv.total || 0) - (inv.paidAmount || 0)) : 0;
              return (
                <Card key={a.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <div className="flex h-11 w-11 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shrink-0">
                      <span className="text-sm font-bold leading-none">{a.date.slice(8, 10)}</span>
                      <span className="text-[8px] uppercase opacity-90">{new Date(a.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{a.doctorName}</p>
                      <p className="text-[11px] text-muted-foreground">{a.time} • {a.department || a.type}{a.reason ? ` • ${a.reason}` : ""}</p>
                      {inv && (
                        <p className={`text-[11px] font-bold mt-0.5 ${due > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {due > 0 ? `Bill due ₹${due.toLocaleString("en-IN")} — pay at hospital` : `Bill paid ₹${(inv.total || 0).toLocaleString("en-IN")}`}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs font-bold text-teal-700">#{a.token}</p>
                      <Badge variant="outline" className="text-[10px] mt-0.5">{a.status}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
            {data.requests.filter((r) => r.status !== "Requested").length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">Past requests</p>
                {data.requests.filter((r) => r.status !== "Requested").map((r) => (
                  <Card key={r.id} className="border-0 shadow-sm rounded-2xl opacity-75">
                    <CardContent className="p-3 flex items-center gap-2 text-xs">
                      <span className="flex-1 font-medium">{r.doctorName} • {r.date} at {r.time}</span>
                      <Badge variant="outline" className="text-[10px]">{r.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="book" className="space-y-3 mt-3">
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-3 text-white">
                <p className="font-bold flex items-center gap-2"><Plus className="h-4 w-4" /> Request Your Next Visit</p>
                <p className="text-[11px] opacity-90">Doctors of <b>{patient.branch}</b> only — pick a doctor, reception confirms, pay at the hospital.</p>
              </div>
              <CardContent className="space-y-3 pt-3">
                <div className="grid gap-2.5 max-h-80 overflow-y-auto pr-0.5">
                  {data.doctors.length === 0 && <p className="text-xs text-muted-foreground">No doctors listed right now.</p>}
                  {data.doctors.map((d, idx) => {
                    const active = bookDoctorId === d.id;
                    const fee = d.consultationFee ?? 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => setBookDoctorId(d.id)}
                        className={`rounded-2xl border-2 p-3 text-left transition-all ${active ? "border-teal-600 bg-teal-50/70 shadow-md scale-[1.01]" : "bg-white hover:border-teal-300 hover:shadow-sm"}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${AVATAR_GRADS[idx % AVATAR_GRADS.length]} text-white font-bold text-sm shrink-0 shadow`}>
                            {initials(d.name)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold truncate">{d.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{d.qualification ? `${d.qualification} • ` : ""}{d.department || d.specialization}</p>
                          </div>
                          {active ? <CheckCircle2 className="h-5 w-5 text-teal-600 shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                          <DayPills days={d.availableDays ?? []} />
                          <span className={`ml-auto rounded-full px-2.5 py-1 text-[11px] font-bold shrink-0 shadow-sm ${fee > 0 ? "bg-teal-600 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                            {fee > 0 ? `₹${fee.toLocaleString("en-IN")} / visit` : "Free visit"}
                          </span>
                        </div>
                        {d.schedule && d.schedule.length > 0 && (
                          <p className="mt-1.5 text-[10px] text-muted-foreground leading-relaxed">{formatSchedule(d.schedule)}</p>
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-muted/50 p-3">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Date *</Label>
                    <Input type="date" min={todayIso()} value={bookDate} onChange={(e) => setBookDate(e.target.value)} className="rounded-xl bg-white" />
                    {selectedDoctorName(data.doctors, bookDoctorId) && bookDate && (
                      <p className={`text-[11px] font-medium ${dayAvailable ? "text-emerald-600" : "text-rose-600"}`}>
                        {dayAvailable ? `Available on ${weekdayOf(bookDate)}s` : `Not available ${weekdayOf(bookDate)}s`}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Time *</Label>
                    <Select value={bookTime} onValueChange={setBookTime}>
                      <SelectTrigger className="rounded-xl bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>{TIME_SLOTS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px]">Reason for Visit</Label>
                  <Textarea rows={2} value={bookReason} onChange={(e) => setBookReason(e.target.value)} placeholder="Symptoms or reason…" className="rounded-xl" />
                </div>
                <Button className="w-full h-12 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 font-bold text-sm shadow-lg" onClick={handleBook} disabled={booking || !dayAvailable}>
                  {booking ? "Sending…" : !bookDoctorId ? "Select a Doctor Above" : feeOf(data.doctors, bookDoctorId) > 0 ? `Request Visit • Pay ₹${feeOf(data.doctors, bookDoctorId).toLocaleString("en-IN")} at hospital` : "Request Free Visit"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="meds" className="space-y-2.5 mt-3">
            {data.prescriptions.length === 0 && <Empty icon={Pill} text="No prescriptions yet" />}
            {data.prescriptions.map((rx) => (
              <Card key={rx.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-violet-500 to-purple-500 px-3 py-2 text-white flex items-center gap-2">
                  <Pill className="h-4 w-4 shrink-0" />
                  <p className="text-xs font-bold flex-1 truncate">{rx.diagnosis || "Prescription"} • {rx.date}</p>
                  <Badge className="text-[10px] bg-white/25 text-white border-0">{rx.status}</Badge>
                </div>
                <CardContent className="p-3">
                  <p className="text-[11px] text-muted-foreground mb-2">Dr. {rx.doctorName || "—"}{rx.notes ? ` • ${rx.notes}` : ""}</p>
                  <div className="space-y-1.5">
                    {rx.items.map((it, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 px-2.5 py-2 text-xs">
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500 text-white font-bold text-[10px] shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold truncate">{it.medicineName}</p>
                          <p className="text-muted-foreground">{it.quantity} {it.unit === "Sheet" ? "sheet(s)" : "tablet(s)"}{[it.dosage, it.frequency, it.duration].filter(Boolean).join(" • ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="labs" className="space-y-2.5 mt-3">
            {data.labTests.length === 0 && data.radiologyOrders.length === 0 && <Empty icon={FlaskConical} text="No test reports yet" />}
            {data.labTests.map((t) => (
              <ReportCard
                key={t.id} icon={FlaskConical} tint="from-sky-500 to-indigo-500" title={t.test}
                sub={`${t.category} • ${t.status} • ${(t.orderedOn || "").split("T")[0]}`}
                lines={[t.result ? `Result: ${t.result}` : "", t.findings ? `Findings: ${t.findings}` : ""].filter(Boolean)}
                onView={() => openPreview(buildLabReportHtml(t, patient, {}), () => { if (!printLabReport(t, patient, {})) popupToast(); })}
                onDownload={() => { if (!printLabReport(t, patient, {})) popupToast(); }}
              />
            ))}
            {data.radiologyOrders.map((r) => (
              <ReportCard
                key={r.id} icon={ScanLine} tint="from-indigo-500 to-violet-500" title={`${r.modality} — ${r.region}`}
                sub={`${r.status} • ${(r.orderedOn || "").split("T")[0]}`}
                lines={[r.findings ? `Findings: ${r.findings}` : ""]}
                onView={() => openPreview(buildRadiologyReportHtml(r, patient, {}), () => { if (!printRadiologyReport(r, patient, {})) popupToast(); })}
                onDownload={() => { if (!printRadiologyReport(r, patient, {})) popupToast(); }}
              />
            ))}
          </TabsContent>

          <TabsContent value="bills" className="space-y-2.5 mt-3">
            {outstanding > 0 && (
              <Card className="border-0 shadow rounded-2xl bg-gradient-to-r from-rose-500 to-pink-500 text-white">
                <CardContent className="p-3.5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25 font-bold shrink-0">₹</div>
                  <p className="text-xs flex-1 font-medium"><span className="font-bold text-sm">₹{outstanding.toLocaleString("en-IN")} due.</span><br />Pay at the hospital counter.</p>
                </CardContent>
              </Card>
            )}
            {data.invoices.length === 0 && <Empty icon={Receipt} text="No bills yet" />}
            {data.invoices.map((inv) => {
              const due = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
              return (
                <Card key={inv.id} className="border-0 shadow-sm rounded-2xl overflow-hidden">
                  <div className={`flex items-center gap-3 p-3 ${due > 0 ? "bg-rose-50/60" : "bg-emerald-50/60"}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{inv.invoiceNo}</p>
                      <p className="text-[11px] text-muted-foreground">{inv.date} • Total ₹{(inv.total || 0).toLocaleString("en-IN")} • Paid ₹{(inv.paidAmount || 0).toLocaleString("en-IN")}</p>
                      {due > 0
                        ? <p className="text-xs font-bold text-rose-600 mt-0.5">Due ₹{due.toLocaleString("en-IN")} — pay at hospital</p>
                        : <p className="text-xs font-bold text-emerald-600 mt-0.5 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Fully paid</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] bg-white">{inv.status}</Badge>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] rounded-xl bg-white" onClick={() => { if (!printInvoice(inv, {}, patient)) popupToast(); }}><Download className="h-3 w-3 mr-1" /> Bill</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] rounded-xl" onClick={() => openPreview(buildInvoiceHtml(inv, {}, patient), () => { if (!printInvoice(inv, {}, patient)) popupToast(); })} title="View bill (no download needed)"><Eye className="h-3 w-3 mr-1" /> View</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="notes" className="space-y-2.5 mt-3">
            {data.appointments.filter((a) => a.clinicalNotes || a.problems || a.reason).length === 0 &&
              data.medicalRecords.length === 0 && <Empty icon={FileText} text="No doctor's notes yet" />}
            {data.appointments.filter((a) => a.clinicalNotes || a.problems).map((a) => (
              <Card key={a.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-600/10 text-teal-700 font-bold text-[10px] shrink-0">{initials(a.doctorName)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{a.doctorName}</p>
                      <p className="text-[11px] text-muted-foreground">{a.date}</p>
                    </div>
                  </div>
                  {a.problems && <div className="rounded-xl bg-amber-50 border border-amber-200 px-2.5 py-2 text-xs mt-1.5"><span className="font-bold">Problems: </span>{a.problems}</div>}
                  {a.clinicalNotes && <p className="text-xs mt-1.5 whitespace-pre-wrap leading-relaxed">{a.clinicalNotes}</p>}
                </CardContent>
              </Card>
            ))}
            {data.medicalRecords.map((r) => (
              <Card key={r.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-3.5 flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-600/10 text-slate-600 shrink-0"><FileText className="h-4 w-4" /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{r.title || r.type}</p>
                    <p className="text-[11px] text-muted-foreground">{r.type} • {r.doctor || "—"} • {r.recordDate}</p>
                    {r.notes && <p className="text-[11px] mt-1 whitespace-pre-wrap text-muted-foreground line-clamp-3">{r.notes}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openPreview(buildMedicalRecordHtml(r, patient, {}), () => { if (!printMedicalRecord(r, patient, {})) popupToast(); })} title="View (no download needed)"><Eye className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => { if (!printMedicalRecord(r, patient, {})) popupToast(); }} title="Download"><Download className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="profile" className="mt-3">
            <Card className="border-0 shadow-lg rounded-3xl overflow-hidden">
              <div className="bg-gradient-to-r from-slate-600 to-slate-800 px-4 py-4 text-white flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur font-bold ring-2 ring-white/40 shrink-0">{initials(patient.name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg truncate">{patient.name}</p>
                  <p className="text-[11px] opacity-80 font-mono">{patient.uhid}</p>
                </div>
                <Badge className="bg-white/25 text-white border-0 text-[10px] shrink-0">{patient.status}</Badge>
              </div>
              <CardContent className="p-0">
              <ProfileRow icon={User} label="Age / Gender" value={`${patient.age} yrs • ${patient.gender}`} />
              <ProfileRow icon={Phone} label="Phone" value={patient.phone || "—"} />
              <ProfileRow icon={FileText} label="Registered Branch" value={patient.branch || "—"} />
                <ProfileRow icon={FileText} label="Address" value={patient.address || "—"} />
                <ProfileRow icon={HeartPulse} label="Blood Group" value={patient.bloodGroup || "—"} />
                <ProfileRow icon={ShieldCheck} label="Insurance" value={patient.insuranceProvider && patient.insuranceProvider !== "Self Pay" ? `${patient.insuranceProvider}${patient.insurancePolicy && patient.insurancePolicy !== "-" ? ` • ${patient.insurancePolicy}` : ""}` : "Self Pay"} />
                <ProfileRow icon={Stethoscope} label="Doctor" value={patient.doctorName || "—"} />
                <ProfileRow icon={CalendarDays} label="OP Date / Validity" value={patient.opDate ? (opExpiry ? `${patient.opDate} → valid till ${opExpiry}` : patient.opDate) : "—"} />
                <ProfileRow icon={Phone} label="Emergency Contact" value={patient.emergencyContact && patient.emergencyContact !== "-" ? patient.emergencyContact : "—"} last />
              </CardContent>
            </Card>
            <p className="text-[11px] text-center text-muted-foreground pt-2">Wrong details? Ask reception to update your profile.</p>
          </TabsContent>
        </Tabs>
      </main>
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value, last }: { icon: typeof Pill; label: string; value: string; last?: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${last ? "" : "border-b border-muted"}`}>
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted shrink-0"><Icon className="h-4 w-4 text-muted-foreground" /></div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xs font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function PortalBell({ data, outstanding, opExpired, opExpiry, goTab }: {
  data: PortalData; outstanding: number; opExpired: boolean; opExpiry: string; goTab: (t: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const alerts: { icon: typeof Pill; tint: string; title: string; body: string; tab: string }[] = [];
  const pending = data.requests.filter((r) => r.status === "Requested");
  for (const r of pending.slice(0, 3)) {
    alerts.push({
      icon: Clock, tint: "bg-sky-600/10 text-sky-700",
      title: "Visit request pending",
      body: `${r.doctorName} • ${r.date} at ${r.time} — awaiting confirmation`,
      tab: "visits",
    });
  }
  if (outstanding > 0) {
    alerts.push({
      icon: Receipt, tint: "bg-rose-600/10 text-rose-700",
      title: `₹${outstanding.toLocaleString("en-IN")} due`,
      body: "Pay your pending bills at the hospital counter.",
      tab: "bills",
    });
  }
  if (opExpired) {
    alerts.push({
      icon: AlertTriangle, tint: "bg-amber-500/15 text-amber-700",
      title: "OP expired",
      body: `Your OP expired on ${opExpiry}. Renew with a new visit.`,
      tab: "book",
    });
  }
  const freshReports = [...data.labTests, ...data.radiologyOrders].filter((t: any) => t.status === "Approved" || t.status === "Report Generated").length;
  if (freshReports > 0) {
    alerts.push({
      icon: FlaskConical, tint: "bg-teal-600/10 text-teal-700",
      title: `${freshReports} report${freshReports === 1 ? "" : "s"} ready`,
      body: "New test reports are available for download.",
      tab: "labs",
    });
  }
  return (
    <div className="relative">
      <button
        type="button" title="My alerts" onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur hover:bg-white/30 transition-colors"
      >
        <Bell className="h-4 w-4" />
        {alerts.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold">
            {alerts.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-2xl bg-white text-slate-800 shadow-2xl border">
            <p className="px-3.5 py-2.5 text-xs font-bold border-b">My Alerts ({alerts.length})</p>
            <div className="max-h-72 overflow-y-auto divide-y">
              {alerts.length === 0 && <p className="px-3.5 py-5 text-center text-xs text-muted-foreground">All caught up.</p>}
              {alerts.map((a, i) => (
                <button
                  key={i} type="button"
                  className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left hover:bg-muted/50"
                  onClick={() => { setOpen(false); goTab(a.tab); }}
                >
                  <span className={`flex h-8 w-8 items-center justify-center rounded-xl shrink-0 ${a.tint}`}><a.icon className="h-4 w-4" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold truncate">{a.title}</span>
                    <span className="block text-[11px] text-muted-foreground line-clamp-2">{a.body}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, disabled, children }: { title: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button" title={title} onClick={onClick} disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur hover:bg-white/30 transition-colors disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Stat({ icon: Icon, value, label, grad }: { icon: typeof Pill; value: string; label: string; grad: string }) {
  return (
    <Card className="border-0 shadow rounded-2xl bg-white overflow-hidden">
      <CardContent className="p-3 text-center">
        <div className={`mx-auto mb-1.5 flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-white shadow`}><Icon className="h-4 w-4" /></div>
        <p className="text-sm font-bold leading-tight truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      </CardContent>
    </Card>
  );
}

function TabBtn({ value, icon: Icon, label, highlight }: { value: string; icon: typeof Pill; label: string; highlight?: boolean }) {
  return (
    <TabsTrigger
      value={value}
      className="flex-col gap-0.5 py-2 rounded-xl data-[state=active]:bg-gradient-to-b data-[state=active]:from-teal-600 data-[state=active]:to-emerald-600 data-[state=active]:text-white data-[state=active]:shadow"
    >
      <Icon className="h-4 w-4" />
      <span className="text-[10px] font-semibold">{label}{highlight ? " •" : ""}</span>
    </TabsTrigger>
  );
}

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DayPills({ days }: { days: string[] }) {
  const normalized = days.map((d) => d.trim().toLowerCase().slice(0, 3));
  const hasAny = normalized.length > 0;
  return (
    <span className="flex items-center gap-1">
      {WEEK_DAYS.map((wd) => {
        const on = normalized.includes(wd.toLowerCase());
        return (
          <span
            key={wd}
            title={wd}
            className={`flex h-5 min-w-5 px-1 items-center justify-center rounded-md text-[8px] font-bold ${on ? "bg-teal-600 text-white shadow-sm" : "bg-muted text-muted-foreground/40"}`}
          >
            {wd[0]}
          </span>
        );
      })}
      {!hasAny && <span className="ml-1 text-[10px] text-muted-foreground">timings on request</span>}
    </span>
  );
}

function ReportCard({ icon: Icon, tint, title, sub, lines, onDownload, onView }: {
  icon: typeof Pill; tint: string; title: string; sub: string; lines: string[]; onDownload: () => void; onView?: () => void;
}) {
  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardContent className="p-3 flex items-center gap-2.5">
        <div className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br ${tint} text-white shrink-0 shadow`}><Icon className="h-5 w-5" /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate">{title}</p>
          <p className="text-[11px] text-muted-foreground">{sub}</p>
          {lines.filter(Boolean).map((l, i) => <p key={i} className="text-[11px] mt-0.5 line-clamp-2">{l}</p>)}
        </div>
        {onView && <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl hover:bg-muted" onClick={onView} title="View (no download needed)"><Eye className="h-4 w-4" /></Button>}
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-xl hover:bg-muted" onClick={onDownload} title="Download report"><Download className="h-4 w-4" /></Button>
      </CardContent>
    </Card>
  );
}

function selectedDoctorName(doctors: Doctor[], id: string): string {
  return doctors.find((d) => d.id === id)?.name ?? "";
}

function feeOf(doctors: Doctor[], id: string): number {
  return doctors.find((d) => d.id === id)?.consultationFee ?? 0;
}

function Empty({ icon: Icon, text, actionLabel, onAction }: { icon: typeof Pill; text: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <Card className="border-dashed border-2 shadow-none rounded-3xl bg-white/60">
      <CardContent className="p-8 text-center">
        <div className="mx-auto mb-2 flex h-13 w-13 items-center justify-center rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg p-3"><Icon className="h-6 w-6" /></div>
        <p className="text-sm text-muted-foreground font-medium">{text}</p>
        {actionLabel && onAction && <Button size="sm" className="mt-3 rounded-xl bg-teal-600 hover:bg-teal-700 font-bold" onClick={onAction}>{actionLabel}</Button>}
      </CardContent>
    </Card>
  );
}
