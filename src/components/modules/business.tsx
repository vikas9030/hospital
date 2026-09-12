"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useBranchData } from "@/hooks/use-branch-data";
import {
  ShieldCheck, Plus, DollarSign, Clock, CheckCircle2, XCircle,
  TrendingUp, Users, Phone, Mail, MessageSquare, Globe, Facebook,
  Megaphone, Calendar, Target, ArrowRight, UserPlus, RefreshCw,
  Pencil, Trash2, Send,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import type { Lead, InsuranceClaim } from "@/lib/types";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { canAddAnything, canEditModule, canDeleteModule, canManageInsurance, isAdmin } from "@/lib/utils";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import type { Campaign, CampaignAudienceKind } from "@/lib/types";

function NewClaimDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addInsuranceClaim = useAppStore((s) => s.addInsuranceClaim);
  const branchData = useBranchData();
  const [patientQuery, setPatientQuery] = useState("");
  const [form, setForm] = useState({ patientId: "", provider: "", policyNo: "", type: "", treatment: "", claimAmount: "", invoiceId: "", admissionDate: "", dischargeDate: "", tpaName: "", remarks: "" });
  const selectedPatient = branchData.patients.find((patient) => patient.id === form.patientId);
  const patientInvoices = branchData.invoices.filter((i) => i.patientId === form.patientId);
  const providerOptions = Array.from(new Set([
    ...branchData.insuranceClaims.map((c) => c.provider).filter(Boolean),
    "Star Health", "HDFC Ergo", "ICICI Lombard", "Niva Bupa", "Tata AIG", "CGHS", "ECHS",
  ])).sort();

  const pickPatient = (id: string) => {
    const p = branchData.patients.find((patient) => patient.id === id);
    if (!p) return;
    setForm((f) => ({
      ...f,
      patientId: id,
      provider: p.insuranceProvider && p.insuranceProvider !== "Self Pay" ? p.insuranceProvider : f.provider,
      policyNo: p.insurancePolicy && p.insurancePolicy !== "-" ? p.insurancePolicy : f.policyNo,
      invoiceId: "",
    }));
    setPatientQuery(p.name);
  };

  const pickInvoice = (invoiceId: string) => {
    const inv = patientInvoices.find((i) => i.id === invoiceId);
    setForm((f) => ({
      ...f,
      invoiceId,
      claimAmount: inv ? String(inv.total || 0) : f.claimAmount,
      treatment: f.treatment || (inv?.items ?? []).map((it) => it.description).join("; ").slice(0, 120),
    }));
  };

  const patientMatches = branchData.patients.filter((p) =>
    `${p.name} ${p.uhid} ${p.phone}`.toLowerCase().includes(patientQuery.trim().toLowerCase())
  ).slice(0, 8);

  const handleSubmit = async () => {
    if (!selectedPatient || !form.provider) {
      toast({ title: "Error", description: "Patient and Provider are required", variant: "destructive" });
      return;
    }
    const newClaim: InsuranceClaim = {
      id: `ins${Date.now()}`,
      claimNo: `CLM-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
      patientName: selectedPatient.name, patientId: selectedPatient.id,
      provider: form.provider.trim(), policyNo: form.policyNo.trim() || selectedPatient.insurancePolicy || "-",
      claimAmount: parseFloat(form.claimAmount) || 0, approvedAmount: 0,
      date: new Date().toISOString().split("T")[0], status: "Pending",
      treatment: form.treatment.trim(), branch: branchData.branch,
      invoiceId: form.invoiceId || undefined,
      type: (form.type || "") as InsuranceClaim["type"],
      admissionDate: form.admissionDate, dischargeDate: form.dischargeDate,
      tpaName: form.tpaName.trim(), remarks: form.remarks.trim(),
    };
    try {
      const res = await fetch("/api/insurance-claims", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newClaim) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create claim."); }
      const saved = await res.json();
      addInsuranceClaim(saved);
      toast({ title: "Claim Created", description: `Claim for ${selectedPatient.name} — ${form.provider}${form.invoiceId ? " linked to the selected bill" : ""}.` });
      setForm({ patientId: "", provider: "", policyNo: "", type: "", treatment: "", claimAmount: "", invoiceId: "", admissionDate: "", dischargeDate: "", tpaName: "", remarks: "" });
      setPatientQuery("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create claim", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>New Insurance Claim</DialogTitle><DialogDescription>Linked to the patient record and optionally one bill.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Patient *</Label>
            <Input value={patientQuery} onChange={(e) => { setPatientQuery(e.target.value); setForm((f) => ({ ...f, patientId: "" })); }} placeholder="Search name, UHID, or phone…" list="claim-patients" />
            <datalist id="claim-patients">
              {patientMatches.map((p) => <option key={p.id} value={p.name}>{`${p.uhid} • ${p.phone} • ${p.insuranceProvider || "No insurance"}`}</option>)}
            </datalist>
            {selectedPatient ? (
              <p className="text-[11px] text-success">Selected: {selectedPatient.name} ({selectedPatient.uhid}) • {selectedPatient.insuranceProvider || "No insurance on file"}</p>
            ) : patientQuery.trim() ? (
              <div className="space-y-1">
                {patientMatches.map((p) => (
                  <button key={p.id} type="button" onClick={() => pickPatient(p.id)} className="w-full text-left rounded-md border px-2 py-1.5 text-xs hover:border-primary">
                    <span className="font-medium">{p.name}</span> <span className="text-muted-foreground">{p.uhid} • {p.insuranceProvider || "No insurance"}</span>
                  </button>
                ))}
                {patientMatches.length === 0 && <p className="text-[11px] text-destructive">No patient matches — add them in Patients first.</p>}
              </div>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider *</Label>
              <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Select or type provider" list="claim-providers" />
              <datalist id="claim-providers">{providerOptions.map((p) => <option key={p} value={p} />)}</datalist>
            </div>
            <div className="space-y-2"><Label>Policy No</Label><Input value={form.policyNo} onChange={(e) => setForm({ ...form, policyNo: e.target.value })} placeholder="Auto from patient" /></div>
          </div>
          <div className="space-y-2">
            <Label>Linked Bill (optional)</Label>
            <Select value={form.invoiceId} onValueChange={pickInvoice} disabled={!selectedPatient}>
              <SelectTrigger><SelectValue placeholder={selectedPatient ? "Select a pending bill…" : "Pick a patient first"} /></SelectTrigger>
              <SelectContent>
                {patientInvoices.map((inv) => {
                  const due = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                  return <SelectItem key={inv.id} value={inv.id}>{inv.invoiceNo} • ₹{(inv.total || 0).toLocaleString("en-IN")} • {inv.status}{due > 0 ? ` (due ₹${due.toLocaleString("en-IN")})` : ""}</SelectItem>;
                })}
              </SelectContent>
            </Select>
            {form.invoiceId && <p className="text-[11px] text-muted-foreground">Claim amount auto-filled from the bill. Approving the claim can apply it straight to this bill.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Type *</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue placeholder="Cashless / Reimbursement" /></SelectTrigger><SelectContent>{["Cashless", "Reimbursement"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Claim Amount (₹)</Label><Input type="number" min={0} value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} placeholder="Amount" /></div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hospitalization</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Admission Date</Label><Input type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></div>
              <div className="space-y-2"><Label>Discharge Date</Label><Input type="date" value={form.dischargeDate} min={form.admissionDate || undefined} onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>TPA (Third-Party Administrator)</Label><Input value={form.tpaName} onChange={(e) => setForm({ ...form, tpaName: e.target.value })} placeholder="e.g. Medi Assist, Vidal Health" /></div>
          </div>
          <div className="space-y-2"><Label>Treatment</Label><Input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Treatment details" /></div>
          <div className="space-y-2"><Label>Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Notes, documents sent, rejection reason…" /></div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Claim</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditClaimDialog({ claim, onClose }: { claim: InsuranceClaim; onClose: () => void }) {
  const { toast } = useToast();
  const updateInsuranceClaim = useAppStore((s) => s.updateInsuranceClaim);
  const [form, setForm] = useState({
    patient: claim.patientName,
    provider: claim.provider,
    policyNo: claim.policyNo,
    type: claim.type ?? "",
    claimAmount: String(claim.claimAmount),
    approvedAmount: String(claim.approvedAmount),
    treatment: claim.treatment,
    status: claim.status,
    admissionDate: claim.admissionDate ?? "",
    dischargeDate: claim.dischargeDate ?? "",
    tpaName: claim.tpaName ?? "",
    remarks: claim.remarks ?? "",
  });

  const handleSubmit = async () => {
    if (!form.patient || !form.provider) {
      toast({ title: "Error", description: "Patient and Provider are required", variant: "destructive" });
      return;
    }
    const updatedFields = {
      patientName: form.patient,
      provider: form.provider,
      policyNo: form.policyNo,
      type: form.type,
      claimAmount: parseFloat(form.claimAmount) || 0,
      approvedAmount: parseFloat(form.approvedAmount) || 0,
      treatment: form.treatment,
      status: form.status,
      admissionDate: form.admissionDate,
      dischargeDate: form.dischargeDate,
      tpaName: form.tpaName,
      remarks: form.remarks,
    };
    try {
      const res = await fetch("/api/insurance-claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: claim.id, ...updatedFields }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update claim."); }
      const saved = await res.json();
      updateInsuranceClaim(saved.id, saved);
      toast({ title: "Success", description: `Insurance claim updated for ${form.patient}` });
      onClose();
    } catch (e: any) {
      toast({ title: "Could not update claim", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Insurance Claim</DialogTitle><DialogDescription>Update insurance claim details</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Patient *</Label><Input value={form.patient} onChange={(e) => setForm({ ...form, patient: e.target.value })} placeholder="Patient name" /></div>
          <div className="space-y-2"><Label>Provider *</Label><Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder="Insurance provider" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Policy No</Label><Input value={form.policyNo} onChange={(e) => setForm({ ...form, policyNo: e.target.value })} placeholder="Policy number" /></div>
          <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as "Cashless" | "Reimbursement" | "" })}><SelectTrigger><SelectValue placeholder="Cashless / Reimbursement" /></SelectTrigger><SelectContent>{["Cashless", "Reimbursement"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as InsuranceClaim["status"] })}><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger><SelectContent>{["Pending", "Pre-Auth", "Approved", "Rejected", "Settled", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>TPA</Label><Input value={form.tpaName} onChange={(e) => setForm({ ...form, tpaName: e.target.value })} placeholder="Third-party administrator" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Admission Date</Label><Input type="date" value={form.admissionDate} onChange={(e) => setForm({ ...form, admissionDate: e.target.value })} /></div>
          <div className="space-y-2"><Label>Discharge Date</Label><Input type="date" value={form.dischargeDate} min={form.admissionDate || undefined} onChange={(e) => setForm({ ...form, dischargeDate: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Claim Amount (₹)</Label><Input value={form.claimAmount} onChange={(e) => setForm({ ...form, claimAmount: e.target.value })} placeholder="Amount" /></div>
          <div className="space-y-2"><Label>Approved Amount (₹)</Label><Input value={form.approvedAmount} onChange={(e) => setForm({ ...form, approvedAmount: e.target.value })} placeholder="Approved amount" /></div>
        </div>
        <div className="space-y-2"><Label>Treatment</Label><Input value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="Treatment details" /></div>
        <div className="space-y-2"><Label>Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} placeholder="Notes, rejection reason…" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Save Changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddLeadDialog({ open, onOpenChange, initialStage }: { open: boolean; onOpenChange: (v: boolean) => void; initialStage?: string }) {
  const { toast } = useToast();
  const addLead = useAppStore((s) => s.addLead);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", phone: "", source: "", interest: "", estimatedValue: "", assignedTo: "", stage: initialStage || "New Lead" });

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, stage: initialStage || "New Lead" }));
  }, [open, initialStage]);

  const handleSubmit = async () => {
    if (!form.name) {
      toast({ title: "Error", description: "Lead name is required", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const newLead: Lead = {
      id: `lead${Date.now()}`, name: form.name, phone: form.phone, email: "",
      source: (form.source || "Walk-in") as Lead["source"], stage: (form.stage || "New Lead") as Lead["stage"],
      interest: form.interest, estimatedValue: parseFloat(form.estimatedValue) || 0,
      assignedTo: form.assignedTo, createdOn: today, lastContact: today, branch: branchData.branch,
    };
    try {
      const res = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLead) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add lead."); }
      const saved = await res.json();
      addLead(saved);
      toast({ title: "Success", description: `Lead ${form.name} added successfully` });
      setForm({ name: "", phone: "", source: "", interest: "", estimatedValue: "", assignedTo: "", stage: initialStage || "New Lead" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add lead", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add Lead</DialogTitle><DialogDescription>Add a new lead to the CRM pipeline</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Lead name" /></div>
          <div className="space-y-2"><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone number" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Source</Label><Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}><SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger><SelectContent>{["Website", "Facebook", "Google Ads", "Walk-in", "Referral", "Phone Call", "WhatsApp", "Email"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Estimated Value (₹)</Label><Input value={form.estimatedValue} onChange={(e) => setForm({ ...form, estimatedValue: e.target.value })} placeholder="Value" /></div>
        </div>
        <div className="space-y-2"><Label>Interest</Label><Input value={form.interest} onChange={(e) => setForm({ ...form, interest: e.target.value })} placeholder="Area of interest" /></div>
        <div className="space-y-2"><Label>Assigned To</Label><Input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} placeholder="Staff member" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Add Lead</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Campaign audiences (mirrors Settings → Integrations → Send Center) =====
export const CAMPAIGN_AUDIENCES: { value: CampaignAudienceKind; label: string }[] = [
  { value: "all-patients", label: "All Patients" },
  { value: "patient", label: "Individual Patient" },
  { value: "all-doctors", label: "All Doctors" },
  { value: "doctor", label: "Individual Doctor" },
  { value: "all-staff", label: "All Staff" },
  { value: "staff", label: "Individual Staff" },
];

export function audienceCount(
  kind: CampaignAudienceKind,
  patients: { id: string }[],
  doctors: { id: string }[],
  staff: { id: string }[],
  personId?: string
): number {
  switch (kind) {
    case "all-patients": return patients.length;
    case "patient": return personId ? 1 : 0;
    case "all-doctors": return doctors.length;
    case "doctor": return personId ? 1 : 0;
    case "all-staff": return staff.length;
    case "staff": return personId ? 1 : 0;
  }
}

export function audienceLabel(c: Pick<Campaign, "audienceKind" | "audienceRefName" | "audience">): string {
  const name = CAMPAIGN_AUDIENCES.find((a) => a.value === (c.audienceKind ?? "all-patients"))?.label ?? "All Patients";
  return c.audienceRefName ? `${name} — ${c.audienceRefName}` : `${name} (${c.audience})`;
}

/** Resolve campaign recipients for the bulk-send API (max 100). */
export function resolveCampaignRecipients(
  c: Campaign,
  channel: "whatsapp" | "sms" | "email",
  patients: { id: string; name: string; phone: string; email: string }[],
  doctors: { id: string; name: string; phone: string; email: string }[],
  staff: { id: string; name: string; phone: string; email: string }[]
): { to: string; name: string }[] {
  const kind = c.audienceKind ?? "all-patients";
  const pick = (p: { phone: string; email: string }) => (channel === "email" ? (p.email || "").trim() : (p.phone || "").trim());
  let pool: { id: string; name: string; phone: string; email: string }[] = [];
  if (kind === "all-patients") pool = patients;
  else if (kind === "all-doctors") pool = doctors;
  else if (kind === "all-staff") pool = staff;
  else {
    const all = [...patients, ...doctors, ...staff];
    const one = all.find((x) => x.id === c.audienceRefId) ?? (c.audienceRefName ? all.find((x) => x.name === c.audienceRefName) : undefined);
    if (one) pool = [one];
  }
  return pool
    .map((p) => ({ to: pick(p), name: p.name }))
    .filter((r) => !!r.to)
    .slice(0, 100);
}

function AudiencePicker({ kind, personId, query, onKind, onPerson, onQuery }: {
  kind: CampaignAudienceKind; personId: string; query: string;
  onKind: (k: CampaignAudienceKind) => void; onPerson: (id: string) => void; onQuery: (q: string) => void;
}) {
  const { patients, doctors, staffMembers } = useBranchData();
  const individual = kind === "patient" || kind === "doctor" || kind === "staff";
  const pool: { id: string; name: string; extra: string }[] =
    kind === "patient"
      ? patients.map((p) => ({ id: p.id, name: p.name, extra: p.phone || p.email || "" }))
      : kind === "doctor"
        ? doctors.map((d: any) => ({ id: d.id, name: d.name, extra: d.specialization ?? d.department ?? "" }))
        : kind === "staff"
          ? staffMembers.map((m: any) => ({ id: m.id, name: m.name, extra: m.role ?? "" }))
          : [];
  const q = query.trim().toLowerCase();
  const options = (q ? pool.filter((x) => `${x.name} ${x.extra}`.toLowerCase().includes(q)) : pool).slice(0, 60);
  const count = audienceCount(kind, patients, doctors, staffMembers, personId);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Audience *</Label>
          <Select value={kind} onValueChange={(v) => { onKind(v as CampaignAudienceKind); onPerson(""); onQuery(""); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CAMPAIGN_AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Recipients</Label>
          <div className="h-9 flex items-center rounded-md border bg-muted/40 px-3 text-xs font-semibold">{count} recipient{count === 1 ? "" : "s"}</div>
        </div>
      </div>
      {individual && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Search</Label>
            <Input className="h-9" placeholder="Type name…" value={query} onChange={(e) => onQuery(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Pick person ({options.length} shown)</Label>
            <Select value={personId} onValueChange={onPerson}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Choose…" /></SelectTrigger>
              <SelectContent>
                {options.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}{x.extra ? ` — ${x.extra}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}

function NewCampaignDialog({ open, onOpenChange, initialType }: { open: boolean; onOpenChange: (v: boolean) => void; initialType?: string }) {
  const { toast } = useToast();
  const addCampaign = useAppStore((s) => s.addCampaign);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", type: initialType || "", startDate: "", message: "" });
  const [audKind, setAudKind] = useState<CampaignAudienceKind>("all-patients");
  const [audPersonId, setAudPersonId] = useState("");
  const [audQuery, setAudQuery] = useState("");

  useEffect(() => {
    if (open) setForm((f) => ({ ...f, type: initialType || "" }));
  }, [open, initialType]);

  const individual = audKind === "patient" || audKind === "doctor" || audKind === "staff";
  const audienceSize = audienceCount(audKind, branchData.patients, branchData.doctors, branchData.staffMembers, audPersonId);

  const handleSubmit = async () => {
    if (!form.name) {
      toast({ title: "Error", description: "Campaign name is required", variant: "destructive" });
      return;
    }
    if (individual && !audPersonId) {
      toast({ title: "Pick a person", description: "Choose who this campaign targets.", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const refName = individual
      ? [...branchData.patients, ...branchData.doctors, ...branchData.staffMembers].find((x) => x.id === audPersonId)?.name ?? ""
      : "";
    const newCampaign: Campaign = {
      id: `camp${Date.now()}`, name: form.name, type: (form.type || "Email") as Campaign["type"],
      status: "Scheduled", audience: audienceSize, sent: 0, opened: 0,
      clicked: 0, conversions: 0, startDate: form.startDate || today, branch: branchData.branch,
      audienceKind: audKind, audienceRefId: audPersonId, audienceRefName: refName,
      message: form.message.trim(),
    };
    try {
      const res = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newCampaign) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create campaign."); }
      const saved = await res.json();
      addCampaign(saved);
      toast({ title: "Success", description: `Campaign ${form.name} created for ${audienceSize} recipient${audienceSize === 1 ? "" : "s"}` });
      setForm({ name: "", type: initialType || "", startDate: "", message: "" });
      setAudKind("all-patients");
      setAudPersonId("");
      setAudQuery("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create campaign", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>New Campaign</DialogTitle><DialogDescription>Create a new marketing campaign</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Campaign name" /></div>
          <div className="space-y-2"><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger><SelectContent>{["Email", "SMS", "WhatsApp", "Referral"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Start Date</Label><Input value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} placeholder="YYYY-MM-DD" /></div>
        </div>
        <AudiencePicker kind={audKind} personId={audPersonId} query={audQuery} onKind={setAudKind} onPerson={setAudPersonId} onQuery={setAudQuery} />
        <div className="space-y-2"><Label>Message</Label><Textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Campaign message content — sent as-is on Send now" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Campaign</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Insurance Module =====
export function InsuranceModule() {
  const { insuranceClaims, invoices, branch } = useBranchData();
  const totalClaimed = insuranceClaims.reduce((s, c) => s + c.claimAmount, 0);
  const totalApproved = insuranceClaims.reduce((s, c) => s + c.approvedAmount, 0);
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const updateInsuranceClaim = useAppStore((s) => s.updateInsuranceClaim);
  const deleteInsuranceClaim = useAppStore((s) => s.deleteInsuranceClaim);
  const addInsuranceClaim = useAppStore((s) => s.addInsuranceClaim);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const [newClaimOpen, setNewClaimOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<InsuranceClaim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const showAdd = canManageInsurance(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "insurance");
  const showDelete = canDeleteModule(currentUser.role, "insurance");
  const {
    pageItems: pagedClaims, page: claimPage, setPage: setClaimPage,
    pageSize: claimPageSize, setPageSize: setClaimPageSize, totalPages: claimPages, total: claimTotal,
  } = usePagination(insuranceClaims, "");
  const claimIO: EntityIOConfig<InsuranceClaim> = {
    entity: "insurance claims",
    filename: "insurance-claims",
    columns: [
      { header: "patientName", sample: "Ravi Kumar" },
      { header: "patientId", sample: "" },
      { header: "provider", sample: "Star Health" },
      { header: "policyNo", sample: "POL123" },
      { header: "type", sample: "Cashless" },
      { header: "claimAmount", sample: "25000" },
      { header: "treatment", sample: "Appendectomy" },
      { header: "admissionDate", sample: "2026-09-01" },
      { header: "dischargeDate", sample: "2026-09-05" },
      { header: "tpaName", sample: "Medi Assist" },
      { header: "remarks", sample: "" },
      { header: "invoiceNo", sample: "" },
      { header: "claimNo", sample: "CLM-12345" },
      { header: "approvedAmount", sample: "20000" },
      { header: "date", sample: new Date().toISOString().split("T")[0] },
      { header: "status", sample: "Pending" },
    ],
    toRow: (c) => [c.patientName, c.patientId, c.provider, c.policyNo, c.type ?? "", c.claimAmount, c.treatment, c.admissionDate ?? "", c.dischargeDate ?? "", c.tpaName ?? "", c.remarks ?? "", invoices.find((i) => i.id === c.invoiceId)?.invoiceNo ?? "", c.claimNo, c.approvedAmount, c.date, c.status],
    fromRow: (row, i) => {
      if (!row.patientName || !row.provider) throw new Error("patientName and provider are required.");
      const linked = row.invoiceNo ? invoices.find((inv) => inv.invoiceNo === String(row.invoiceNo).trim()) : undefined;
      const validStatus = ["Pending", "Pre-Auth", "Approved", "Rejected", "Settled", "Follow Up"];
      return {
        id: `ins${Date.now()}${i}`,
        claimNo: row.claimNo?.trim() || `CLM-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
        patientName: row.patientName,
        patientId: row.patientId || "",
        provider: row.provider,
        policyNo: row.policyNo || "-",
        type: (row.type || "") as InsuranceClaim["type"],
        claimAmount: parseFloat(row.claimAmount) || 0,
        approvedAmount: parseFloat(row.approvedAmount) || 0,
        date: row.date || new Date().toISOString().split("T")[0],
        status: validStatus.includes(row.status) ? row.status : "Pending",
        treatment: row.treatment || "",
        admissionDate: row.admissionDate || "",
        dischargeDate: row.dischargeDate || "",
        tpaName: row.tpaName || "",
        remarks: row.remarks || "",
        invoiceId: linked?.id,
        branch: branch,
      };
    },
    endpoint: "/api/insurance-claims",
    onImported: (saved) => addInsuranceClaim(saved),
  };

  // Apply an approved amount straight to the linked bill (Insurance payment).
  const applyToBill = async (claim: InsuranceClaim) => {
    const inv = invoices.find((i) => i.id === claim.invoiceId);
    if (!inv) { toast({ title: "No linked bill", description: "Link a bill to this claim first (Edit).", variant: "destructive" }); return; }
    const due = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
    const amount = Math.min(claim.approvedAmount || 0, due);
    if (amount <= 0) { toast({ title: "Nothing to apply", description: "No approved amount outstanding on the linked bill.", variant: "destructive" }); return; }
    setApplyingId(claim.id);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inv.id,
          paidAmount: (inv.paidAmount || 0) + amount,
          paymentMethod: inv.paymentMethod || "Insurance",
          paidDate: new Date().toISOString().split("T")[0],
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update the bill."); }
      const saved = await res.json();
      updateInvoice(inv.id, saved);
      toast({ title: "Applied to Bill", description: `₹${amount.toLocaleString("en-IN")} of ${inv.invoiceNo} covered by ${claim.provider}. Status auto-updated to ${saved.status}.` });
    } catch (e: any) {
      toast({ title: "Could not apply", description: e.message, variant: "destructive" });
    } finally {
      setApplyingId(null);
    }
  };

  const rejectedCount = insuranceClaims.filter(c => c.status === "Rejected").length;
  const rejectionRate = insuranceClaims.length > 0 ? Math.round((rejectedCount / insuranceClaims.length) * 100) : 0;

  const providerMap = new Map<string, number>();
  for (const c of insuranceClaims) {
    providerMap.set(c.provider, (providerMap.get(c.provider) || 0) + 1);
  }
  const providerColors = ["oklch(0.55 0.22 259)", "oklch(0.62 0.19 155)", "oklch(0.72 0.18 70)", "oklch(0.6 0.13 230)", "oklch(0.58 0.24 27)"];
  const providerData = Array.from(providerMap.entries()).map(([name, value], i) => ({ name, value, color: providerColors[i % providerColors.length] }));

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/insurance-claims", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
      deleteInsuranceClaim(deleteTarget.id);
      toast({ title: "Deleted", description: `Claim for ${deleteTarget.name} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance"
        description="Claims management, pre-authorization, and settlement tracking"
        icon={ShieldCheck}
        action={showAdd ? <div className="flex items-center gap-1.5"><ImportExportButtons config={claimIO} items={insuranceClaims} compact /><Button size="sm" className="gap-2" onClick={() => setNewClaimOpen(true)}><Plus className="h-3.5 w-3.5" /> New Claim</Button></div> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Claims" value={insuranceClaims.length.toString()} icon={ShieldCheck} color="primary" />
        <StatCard title="Approved Amount" value={`₹${(totalApproved / 1000).toFixed(0)}K`} icon={CheckCircle2} color="success" />
        <StatCard title="Pending" value={insuranceClaims.filter(c => c.status === "Pending" || c.status === "Pre-Auth").length.toString()} icon={Clock} color="warning" />
        <StatCard title="Rejection Rate" value={`${rejectionRate}%`} icon={XCircle} color="destructive" subtitle={`${rejectedCount} rejected`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Claims by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={providerData} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Claims">
                  {providerData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Claim Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Settled", value: 1, fill: "oklch(0.62 0.19 155)" },
                    { name: "Approved", value: 1, fill: "oklch(0.55 0.22 259)" },
                    { name: "Pending", value: 1, fill: "oklch(0.72 0.18 70)" },
                    { name: "Pre-Auth", value: 1, fill: "oklch(0.6 0.13 230)" },
                    { name: "Rejected", value: 1, fill: "oklch(0.58 0.24 27)" },
                  ]}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
                />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              {["Settled", "Approved", "Pending", "Pre-Auth", "Rejected"].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: ["oklch(0.62 0.19 155)", "oklch(0.55 0.22 259)", "oklch(0.72 0.18 70)", "oklch(0.6 0.13 230)", "oklch(0.58 0.24 27)"][i] }} />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Claims List ({claimTotal})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Claim #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Provider</TableHead>
                  <TableHead className="hidden lg:table-cell">Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Treatment</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Approved</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked Bill</TableHead>
                  {(showEdit || showDelete) && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedClaims.map((c) => {
                  const inv = invoices.find((i) => i.id === c.invoiceId);
                  const due = inv ? Math.max(0, (inv.total || 0) - (inv.paidAmount || 0)) : 0;
                  const canApply = showEdit && (c.status === "Approved" || c.status === "Settled") && (c.approvedAmount || 0) > 0 && due > 0;
                  return (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{c.claimNo}</TableCell>
                    <TableCell className="text-sm font-medium">
                      {c.patientName}
                      {(c.admissionDate || c.dischargeDate) && (
                        <p className="text-[10px] text-muted-foreground font-normal">{c.admissionDate || "—"} → {c.dischargeDate || "—"}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      {c.provider}
                      {c.tpaName && <p className="text-[10px] text-muted-foreground">TPA: {c.tpaName}</p>}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">{c.type ? <Badge variant="outline" className="text-[10px]">{c.type}</Badge> : <span className="text-[11px] text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{c.treatment}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{c.claimAmount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-success">
                      {c.approvedAmount > 0 ? `₹${c.approvedAmount.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell>
                      <Select value={c.status} onValueChange={async (v) => {
                        try {
                          const res = await fetch("/api/insurance-claims", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: v }) });
                          if (!res.ok) throw new Error("Failed");
                          updateInsuranceClaim(c.id, { status: v as InsuranceClaim["status"] });
                        } catch { toast({ title: "Could not update status", variant: "destructive" }); }
                      }}>
                        <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Pending", "Pre-Auth", "Approved", "Rejected", "Settled", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {inv ? (
                        <div className="space-y-1">
                          <p className="font-mono text-[11px]">{inv.invoiceNo}</p>
                          <p className={`text-[11px] font-medium ${due > 0 ? "text-warning" : "text-success"}`}>{due > 0 ? `Due ₹${due.toLocaleString("en-IN")}` : "Paid"}</p>
                          {canApply && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1 border-success/50 text-success hover:bg-success/10" disabled={applyingId === c.id} onClick={() => applyToBill(c)}>
                              <DollarSign className="h-3 w-3" /> {applyingId === c.id ? "Applying…" : `Apply ₹${Math.min(c.approvedAmount, due).toLocaleString("en-IN")}`}
                            </Button>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {(showEdit || showDelete) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditTarget(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                          {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: c.id, name: c.patientName })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pb-3">
            <DataPagination page={claimPage} totalPages={claimPages} pageSize={claimPageSize} total={claimTotal} onPage={setClaimPage} onPageSize={setClaimPageSize} />
          </div>
        </CardContent>
      </Card>
      <NewClaimDialog open={newClaimOpen} onOpenChange={setNewClaimOpen} />
      {editTarget && <EditClaimDialog claim={editTarget} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Claim</DialogTitle><DialogDescription>Are you sure you want to delete the claim for <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== CRM Module =====
const leadStages = ["New Lead", "Contacted", "Appointment", "Visit", "Treatment", "Follow-up", "Review", "Repeat Patient"];

const sourceIcons = {
  "Website": Globe,
  "Facebook": Facebook,
  "Google Ads": Target,
  "Walk-in": Users,
  "Referral": RefreshCw,
  "Phone Call": Phone,
  "WhatsApp": MessageSquare,
  "Email": Mail,
};

const sourceColors = {
  "Website": "bg-primary/10 text-primary",
  "Facebook": "bg-info/10 text-info",
  "Google Ads": "bg-warning/10 text-warning",
  "Walk-in": "bg-success/10 text-success",
  "Referral": "bg-primary/10 text-primary",
  "Phone Call": "bg-info/10 text-info",
  "WhatsApp": "bg-success/10 text-success",
  "Email": "bg-warning/10 text-warning",
};

export function CRMModule() {
  const { leads } = useBranchData();
  const totalValue = leads.reduce((s, l) => s + l.estimatedValue, 0);
  const convertedLeads = leads.filter(l => l.stage === "Treatment" || l.stage === "Review" || l.stage === "Repeat Patient").length;
  const conversionRate = leads.length > 0 ? Math.round((convertedLeads / leads.length) * 100) : 0;
  const avgDealSize = leads.length > 0 ? Math.round(totalValue / leads.length) : 0;
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const updateLead = useAppStore((s) => s.updateLead);
  const deleteLead = useAppStore((s) => s.deleteLead);
  const [addLeadOpen, setAddLeadOpen] = useState(false);
  const [addStage, setAddStage] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const showAdd = canAddAnything(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "crm");
  const showDelete = canDeleteModule(currentUser.role, "crm");

  const handleStageChange = async (lead: Lead, stage: string) => {
    try {
      const res = await fetch("/api/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: lead.id, stage, lastContact: new Date().toISOString().split("T")[0] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update lead.");
      }
      const saved = await res.json();
      updateLead(lead.id, saved);
    } catch (e: any) {
      toast({ title: "Could not update lead", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/leads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete lead.");
      }
      deleteLead(deleteTarget.id);
      toast({ title: "Lead deleted", description: `${deleteTarget.name} removed from CRM.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete lead", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM — Lead Management"
        description="Track leads from acquisition to repeat patient conversion"
        icon={Users}
        action={showAdd ? <Button size="sm" className="gap-2" onClick={() => { setAddStage(null); setAddLeadOpen(true); }}><UserPlus className="h-3.5 w-3.5" /> Add Lead</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Active Leads" value={leads.length.toString()} icon={Users} color="primary" />
        <StatCard title="Pipeline Value" value={`₹${(totalValue / 100000).toFixed(1)}L`} icon={DollarSign} color="success" />
        <StatCard title="Conversion Rate" value={`${conversionRate}%`} icon={TrendingUp} color="info" />
        <StatCard title="Avg Deal Size" value={`₹${(avgDealSize / 1000).toFixed(0)}K`} icon={Target} color="warning" />
      </div>

      {/* Pipeline Kanban */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex gap-3 min-w-[1000px]">
            {leadStages.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage === stage);
              const stageValue = stageLeads.reduce((s, l) => s + l.estimatedValue, 0);
              return (
                <div key={stage} className="w-56 shrink-0">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <div>
                      <p className="text-xs font-semibold">{stage}</p>
                      <p className="text-[10px] text-muted-foreground">{stageLeads.length} leads • ₹{(stageValue / 1000).toFixed(0)}K</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setAddStage(stage); setAddLeadOpen(true); }}>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2 min-h-[100px] p-1 rounded-lg bg-muted/30">
                    {stageLeads.map((lead) => {
                      const SourceIcon = sourceIcons[lead.source];
                      return (
                        <motion.div
                          key={lead.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border bg-background p-3 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{lead.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{lead.interest}</p>
                            </div>
                            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sourceColors[lead.source]}`}>
                              <SourceIcon className="h-3 w-3" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[9px]">{lead.source}</Badge>
                            <span className="text-xs font-semibold text-success">₹{(lead.estimatedValue / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{lead.assignedTo}</span>
                            <span>{lead.lastContact}</span>
                          </div>
                          {(showEdit || showDelete) && (
                            <div className="mt-2 flex items-center gap-1 border-t pt-2">
                              {showEdit && (
                                <Select value={lead.stage} onValueChange={(value) => handleStageChange(lead, value)}>
                                  <SelectTrigger className="h-7 flex-1 text-[10px]"><SelectValue /></SelectTrigger>
                                  <SelectContent>{leadStages.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                              )}
                              {showDelete && (
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: lead.id, name: lead.name })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead Sources Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {(Object.keys(sourceIcons) as (keyof typeof sourceIcons)[]).map((source) => {
              const Icon = sourceIcons[source];
              const count = leads.filter(l => l.source === source).length;
              return (
                <div key={source} className="rounded-lg border p-3 text-center hover:shadow-md transition-shadow cursor-pointer">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl mb-2 ${sourceColors[source]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{source}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      <AddLeadDialog open={addLeadOpen} onOpenChange={setAddLeadOpen} initialStage={addStage ?? undefined} />
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Lead</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Marketing Module =====
function EditCampaignDialog({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const { toast } = useToast();
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const { patients, doctors, staffMembers } = useBranchData();
  const [form, setForm] = useState({
    name: campaign.name, type: campaign.type, status: campaign.status,
    audience: String(campaign.audience), sent: String(campaign.sent),
    opened: String(campaign.opened), clicked: String(campaign.clicked),
    conversions: String(campaign.conversions), startDate: campaign.startDate, message: campaign.message ?? "",
  });
  const [audKind, setAudKind] = useState<CampaignAudienceKind>(campaign.audienceKind ?? "all-patients");
  const [audPersonId, setAudPersonId] = useState(campaign.audienceRefId ?? "");
  const [audQuery, setAudQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", description: "Campaign name is required.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: campaign.id, name: form.name.trim(), type: form.type, status: form.status,
          audience: parseInt(form.audience) || 0, sent: parseInt(form.sent) || 0,
          opened: parseInt(form.opened) || 0, clicked: parseInt(form.clicked) || 0,
          conversions: parseInt(form.conversions) || 0, startDate: form.startDate,
          audienceKind: audKind, audienceRefId: audPersonId,
          audienceRefName: audPersonId
            ? [...patients, ...doctors, ...staffMembers].find((x) => x.id === audPersonId)?.name ?? campaign.audienceRefName ?? ""
            : "",
          message: form.message.trim(),
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update campaign."); }
      updateCampaign(campaign.id, await res.json());
      toast({ title: "Campaign Updated", description: `${form.name} saved with latest results.` });
      onClose();
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Campaign</DialogTitle><DialogDescription>Update details and record real results.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <AudiencePicker kind={audKind} personId={audPersonId} query={audQuery} onKind={setAudKind} onPerson={setAudPersonId} onQuery={setAudQuery} />
          <div className="space-y-2"><Label>Message</Label><Textarea rows={2} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Campaign message content" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Campaign["type"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Email", "SMS", "WhatsApp", "Referral"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Campaign["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Active", "Scheduled", "Completed", "Draft", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary mb-2">Results</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>Audience</Label><Input type="number" min={0} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sent</Label><Input type="number" min={0} value={form.sent} onChange={(e) => setForm({ ...form, sent: e.target.value })} /></div>
              <div className="space-y-2"><Label>Opened</Label><Input type="number" min={0} value={form.opened} onChange={(e) => setForm({ ...form, opened: e.target.value })} /></div>
              <div className="space-y-2"><Label>Clicked</Label><Input type="number" min={0} value={form.clicked} onChange={(e) => setForm({ ...form, clicked: e.target.value })} /></div>
              <div className="space-y-2"><Label>Conversions</Label><Input type="number" min={0} value={form.conversions} onChange={(e) => setForm({ ...form, conversions: e.target.value })} /></div>
            </div>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving…" : "Save Campaign"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MarketingModule() {
  const { campaigns, branch, patients, doctors, staffMembers } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const { toast } = useToast();
  const updateCampaign = useAppStore((s) => s.updateCampaign);
  const deleteCampaign = useAppStore((s) => s.deleteCampaign);
  const addCampaign = useAppStore((s) => s.addCampaign);
  const [newCampaignOpen, setNewCampaignOpen] = useState(false);
  const [newCampaignType, setNewCampaignType] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const showAdd = canAddAnything(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "marketing");
  const showDelete = canDeleteModule(currentUser.role, "marketing");
  const {
    pageItems: pagedCampaigns, page: campPage, setPage: setCampPage,
    pageSize: campPageSize, setPageSize: setCampPageSize, totalPages: campPages, total: campTotal,
  } = usePagination(campaigns, "");
  const campaignIO: EntityIOConfig<Campaign> = {
    entity: "campaigns",
    filename: "campaigns",
    columns: [
      { header: "name", sample: "Diwali Health Camp" },
      { header: "type", sample: "WhatsApp" },
      { header: "status", sample: "Scheduled" },
      { header: "audience", sample: "500" },
      { header: "audienceKind", sample: "all-patients" },
      { header: "audienceRefName", sample: "" },
      { header: "startDate", sample: new Date().toISOString().split("T")[0] },
      { header: "message", sample: "Free checkup camp…" },
    ],
    toRow: (c) => [c.name, c.type, c.status, c.audience, c.audienceKind ?? "all-patients", c.audienceRefName ?? "", c.startDate, c.message ?? ""],
    fromRow: (row, i) => {
      if (!row.name) throw new Error("name is required.");
      if (!["Email", "SMS", "WhatsApp", "Referral"].includes(row.type)) throw new Error(`Unknown type "${row.type}". Use Email/SMS/WhatsApp/Referral.`);
      const validKinds = ["all-patients", "patient", "all-doctors", "doctor", "all-staff", "staff"];
      return {
        id: `camp${Date.now()}${i}`,
        name: row.name,
        type: row.type,
        status: ["Active", "Scheduled", "Completed", "Draft", "Follow Up"].includes(row.status) ? row.status : "Scheduled",
        audience: parseInt(row.audience) || 0,
        sent: 0, opened: 0, clicked: 0, conversions: 0,
        startDate: row.date || row.startDate || new Date().toISOString().split("T")[0],
        audienceKind: validKinds.includes(row.audienceKind) ? row.audienceKind : "all-patients",
        audienceRefId: "",
        audienceRefName: row.audienceRefName || "",
        message: row.message || "",
        branch,
      };
    },
    endpoint: "/api/campaigns",
    onImported: (saved) => addCampaign(saved),
  };

  const totalReach = campaigns.reduce((s, c) => s + c.audience, 0);
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0);
  const totalClicked = campaigns.reduce((s, c) => s + c.clicked, 0);
  const mktConversionRate = totalClicked > 0 ? ((totalConversions / totalClicked) * 100).toFixed(1) : "0";

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/campaigns", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
      deleteCampaign(deleteTarget.id);
      toast({ title: "Deleted", description: `Campaign ${deleteTarget.name} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  // Send a campaign through the configured channel (Settings → Integrations).
  const sendCampaign = async (c: Campaign) => {
    if (!["Email", "SMS", "WhatsApp"].includes(c.type)) {
      toast({ title: "Not sendable", description: "Only Email, SMS and WhatsApp campaigns send directly.", variant: "destructive" });
      return;
    }
    const channel = c.type.toLowerCase() as "email" | "sms" | "whatsapp";
    const recipients = resolveCampaignRecipients(c, channel, patients, doctors, staffMembers);
    if (recipients.length === 0) {
      toast({ title: "No valid recipients", description: "The audience has no deliverable phone numbers or emails.", variant: "destructive" });
      return;
    }
    const text = (c.message || "").trim() || `${c.name} — ${branch}`;
    setSendingId(c.id);
    try {
      const res = await fetch("/api/integrations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, recipients, message: text, subject: c.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Send failed.");
      const patch = await fetch("/api/campaigns", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: c.id, sent: (c.sent || 0) + (body.sent || 0), status: "Active" }),
      });
      if (patch.ok) updateCampaign(c.id, await patch.json());
      else updateCampaign(c.id, { sent: (c.sent || 0) + (body.sent || 0), status: "Active" });
      addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action: "CAMPAIGN_SEND", target: "marketing", branch, details: `${currentUser.name} sent "${c.name}" via ${c.type} to ${body.sent}/${body.total}.` });
      toast({ title: `Sent ${body.sent}/${body.total}`, description: body.simulated ? `${body.simulated} simulated (save provider keys for real delivery).` : `"${c.name}" delivered via ${c.type}.` });
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Campaigns across email, SMS, WhatsApp, and referral programs"
        icon={Megaphone}
        action={showAdd ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            {["Email", "SMS", "WhatsApp"].map((t) => (
              <Button key={t} size="sm" variant="outline" className="gap-1.5" onClick={() => { setNewCampaignType(t); setNewCampaignOpen(true); }} title={`New ${t} campaign`}>
                <Plus className="h-3.5 w-3.5" /> {t}
              </Button>
            ))}
            <Button size="sm" className="gap-2" onClick={() => { setNewCampaignType(null); setNewCampaignOpen(true); }}><Plus className="h-3.5 w-3.5" /> New Campaign</Button>
          </div>
        ) : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Active Campaigns" value={campaigns.filter(c => c.status === "Active").length.toString()} icon={Megaphone} color="primary" />
        <StatCard title="Total Reach" value={totalReach >= 1000 ? `${(totalReach / 1000).toFixed(1)}K` : totalReach.toString()} icon={Users} color="info" subtitle="All campaigns" />
        <StatCard title="Conversions" value={totalConversions.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Conversion Rate" value={`${mktConversionRate}%`} icon={Target} color="warning" />
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Campaign Performance ({campTotal})</CardTitle>
          {showAdd && <ImportExportButtons config={campaignIO} items={campaigns} compact />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Start Date</TableHead>
                  <TableHead className="text-right">Audience</TableHead>
                  <TableHead className="hidden md:table-cell">Open Rate</TableHead>
                  <TableHead className="hidden lg:table-cell">Click Rate</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead>Status</TableHead>
                  {(showEdit || showDelete) && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedCampaigns.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="text-sm font-medium">
                      {c.name}
                      <p className="text-[10px] text-muted-foreground font-normal">{audienceLabel(c)}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.type}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.startDate}</TableCell>
                    <TableCell className="text-right text-sm">{c.audience.toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.sent > 0 ? (
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{Math.round((c.opened / c.sent) * 100)}%</span>
                          </div>
                          <Progress value={(c.opened / c.sent) * 100} className="h-1.5" />
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.sent > 0 ? `${Math.round((c.clicked / c.sent) * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-success">{c.conversions}</TableCell>
                    <TableCell>
                      {showEdit ? (
                        <Select value={c.status} onValueChange={async (v) => {
                          try {
                            const res = await fetch("/api/campaigns", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, status: v }) });
                            if (!res.ok) throw new Error("Failed");
                            updateCampaign(c.id, { status: v as Campaign["status"] });
                          } catch { toast({ title: "Could not update status", variant: "destructive" }); }
                        }}>
                          <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>{["Active", "Scheduled", "Completed", "Draft", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <StatusBadge status={c.status} />}
                    </TableCell>
                    {(showEdit || showDelete) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {showEdit && ["Email", "SMS", "WhatsApp"].includes(c.type) && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title={`Send now via ${c.type}`} disabled={sendingId === c.id} onClick={() => sendCampaign(c)}>
                              <Send className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit campaign & results" onClick={() => setEditTarget(c)}><Pencil className="h-3.5 w-3.5" /></Button>}
                          {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: c.id, name: c.name })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pb-3">
            <DataPagination page={campPage} totalPages={campPages} pageSize={campPageSize} total={campTotal} onPage={setCampPage} onPageSize={setCampPageSize} />
          </div>
        </CardContent>
      </Card>

      {/* Campaign Types Quick Access (live counts) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Email Campaigns", desc: "Newsletter & promotions", icon: Mail, color: "primary", type: "Email" },
          { title: "SMS Campaigns", desc: "Appointment reminders", icon: MessageSquare, color: "info", type: "SMS" },
          { title: "WhatsApp", desc: "Birthday wishes & alerts", icon: MessageSquare, color: "success", type: "WhatsApp" },
          { title: "Referral Program", desc: "Patient referral rewards", icon: RefreshCw, color: "warning", type: "Referral" },
        ].map((item) => {
          const Icon = item.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
          };
          const liveCount = campaigns.filter((c) => c.type === item.type && c.status === "Active").length;
          const totalOfType = campaigns.filter((c) => c.type === item.type).length;
          return (
            <Card key={item.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[item.color as keyof typeof colorMap]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">{liveCount} active • {totalOfType} total</Badge>
                </div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs gap-1" onClick={() => { setNewCampaignType(item.type); setNewCampaignOpen(true); }}>
                  Manage <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <NewCampaignDialog open={newCampaignOpen} onOpenChange={setNewCampaignOpen} initialType={newCampaignType ?? undefined} />
      {editTarget && <EditCampaignDialog campaign={editTarget} onClose={() => setEditTarget(null)} />}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Campaign</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
