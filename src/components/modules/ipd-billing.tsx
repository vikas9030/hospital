"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { canCollectPayment, canCreateInvoice, isAdmin } from "@/lib/utils";
import { printCompleteBill, printReceipt, printRefund } from "@/lib/documents";
import { printInvoice } from "@/lib/invoice-print";
import type { Admission, CompleteBill, Payment, Refund, SurgeryCase, SurgeryCaseCharge } from "@/lib/types";
import { Printer, Plus, Wallet, Undo2, FileCheck } from "lucide-react";
import { TaxLinesEditor, type EditableTaxLine } from "@/components/modules/billing";
import { calcInvoiceTotals } from "@/lib/billing";

const CHARGE_CATEGORIES = ["Registration", "Consultation", "Bed", "Nursing", "Surgery", "Operation Theatre", "Anesthesia", "Procedure", "Pharmacy", "Laboratory", "Radiology", "Consumables", "Supplies", "Doctor", "Package", "Other"];
const PAY_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Razorpay", "Insurance", "Cheque", "Other"];

export function IPDBillingPanel({ compact = false }: { compact?: boolean }) {
  const { toast } = useToast();
  const { branch, patients } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [bill, setBill] = useState<CompleteBill | null>(null);
  const [surgeryCharges, setSurgeryCharges] = useState<SurgeryCaseCharge[]>([]);
  const [linkedCases, setLinkedCases] = useState<SurgeryCase[]>([]);
  const goModule = useAppStore((s) => s.setActiveModule);
  const [loading, setLoading] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [editAdmissionOpen, setEditAdmissionOpen] = useState(false);

  const canCharge = canCreateInvoice(currentUser.role);
  const canCollect = canCollectPayment(currentUser.role);
  const canRefundApprove = isAdmin(currentUser.role) || currentUser.role === "Accountant";
  const canDeleteCharge = isAdmin(currentUser.role);

  const deleteCharge = async (chargeId: string) => {
    try {
      const res = await fetch("/api/admission-charges", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: chargeId, actorRole: currentUser.role, actorName: currentUser.name, branch, admissionId: selectedId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Delete failed.");
      toast({ title: "Charge deleted", description: "Unbilled charge removed (correction)." });
      refreshBill(selectedId);
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
  };

  const refreshAdmissions = async () => {
    try {
      const res = await fetch(`/api/admissions?branch=${encodeURIComponent(branch)}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setAdmissions(data);
        if (!selectedId && data.length > 0) setSelectedId(data[0].id);
      }
    } catch { /* keep list */ }
  };

  useEffect(() => {
    refreshAdmissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch]);

  const refreshBill = async (id: string) => {
    if (!id) return;
    setLoading(true);
    try {
      const [billRes, surgRes, casesRes] = await Promise.all([
        fetch(`/api/billing/complete-bill?admissionId=${encodeURIComponent(id)}`),
        fetch(`/api/surgeries/charges?admissionId=${encodeURIComponent(id)}`),
        fetch(`/api/surgeries?admissionId=${encodeURIComponent(id)}`),
      ]);
      const data = await billRes.json();
      if (!billRes.ok) throw new Error(data.error || "Failed.");
      setBill(data);
      const surg = surgRes.ok ? await surgRes.json() : [];
      setSurgeryCharges(Array.isArray(surg) ? surg : []);
      const linked = casesRes.ok ? await casesRes.json() : [];
      setLinkedCases(Array.isArray(linked) ? linked : []);
    } catch (e: any) {
      toast({ title: "Bill load failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedId) refreshBill(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const admission = useMemo(() => admissions.find((a) => a.id === selectedId), [admissions, selectedId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">IPD — Admissions Ledger {bill ? `• ${bill.admission.admissionNo}` : ""}</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="h-8 w-[240px] text-xs"><SelectValue placeholder="Select admission" /></SelectTrigger>
              <SelectContent>
                {admissions.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.admissionNo} — {a.patientName} ({a.billingStatus})</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8" onClick={() => { refreshAdmissions(); if (selectedId) refreshBill(selectedId); }}>Refresh</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!bill && <p className="text-sm text-muted-foreground text-center py-8">{loading ? "Loading ledger…" : "No admission selected. Admit a patient from IPD first."}</p>}
        {bill && (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                { label: "Gross", value: bill.gross },
                { label: "Net payable", value: bill.netPayable },
                { label: "Collected", value: bill.advancePaid + bill.previousPayments },
                { label: "Refunds", value: bill.refundsTotal },
                { label: "Outstanding", value: bill.outstanding },
              ].map((k) => (
                <div key={k.label} className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] text-muted-foreground">{k.label}</p>
                  <p className="text-base font-bold">₹{k.value.toLocaleString("en-IN")}</p>
                </div>
              ))}
            </div>
            {bill.categoryTotals.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {bill.categoryTotals.map((c) => (
                  <Badge key={c.category} variant="outline" className="text-[11px]">{c.category} — ₹{c.amount.toLocaleString("en-IN")}</Badge>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <span><span className="text-muted-foreground">Joining: </span><strong>{(bill.admission.admissionAt || "").split("T")[0] || "—"}</strong></span>
              <span><span className="text-muted-foreground">→ Leave: </span><strong>{(bill.admission.dischargeAt || "").split("T")[0] || (bill.admission.expectedDischargeDate || "").split("T")[0] || "open stay"}</strong></span>
              <Badge variant="outline" className="text-[10px]">{bill.admission.status}</Badge>
              <Badge variant="outline" className="text-[10px]">{bill.admission.billingStatus}</Badge>
              {bill.admission.bedRate > 0 && <span><span className="text-muted-foreground">Bed: </span><strong>₹{bill.admission.bedRate.toLocaleString("en-IN")}/day</strong></span>}
              {canCharge && <Button size="sm" variant="outline" className="h-7 text-[11px] ml-auto" onClick={() => setEditAdmissionOpen(true)}>Edit / Extend Stay</Button>}
            </div>
            <div className="flex flex-wrap gap-2">
              {canCharge && <Button size="sm" onClick={() => setChargeOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" /> Add Charge</Button>}
              {canCollect && <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}><Wallet className="h-3.5 w-3.5 mr-1.5" /> Collect / Advance</Button>}
              {canCollect && <Button size="sm" variant="outline" onClick={() => setRefundOpen(true)}><Undo2 className="h-3.5 w-3.5 mr-1.5" /> Refund</Button>}
              {canCharge && <Button size="sm" variant="outline" onClick={() => setFinalizeOpen(true)}><FileCheck className="h-3.5 w-3.5 mr-1.5" /> Finalize Bill</Button>}
              <Button size="sm" variant="outline" onClick={() => printCompleteBill(bill, settings, surgeryCharges.filter((c) => !c.billed).map((c) => ({ label: c.label, amount: c.amount })))}><Printer className="h-3.5 w-3.5 mr-1.5" /> Print Ledger</Button>
            </div>
            {bill.charges.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">WARD CHARGES ({bill.charges.length}) — unbilled lines correctable by Admin</p>
                {bill.charges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs gap-2">
                    <span className="min-w-0">{c.category} — {c.description} <span className="text-muted-foreground">• {c.quantity} × ₹{(c.rate ?? 0).toLocaleString("en-IN")} = ₹{(c.net ?? 0).toLocaleString("en-IN")}{c.billed ? " • billed" : " • unbilled"}</span></span>
                    {!c.billed && canDeleteCharge && (
                      <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive shrink-0" onClick={() => deleteCharge(c.id)}>Delete</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {!compact && (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader><TableRow className="bg-muted/50">
                    <TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead>
                    <TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bill.ledger.map((l, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{(l.date || "").split("T")[0] || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{l.type}</Badge></TableCell>
                        <TableCell className="text-xs">{l.description}</TableCell>
                        <TableCell className="text-right text-xs">{l.debit > 0 ? `₹${l.debit.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right text-xs text-success">{l.credit > 0 ? `₹${l.credit.toLocaleString("en-IN")}` : "—"}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">₹{l.balance.toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))}
                    {bill.ledger.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">No ledger entries yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            )}
            {surgeryCharges.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  SURGERY / OT ({surgeryCharges.length}) — joins the same single final bill as beds
                </p>
                {surgeryCharges.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <span>{c.label} <span className="text-muted-foreground">• {c.category}{c.auto ? " • auto" : ""}{c.billed ? " • billed" : " • unbilled"}</span></span>
                    <strong>₹{c.amount.toLocaleString("en-IN")}</strong>
                  </div>
                ))}
                <p className="text-[11px] text-muted-foreground">
                  Unbilled surgery/OT total ₹{surgeryCharges.filter((c) => !c.billed).reduce((s, c) => s + (c.amount || 0), 0).toLocaleString("en-IN")} rolls into Finalize Bill together with ward charges.
                </p>
              </div>
            )}
            {linkedCases.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">LINKED SURGERIES ({linkedCases.length}) — same record, Surgery module</p>
                {linkedCases.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs gap-2">
                    <span className="min-w-0">{c.caseNo} • {c.surgeryName} ({c.surgeon || "TBD"}) <Badge variant="outline" className="text-[10px] ml-1">{c.status}</Badge></span>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => goModule("surgery")}>Open in Surgery →</Button>
                  </div>
                ))}
              </div>
            )}
            {bill.invoices.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">INVOICES ({bill.invoices.length})</p>
                {bill.invoices.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <span>{inv.invoiceNo} • {inv.billKind ?? "IPD"} • {inv.billStatus ?? inv.status} • ₹{(inv.total ?? 0).toLocaleString("en-IN")}</span>
                    <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => printInvoice(inv, settings, patients.find((p) => p.id === inv.patientId))}><Printer className="h-3 w-3 mr-1" /> Print</Button>
                  </div>
                ))}
              </div>
            )}
            {bill.refunds.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">REFUNDS ({bill.refunds.length})</p>
                {bill.refunds.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <span>{r.refundNo} • ₹{r.amount.toLocaleString("en-IN")} • {r.status} • {r.reason}</span>
                    <span className="flex gap-1.5">
                      <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => printRefund(r, settings)}><Printer className="h-3 w-3 mr-1" /> Advice</Button>
                      {r.status === "Requested" && canRefundApprove && (
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={async () => {
                          const res = await fetch("/api/billing/refunds", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: "Approved", actorRole: currentUser.role, actorName: currentUser.name }) });
                          if (res.ok) { toast({ title: "Refund approved", description: r.refundNo }); refreshBill(selectedId); }
                          else toast({ title: "Failed", description: (await res.json()).error, variant: "destructive" });
                        }}>Approve</Button>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        {editAdmissionOpen && bill && <EditAdmissionDialog admission={bill.admission} branch={branch} onClose={() => setEditAdmissionOpen(false)} onSaved={() => { setEditAdmissionOpen(false); refreshBill(selectedId); refreshAdmissions(); }} />}
        {chargeOpen && bill && <ChargeDialog admission={bill.admission} branch={branch} onClose={() => setChargeOpen(false)} onSaved={() => { setChargeOpen(false); refreshBill(selectedId); }} />}
        {payOpen && bill && <PayDialog admission={bill.admission} outstanding={bill.outstanding} branch={branch} onClose={() => setPayOpen(false)} onSaved={(p) => { setPayOpen(false); refreshBill(selectedId); printReceipt(p, settings); }} />}
        {refundOpen && bill && <RefundDialog admission={bill.admission} branch={branch} onClose={() => setRefundOpen(false)} onSaved={() => { setRefundOpen(false); refreshBill(selectedId); }} />}
        {finalizeOpen && bill && <FinalizeDialog bill={bill} branch={branch} onClose={() => setFinalizeOpen(false)} onSaved={() => { setFinalizeOpen(false); refreshBill(selectedId); refreshAdmissions(); }} />}
        {admission && <p className="text-[11px] text-muted-foreground">Admission {admission.admissionNo} • {admission.status} • {admission.billingStatus} • Bed {admission.bedNumber || "—"} • Pay mode {admission.payMode}</p>}
      </CardContent>
    </Card>
  );
}

const ADMISSION_STATUSES = ["Admitted", "Discharged", "Transferred", "DAMA", "Deceased", "Cancelled"] as const;
const PAY_MODES = ["Cash", "Insurance", "Corporate", "TPA", "Government Scheme"] as const;

// Edit / extend the stay: joining → leave dates, status, bed rate, doctor.
// Saving re-runs bed accrual server-side, so extending the leave date or
// changing the rate automatically adds the amount to the bill.
function EditAdmissionDialog({ admission, branch, onClose, onSaved }: { admission: Admission; branch: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({
    admissionAt: (admission.admissionAt || "").split("T")[0],
    expectedDischargeDate: (admission.expectedDischargeDate || "").split("T")[0],
    dischargeAt: (admission.dischargeAt || "").split("T")[0],
    status: admission.status,
    bedRate: String(admission.bedRate ?? ""),
    bedNumber: admission.bedNumber ?? "",
    doctorName: admission.doctorName ?? "",
    department: admission.department ?? "",
    payMode: admission.payMode ?? "Cash",
    notes: admission.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: admission.id,
          admissionAt: form.admissionAt || undefined,
          expectedDischargeDate: form.expectedDischargeDate || undefined,
          dischargeAt: form.dischargeAt || undefined,
          status: form.status,
          bedRate: form.bedRate === "" ? undefined : parseFloat(form.bedRate) || 0,
          bedNumber: form.bedNumber,
          doctorName: form.doctorName,
          department: form.department,
          payMode: form.payMode,
          notes: form.notes,
          actorName: currentUser.name,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Save failed.");
      toast({ title: "Stay updated", description: "Bed amount re-accrued automatically from the new dates × rate." });
      onSaved();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Stay — {admission.admissionNo}</DialogTitle><DialogDescription>Joining → leave dates, status, bed rate. The bill follows automatically.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Joining (admitted)</Label><Input type="date" value={form.admissionAt} onChange={(e) => setForm({ ...form, admissionAt: e.target.value })} /></div>
            <div className="space-y-2"><Label>Expected leave</Label><Input type="date" value={form.expectedDischargeDate} onChange={(e) => setForm({ ...form, expectedDischargeDate: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Actual discharge</Label><Input type="date" value={form.dischargeAt} onChange={(e) => setForm({ ...form, dischargeAt: e.target.value })} /></div>
            <div className="space-y-2"><Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as Admission["status"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ADMISSION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Bed rate ₹/day</Label><Input type="number" value={form.bedRate} onChange={(e) => setForm({ ...form, bedRate: e.target.value })} /></div>
            <div className="space-y-2"><Label>Bed</Label><Input value={form.bedNumber} onChange={(e) => setForm({ ...form, bedNumber: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Doctor</Label><Input value={form.doctorName} onChange={(e) => setForm({ ...form, doctorName: e.target.value })} /></div>
            <div className="space-y-2"><Label>Department</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>
          </div>
          <div className="space-y-2"><Label>Pay mode</Label>
            <Select value={form.payMode} onValueChange={(v) => setForm({ ...form, payMode: v as Admission["payMode"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PAY_MODES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <p className="text-[11px] text-muted-foreground">Extending the leave date (or raising the rate) adds bed days to the bill on save. Shortening rebuilds the unbilled auto rows. Billed history stays locked.</p>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save + Re-accrue Bill"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChargeDialog({ admission, branch, onClose, onSaved }: { admission: Admission; branch: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({ category: "Bed", description: "", quantity: "1", rate: "", discount: "0", tax: "0" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.description || !form.category) {
      toast({ title: "Missing fields", description: "Category and description are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admission-charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionId: admission.id, patientId: admission.patientId, category: form.category, description: form.description,
          quantity: parseFloat(form.quantity) || 1, rate: parseFloat(form.rate) || 0,
          discount: parseFloat(form.discount) || 0, tax: parseFloat(form.tax) || 0,
          idempotencyKey: `chg-${admission.id}-${Date.now()}`,
          createdBy: currentUser.name, branch,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      toast({ title: "Charge added", description: `${form.category} — ₹${body.net.toLocaleString("en-IN")}.` });
      onSaved();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Add Admission Charge</DialogTitle><DialogDescription>Posts to {admission.admissionNo} ledger (duplicate-safe).</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="space-y-2"><Label>Category *</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CHARGE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Description *</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. Bed charge — Day 3" /></div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-1"><Label className="text-[11px]">Qty</Label><Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[11px]">Rate ₹</Label><Input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[11px]">Disc ₹</Label><Input type="number" value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-[11px]">Tax ₹</Label><Input type="number" value={form.tax} onChange={(e) => setForm({ ...form, tax: e.target.value })} /></div>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Add Charge"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({ admission, outstanding, branch, onClose, onSaved }: { admission: Admission; outstanding: number; branch: string; onClose: () => void; onSaved: (p: Payment) => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({ amount: "", method: "Cash", kind: "Payment", txnRef: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const amount = parseFloat(form.amount);
    if (!(amount > 0)) {
      toast({ title: "Invalid amount", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }
    if (form.kind !== "Advance" && amount > outstanding + 0.001) {
      toast({ title: "Exceeds outstanding", description: `₹${amount} > ₹${outstanding} outstanding. Record excess as Advance.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/billing/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: admission.patientId, patientName: admission.patientName, admissionId: admission.id,
          amount, method: form.method, kind: form.kind, txnRef: form.txnRef, notes: form.notes,
          idempotencyKey: `pay-${admission.id}-${Date.now()}`,
          receivedBy: currentUser.name, branch,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      toast({ title: `${form.kind} recorded`, description: `${body.receiptNo} — ₹${body.amount.toLocaleString("en-IN")}.` });
      onSaved(body);
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect Payment</DialogTitle><DialogDescription>Outstanding ₹{outstanding.toLocaleString("en-IN")} — overpayment must be an Advance.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Amount ₹ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder={String(outstanding)} /></div>
            <div className="space-y-2"><Label>Kind</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="Payment">Payment</SelectItem><SelectItem value="Advance">Advance</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Txn ref</Label><Input value={form.txnRef} onChange={(e) => setForm({ ...form, txnRef: e.target.value })} placeholder="UPI / card ref" /></div>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Record Payment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefundDialog({ admission, branch, onClose, onSaved }: { admission: Admission; branch: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({ amount: "", method: "Cash", reason: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!(parseFloat(form.amount) > 0) || !form.reason.trim()) {
      toast({ title: "Missing fields", description: "Amount and reason are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/billing/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: admission.patientId, patientName: admission.patientName, admissionId: admission.id,
          amount: parseFloat(form.amount), method: form.method, reason: form.reason,
          branch, actorName: currentUser.name,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      toast({ title: "Refund requested", description: `${body.refundNo} needs Admin/Accountant approval.` });
      onSaved();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Request Refund</DialogTitle><DialogDescription>Original payment is kept — a reversal record is created.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Amount ₹ *</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-2"><Label>Method</Label>
              <Select value={form.method} onValueChange={(v) => setForm({ ...form, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Reason *</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Why is money being returned?" /></div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Saving..." : "Request Refund"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FinalizeDialog({ bill, branch, onClose, onSaved }: { bill: CompleteBill; branch: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [discountPercent, setDiscountPercent] = useState("0");
  const [discountReason, setDiscountReason] = useState("");
  const [taxLines, setTaxLines] = useState<EditableTaxLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [surgeryUnbilled, setSurgeryUnbilled] = useState(0);
  const [surgeryUnbilledAmount, setSurgeryUnbilledAmount] = useState(0);
  const unbilledCharges = bill.charges.filter((c) => !c.billed);
  const unbilled = unbilledCharges.length;
  const wardSubtotal = unbilledCharges.reduce((s, c) => s + Number(c.net || 0), 0);
  useEffect(() => {
    fetch(`/api/surgeries/charges?admissionId=${encodeURIComponent(bill.admission.id)}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        const list = Array.isArray(d) ? d.filter((c: { billed?: boolean }) => !c.billed) : [];
        setSurgeryUnbilled(list.length);
        setSurgeryUnbilledAmount(list.reduce((s: number, c: { amount?: number }) => s + Number(c.amount || 0), 0));
      })
      .catch(() => { setSurgeryUnbilled(0); setSurgeryUnbilledAmount(0); });
  }, [bill.admission.id]);
  const preview = calcInvoiceTotals(wardSubtotal + surgeryUnbilledAmount, {
    discountPercent: parseFloat(discountPercent) || 0,
    taxes: taxLines.map((l) => ({ name: l.name, percent: parseFloat(l.percent) || 0 })),
  });
  const quickTax = (name: string, percent: number) => {
    if (taxLines.some((l) => l.name.toLowerCase() === name.toLowerCase())) return;
    setTaxLines([...taxLines, { name, percent: String(percent) }]);
  };
  const submit = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/billing/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admissionId: bill.admission.id,
          discountPercent: parseFloat(discountPercent) || 0,
          discountReason,
          taxes: taxLines.map((l) => ({ name: l.name, percent: parseFloat(l.percent) || 0 })),
          discountThreshold: 20,
          actorRole: currentUser.role,
          actorName: currentUser.name,
          branch,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      toast({ title: "Final bill generated", description: `${body.invoice.invoiceNo} — ₹${body.invoice.total.toLocaleString("en-IN")} (${unbilled} ward + ${surgeryUnbilled} surgery/OT, single bill).` });
      onSaved();
    } catch (e: any) {
      toast({ title: "Finalize failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };
  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Finalize Discharge Bill</DialogTitle><DialogDescription>{unbilled} ward + {surgeryUnbilled} surgery/OT unbilled charge(s) roll into ONE single Final invoice (beds + surgery together). Discount above 20% needs Admin.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Discount %</Label><Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} /></div>
            <div className="space-y-2"><Label>Discount reason</Label><Input value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Required if > 0" /></div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[11px] text-muted-foreground w-full">Quick GST:</span>
            {[
              { label: "GST 5%", lines: [{ name: "GST", percent: 5 }] },
              { label: "GST 12%", lines: [{ name: "GST", percent: 12 }] },
              { label: "GST 18%", lines: [{ name: "GST", percent: 18 }] },
              { label: "CGST 6% + SGST 6%", lines: [{ name: "CGST", percent: 6 }, { name: "SGST", percent: 6 }] },
              { label: "CGST 9% + SGST 9%", lines: [{ name: "CGST", percent: 9 }, { name: "SGST", percent: 9 }] },
            ].map((q) => (
              <Button key={q.label} size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => q.lines.forEach((l) => quickTax(l.name, l.percent))}>{q.label}</Button>
            ))}
          </div>
          <TaxLinesEditor lines={taxLines} computed={preview.taxes} onChange={setTaxLines} />
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal (ward + surgery/OT)</span><span>₹{preview.subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount ({preview.discountPercent}%)</span><span>− ₹{preview.discount.toLocaleString("en-IN")}</span></div>
            {preview.taxes.map((t, i) => (
              <div key={i} className="flex justify-between"><span className="text-muted-foreground">{t.name} ({t.percent}%)</span><span>+ ₹{t.amount.toLocaleString("en-IN")}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1 border-t"><span>Final Total</span><span>₹{preview.total.toLocaleString("en-IN")}</span></div>
          </div>
          <p className="text-[11px] text-muted-foreground">Totals recompute server-side. Finalized bills are read-only — Admin authorization required for corrections.</p>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Finalizing..." : "Generate Final Bill"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
