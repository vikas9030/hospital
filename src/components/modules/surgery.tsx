"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useBranchData } from "@/hooks/use-branch-data";
import { Scissors, Plus, Search, Printer, Package, Syringe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { canEditModule, isAdmin } from "@/lib/utils";
import { printSurgerySchedule } from "@/lib/documents";
import type { SurgeryCase, SurgeryPackage } from "@/lib/types";

const STATUSES = ["Scheduled", "Pre-op", "Ready", "In OT", "Completed", "Post-op", "Discharged", "Cancelled"] as const;

function useSurgeries(branch: string) {
  const [cases, setCases] = useState<SurgeryCase[]>([]);
  const [packages, setPackages] = useState<SurgeryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try {
      const [c, p] = await Promise.all([
        fetch(`/api/surgeries?branch=${encodeURIComponent(branch)}`).then((r) => r.json()),
        fetch(`/api/surgeries/packages?branch=${encodeURIComponent(branch)}`).then((r) => r.json()),
      ]);
      if (Array.isArray(c)) setCases(c);
      if (Array.isArray(p)) setPackages(p);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);
  return { cases, setCases, packages, setPackages, loading, refresh };
}

function BookSurgeryDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: (c: SurgeryCase) => void }) {
  const { toast } = useToast();
  const { patients, branch } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const { packages } = useSurgeries(branch);
  const [form, setForm] = useState({ patientId: "", surgeryName: "", surgeryCategory: "", surgeon: "", department: "", plannedDate: new Date().toISOString().split("T")[0], plannedTime: "09:00", priority: "Elective", theatre: "", anesthesiaType: "", diagnosis: "", packageId: "", estimate: "", advanceRequired: "" });
  const [saving, setSaving] = useState(false);
  const patient = patients.find((p) => p.id === form.patientId);

  const submit = async () => {
    if (!form.patientId || !form.surgeryName) {
      toast({ title: "Missing fields", description: "Patient and surgery name are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Auto-link the patient's active admission so surgery/OT prices join the
      // same single bill as beds. Day-care cases (no admission) stay unlinked.
      let admissionId: string | undefined;
      let bedNumber = "";
      let room = "";
      try {
        const admRes = await fetch(`/api/admissions?branch=${encodeURIComponent(branch)}`);
        const adms = admRes.ok ? await admRes.json() : [];
        const match = Array.isArray(adms) ? adms.find((a: { patientId?: string; status?: string }) => a.patientId === form.patientId && a.status === "Admitted") : null;
        if (match) {
          admissionId = match.id;
          bedNumber = match.bedNumber ?? "";
          room = match.room ?? "";
        }
      } catch { /* day-care fallback */ }
      const res = await fetch("/api/surgeries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: form.patientId,
          patientName: patient?.name ?? "",
          uhid: patient?.uhid ?? "",
          admissionId,
          bedNumber,
          room,
          surgeryName: form.surgeryName,
          surgeryCategory: form.surgeryCategory,
          surgeon: form.surgeon,
          department: form.department,
          plannedDate: form.plannedDate,
          plannedTime: form.plannedTime,
          priority: form.priority,
          kind: form.priority === "Emergency" ? "Emergency" : "Elective",
          theatre: form.theatre,
          anesthesiaType: form.anesthesiaType,
          diagnosis: form.diagnosis,
          packageId: form.packageId || undefined,
          estimate: parseFloat(form.estimate) || 0,
          advanceRequired: parseFloat(form.advanceRequired) || 0,
          branch,
          createdBy: currentUser.name,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to book surgery.");
      onCreated(body);
      toast({ title: "Surgery booked", description: `${body.caseNo} — ${body.surgeryName} on ${body.plannedDate}${body.admissionId ? " (linked to admission — joins single bill)" : " (day-care — no admission)"}.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not book", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Book Surgery</DialogTitle><DialogDescription>Schedule a case — active admission auto-links so surgery + beds merge into one single final bill.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="space-y-2"><Label>Patient *</Label>
            <Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}>
              <SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger>
              <SelectContent>{patients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.uhid})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Surgery *</Label><Input value={form.surgeryName} onChange={(e) => setForm({ ...form, surgeryName: e.target.value })} placeholder="e.g. Appendectomy" /></div>
            <div className="space-y-2"><Label>Category</Label><Input value={form.surgeryCategory} onChange={(e) => setForm({ ...form, surgeryCategory: e.target.value })} placeholder="General / Ortho / …" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Surgeon</Label><Input value={form.surgeon} onChange={(e) => setForm({ ...form, surgeon: e.target.value })} placeholder="Dr. …" /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="General Surgery" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.plannedDate} onChange={(e) => setForm({ ...form, plannedDate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Time</Label><Input type="time" value={form.plannedTime} onChange={(e) => setForm({ ...form, plannedTime: e.target.value })} /></div>
            <div className="space-y-2"><Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Elective", "Urgent", "Emergency"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Theatre</Label><Input value={form.theatre} onChange={(e) => setForm({ ...form, theatre: e.target.value })} placeholder="OT-1" /></div>
            <div className="space-y-2"><Label>Anesthesia</Label><Input value={form.anesthesiaType} onChange={(e) => setForm({ ...form, anesthesiaType: e.target.value })} placeholder="General / Spinal" /></div>
          </div>
          <div className="space-y-2"><Label>Diagnosis</Label><Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} placeholder="Primary diagnosis" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Estimate (₹)</Label><Input type="number" value={form.estimate} onChange={(e) => setForm({ ...form, estimate: e.target.value })} placeholder="0" /></div>
            <div className="space-y-2"><Label>Advance required (₹)</Label><Input type="number" value={form.advanceRequired} onChange={(e) => setForm({ ...form, advanceRequired: e.target.value })} placeholder="0" /></div>
          </div>
          <div className="space-y-2"><Label>Package (optional)</Label>
            <Select value={form.packageId || "__none"} onValueChange={(v) => setForm({ ...form, packageId: v === "__none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="No package" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">No package</SelectItem>
                {packages.filter((p) => p.active).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — ₹{p.basePrice.toLocaleString("en-IN")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Booking..." : "Book Surgery"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CaseDetailDialog({ surgery, onClose, onUpdated }: { surgery: SurgeryCase | null; onClose: () => void; onUpdated: (c: SurgeryCase) => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const [charges, setCharges] = useState<{ id: string; label: string; category: string; amount: number; auto: boolean; billed: boolean }[]>([]);
  const [consumables, setConsumables] = useState<{ id: string; item: string; quantity: number; unitPrice: number; total: number; status: string }[]>([]);
  const [status, setStatus] = useState<SurgeryCase["status"]>(surgery?.status ?? "Scheduled");
  const [chargeForm, setChargeForm] = useState({ label: "", category: "Surgery", amount: "" });
  const [consumableForm, setConsumableForm] = useState({ item: "", quantity: "1", unitPrice: "" });

  useEffect(() => {
    if (!surgery) return;
    setStatus(surgery.status);
    (async () => {
      const [ch, co] = await Promise.all([
        fetch(`/api/surgeries/charges?caseId=${encodeURIComponent(surgery.id)}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/surgeries/consumables?caseId=${encodeURIComponent(surgery.id)}`).then((r) => r.json()).catch(() => []),
      ]);
      if (Array.isArray(ch)) setCharges(ch);
      if (Array.isArray(co)) setConsumables(co);
    })();
  }, [surgery]);

  if (!surgery) return null;

  const updateStatus = async (next: SurgeryCase["status"]) => {
    try {
      const res = await fetch("/api/surgeries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: surgery.id, status: next, actorRole: currentUser.role, actorName: currentUser.name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Update failed.");
      setStatus(next);
      onUpdated(body);
      toast({ title: "Status updated", description: `${surgery.caseNo} → ${next}.` });
    } catch (e: any) {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    }
  };

  const addCharge = async () => {
    if (!chargeForm.label || !(parseFloat(chargeForm.amount) > 0)) {
      toast({ title: "Invalid charge", description: "Label and amount are required.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/surgeries/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: surgery.id, admissionId: surgery.admissionId, label: chargeForm.label, category: chargeForm.category, amount: parseFloat(chargeForm.amount), createdBy: currentUser.name, branch: surgery.branch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      setCharges((l) => [...l, body]);
      setChargeForm({ label: "", category: "Surgery", amount: "" });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const applyPackage = async () => {
    if (!surgery.packageId) {
      toast({ title: "No package", description: "This case has no package linked.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/surgeries/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: surgery.id, packageId: surgery.packageId, applyPackage: true, createdBy: currentUser.name, branch: surgery.branch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Apply failed.");
      const fresh = await fetch(`/api/surgeries/charges?caseId=${encodeURIComponent(surgery.id)}`).then((r) => r.json());
      if (Array.isArray(fresh)) setCharges(fresh);
      toast({ title: "Package applied", description: `${body.length ?? 0} component(s) added. Double-apply is blocked server-side.` });
    } catch (e: any) {
      toast({ title: "Apply failed", description: e.message, variant: "destructive" });
    }
  };

  const recordConsumable = async () => {
    if (!consumableForm.item) {
      toast({ title: "Invalid item", description: "Item name is required.", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/surgeries/consumables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: surgery.id, admissionId: surgery.admissionId, patientId: surgery.patientId, item: consumableForm.item, quantity: parseFloat(consumableForm.quantity) || 1, unitPrice: parseFloat(consumableForm.unitPrice) || 0, usedBy: currentUser.name, branch: surgery.branch }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      setConsumables((l) => [...l, body]);
      setConsumableForm({ item: "", quantity: "1", unitPrice: "" });
      toast({ title: "Recorded", description: "Stock deducts only on Issue — recording alone never touches pharmacy." });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
  };

  const issueConsumable = async (id: string) => {
    try {
      const res = await fetch("/api/surgeries/consumables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue", id, actorName: currentUser.name }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Issue failed.");
      setConsumables((l) => l.map((c) => (c.id === id ? body : c)));
      toast({ title: "Issued", description: "Pharmacy stock deducted once; admission charge posted." });
    } catch (e: any) {
      toast({ title: "Issue failed", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={!!surgery} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{surgery.caseNo} — {surgery.surgeryName}</DialogTitle>
          <DialogDescription>{surgery.patientName} • {surgery.plannedDate} {surgery.plannedTime} • {surgery.theatre || "OT TBD"}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2 py-2">
          <Select value={status} onValueChange={(v) => updateStatus(v as SurgeryCase["status"])}>
            <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => printSurgerySchedule({ ...surgery, status: status as SurgeryCase["status"] }, settings)}><Printer className="h-3.5 w-3.5 mr-1.5" /> Schedule Sheet</Button>
          {surgery.packageId && <Button size="sm" variant="outline" onClick={applyPackage}><Package className="h-3.5 w-3.5 mr-1.5" /> Apply Package</Button>}
        </div>
        <Tabs defaultValue="charges">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="charges">Charge Components ({charges.length})</TabsTrigger>
            <TabsTrigger value="consumables">Consumables & Implants ({consumables.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="charges" className="space-y-3 pt-3">
            <div className="grid grid-cols-[1fr_130px_110px_auto] gap-1.5">
              <Input className="h-8 text-xs" placeholder="Component label" value={chargeForm.label} onChange={(e) => setChargeForm({ ...chargeForm, label: e.target.value })} />
              <Input className="h-8 text-xs" placeholder="Category" value={chargeForm.category} onChange={(e) => setChargeForm({ ...chargeForm, category: e.target.value })} />
              <Input className="h-8 text-xs" type="number" placeholder="₹" value={chargeForm.amount} onChange={(e) => setChargeForm({ ...chargeForm, amount: e.target.value })} />
              <Button size="sm" className="h-8" onClick={addCharge}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {charges.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <span>{c.label} <span className="text-muted-foreground">• {c.category}{c.auto ? " • auto" : ""}{c.billed ? " • billed" : ""}</span></span>
                <strong>₹{c.amount.toLocaleString("en-IN")}</strong>
              </div>
            ))}
            {charges.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No components yet — default OT components post automatically on finalize.</p>}
          </TabsContent>
          <TabsContent value="consumables" className="space-y-3 pt-3">
            <div className="grid grid-cols-[1fr_70px_100px_auto] gap-1.5">
              <Input className="h-8 text-xs" placeholder="Item / implant" value={consumableForm.item} onChange={(e) => setConsumableForm({ ...consumableForm, item: e.target.value })} />
              <Input className="h-8 text-xs" type="number" value={consumableForm.quantity} onChange={(e) => setConsumableForm({ ...consumableForm, quantity: e.target.value })} />
              <Input className="h-8 text-xs" type="number" placeholder="₹/unit" value={consumableForm.unitPrice} onChange={(e) => setConsumableForm({ ...consumableForm, unitPrice: e.target.value })} />
              <Button size="sm" className="h-8" onClick={recordConsumable}><Plus className="h-3.5 w-3.5" /></Button>
            </div>
            {consumables.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                <span>{c.item} × {c.quantity} <span className="text-muted-foreground">• {c.status} • ₹{c.total.toLocaleString("en-IN")}</span></span>
                {(c.status === "Recorded") && <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => issueConsumable(c.id)}><Syringe className="h-3 w-3 mr-1" /> Issue / Use</Button>}
              </div>
            ))}
            {consumables.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No consumables recorded.</p>}
          </TabsContent>
        </Tabs>
        <DialogFooter><Button variant="outline" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SurgeryModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { branch } = useBranchData();
  const { cases, setCases, packages, loading, refresh } = useSurgeries(branch);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [bookOpen, setBookOpen] = useState(false);
  const [selected, setSelected] = useState<SurgeryCase | null>(null);
  const showEdit = canEditModule(currentUser.role, "surgery") || isAdmin(currentUser.role);

  const filtered = useMemo(() => cases.filter((c) => {
    const q = search.toLowerCase();
    const match = !q || c.patientName.toLowerCase().includes(q) || c.surgeryName.toLowerCase().includes(q) || (c.caseNo || "").toLowerCase().includes(q) || (c.surgeon || "").toLowerCase().includes(q);
    return match && (statusFilter === "All" || c.status === statusFilter);
  }), [cases, search, statusFilter]);

  const today = new Date().toISOString().split("T")[0];
  const todayCount = cases.filter((c) => c.plannedDate === today).length;
  const emergencyCount = cases.filter((c) => c.kind === "Emergency" && c.status !== "Completed" && c.status !== "Cancelled").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Surgery & Operation Theatre"
        description="Cases, charge components, packages, and OT consumables — IPD-linked billing"
        icon={Scissors}
        action={showEdit ? <Button size="sm" className="gap-2" onClick={() => setBookOpen(true)}><Plus className="h-3.5 w-3.5" /> Book Surgery</Button> : undefined}
      />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Cases" value={cases.length.toString()} icon={Scissors} color="primary" subtitle={`${todayCount} today`} />
        <StatCard title="Scheduled / In OT" value={cases.filter((c) => ["Scheduled", "Pre-op", "Ready", "In OT"].includes(c.status)).length.toString()} icon={Search} color="info" />
        <StatCard title="Emergency Open" value={emergencyCount.toString()} icon={Scissors} color="destructive" />
        <StatCard title="Packages" value={packages.filter((p) => p.active).length.toString()} icon={Package} color="success" subtitle={`${packages.length} configured`} />
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Cases {loading ? "— loading…" : `(${filtered.length})`}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search case, patient, surgeon…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="All">All statuses</SelectItem>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={refresh}>Refresh</Button>
          </div>
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader><TableRow className="bg-muted/50">
                <TableHead>Case</TableHead><TableHead>Patient</TableHead><TableHead className="hidden md:table-cell">Surgery</TableHead>
                <TableHead className="hidden lg:table-cell">When</TableHead><TableHead className="hidden lg:table-cell">Surgeon</TableHead>
                <TableHead>Status</TableHead><TableHead className="text-right">Estimate</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer" onClick={() => setSelected(c)}>
                    <TableCell className="font-mono text-xs">{c.caseNo}<p className="text-[10px] text-muted-foreground font-sans">{c.kind} • {c.theatre || "OT TBD"}</p></TableCell>
                    <TableCell className="text-sm font-medium">{c.patientName}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{c.surgeryName}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{c.plannedDate} {c.plannedTime}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{c.surgeon || "TBD"}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right text-sm">{c.estimate > 0 ? `₹${c.estimate.toLocaleString("en-IN")}` : "—"}</TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-10 text-sm text-muted-foreground">{loading ? "Loading…" : "No surgery cases. Book the first one."}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
          {packages.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {packages.filter((p) => p.active).slice(0, 8).map((p) => (
                <Badge key={p.id} variant="outline" className="text-[11px]">{p.name} — ₹{p.basePrice.toLocaleString("en-IN")}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      {bookOpen && <BookSurgeryDialog open onOpenChange={setBookOpen} onCreated={(c) => setCases((l) => [c, ...l])} />}
      {selected && <CaseDetailDialog surgery={selected} onClose={() => setSelected(null)} onUpdated={(c) => setCases((l) => l.map((x) => (x.id === c.id ? c : x)))} />}
    </div>
  );
}
