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
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { canCollectPayment, isAdmin } from "@/lib/utils";
import { printPatientStatement, printReceipt } from "@/lib/documents";
import type { Admission, CompleteBill, Invoice, Payment, SurgeryCase, SurgeryCaseCharge } from "@/lib/types";
import { Printer, Search, Wallet } from "lucide-react";

const PAY_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Razorpay", "Insurance", "Cheque", "Other"];

// Every receipt + advance collected (Billing history). Optional patient filter.
export function PaymentsHistoryCard({ patientId, compact = false }: { patientId?: string; compact?: boolean }) {
  const { toast } = useToast();
  const { branch } = useBranchData();
  const settings = useAppStore((s) => s.settings);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    try {
      const q = `/api/billing/payments?branch=${encodeURIComponent(branch)}${patientId ? `&patientId=${encodeURIComponent(patientId)}` : ""}&limit=100`;
      const res = await fetch(q);
      const data = await res.json();
      if (Array.isArray(data)) setPayments(data);
    } catch {
      toast({ title: "History failed", description: "Could not load money history.", variant: "destructive" });
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branch, patientId]);

  const total = payments.reduce((s, p) => s + (p.amount ?? 0), 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Money Collected ({payments.length}) — ₹{total.toLocaleString("en-IN")}</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Every receipt + advance, newest first. Advances attach to the admission ledger automatically.</p>
          </div>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={refresh} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
        </div>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className={`rounded-lg border bg-background overflow-hidden ${compact ? "" : "mx-4"}`}>
          <Table>
            <TableHeader><TableRow className="bg-muted/50">
              <TableHead>Receipt</TableHead><TableHead>Patient</TableHead>
              <TableHead className="hidden md:table-cell">Type</TableHead>
              <TableHead className="hidden md:table-cell">Method</TableHead>
              <TableHead className="text-right">Amount</TableHead><TableHead className="w-[90px]"><span className="sr-only">Print</span></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(compact ? payments.slice(0, 8) : payments).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.receiptNo}<p className="text-[10px] text-muted-foreground font-sans">{(p.occurredAt || "").split("T")[0]}</p></TableCell>
                  <TableCell className="text-xs font-medium">{p.patientName}</TableCell>
                  <TableCell className="hidden md:table-cell"><Badge variant="outline" className="text-[10px]">{p.kind}</Badge></TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{p.method}</TableCell>
                  <TableCell className="text-right text-sm font-semibold">₹{(p.amount ?? 0).toLocaleString("en-IN")}</TableCell>
                  <TableCell><Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => printReceipt(p, settings)}><Printer className="h-3 w-3 mr-1" /> Receipt</Button></TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-8 text-sm text-muted-foreground">{loading ? "Loading…" : "No money collected yet — advances and payments appear here with receipts."}</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

interface AdmissionDue { admission: Admission; bill: CompleteBill | null; outstanding: number; gross: number; collected: number }
interface SurgeryDue { surgery: SurgeryCase; charges: SurgeryCaseCharge[]; unpaid: number }

// All-in-one billing for one patient: pick from the dropdown, see OPD dues +
// IPD stays + surgeries + money collected, collect everything at once, print
// one combined statement.
export function PatientBillPanel() {
  const { toast } = useToast();
  const { branch, patients } = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const storeInvoices = useAppStore((s) => s.invoices);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const [patientId, setPatientId] = useState("");
  const [admissions, setAdmissions] = useState<AdmissionDue[]>([]);
  const [surgeries, setSurgeries] = useState<SurgeryDue[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [collectOpen, setCollectOpen] = useState(false);
  const [search, setSearch] = useState("");

  const canCollect = canCollectPayment(currentUser.role);
  const patient = patients.find((p) => p.id === patientId);
  const opdDues = useMemo(
    () => storeInvoices.filter((i) => i.patientId === patientId && i.status !== "Paid" && (i.total ?? 0) - (i.paidAmount ?? 0) > 0.001)
      .sort((a, b) => (a.date || "").localeCompare(b.date || "")),
    [storeInvoices, patientId]
  );
  const opdDue = opdDues.reduce((s, i) => s + Math.max(0, (i.total ?? 0) - (i.paidAmount ?? 0)), 0);
  const ipdDue = admissions.reduce((s, a) => s + Math.max(0, a.outstanding), 0);
  const surgDue = surgeries.reduce((s, x) => s + Math.max(0, x.unpaid), 0);
  const totalDue = opdDue + ipdDue + surgDue;

  const filteredPatients = useMemo(() => {
    const q = search.toLowerCase();
    return patients.filter((p) => !q || p.name.toLowerCase().includes(q) || (p.uhid || "").toLowerCase().includes(q) || (p.phone || "").includes(q)).slice(0, 60);
  }, [patients, search]);

  const load = async (pid: string) => {
    if (!pid) return;
    setLoading(true);
    try {
      const [admRes, surgRes, payRes] = await Promise.all([
        fetch(`/api/admissions?branch=${encodeURIComponent(branch)}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/surgeries?branch=${encodeURIComponent(branch)}`).then((r) => r.json()).catch(() => []),
        fetch(`/api/billing/payments?branch=${encodeURIComponent(branch)}&patientId=${encodeURIComponent(pid)}&limit=200`).then((r) => r.json()).catch(() => []),
      ]);
      const mine: Admission[] = Array.isArray(admRes) ? admRes.filter((a: Admission) => a.patientId === pid) : [];
      const dues: AdmissionDue[] = await Promise.all(mine.map(async (a) => {
        try {
          const r = await fetch(`/api/billing/complete-bill?admissionId=${encodeURIComponent(a.id)}`);
          const b: CompleteBill = await r.json();
          if (!r.ok) throw new Error();
          return { admission: a, bill: b, outstanding: b.outstanding, gross: b.netPayable, collected: b.advancePaid + b.previousPayments };
        } catch {
          return { admission: a, bill: null, outstanding: 0, gross: 0, collected: 0 };
        }
      }));
      setAdmissions(dues);
      const mySurg: SurgeryCase[] = Array.isArray(surgRes) ? surgRes.filter((c: SurgeryCase) => c.patientId === pid) : [];
      const sdues: SurgeryDue[] = await Promise.all(mySurg.map(async (c) => {
        try {
          // Linked cases bill through the admission ledger — count only
          // standalone (day-care) unbilled lines here to avoid double-count.
          if (c.admissionId) return { surgery: c, charges: [], unpaid: 0 };
          const r = await fetch(`/api/surgeries/charges?caseId=${encodeURIComponent(c.id)}`);
          const ch: SurgeryCaseCharge[] = r.ok ? await r.json() : [];
          const list = Array.isArray(ch) ? ch : [];
          const unbilled = list.filter((x) => !x.billed);
          return {
            surgery: c, charges: list,
            unpaid: unbilled.length > 0 ? unbilled.reduce((s, x) => s + (x.amount || 0), 0) : (list.length === 0 ? c.estimate || 0 : 0),
          };
        } catch {
          return { surgery: c, charges: [], unpaid: c.estimate || 0 };
        }
      }));
      setSurgeries(sdues);
      setPayments(Array.isArray(payRes) ? payRes : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (patientId) load(patientId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, branch]);

  const printStatement = () => {
    if (!patient) return;
    printPatientStatement({
      patient,
      opdDues,
      admissions: admissions.map((a) => ({ admission: a.admission, outstanding: a.outstanding, gross: a.gross, collected: a.collected })),
      surgeries,
      payments,
      refunds: [],
    }, settings);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Patient Bill — everything in one place</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Type name / UHID / phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Select value={patientId} onValueChange={setPatientId}>
              <SelectTrigger className="h-9 w-[280px] text-xs"><SelectValue placeholder="Select patient (auto list)" /></SelectTrigger>
              <SelectContent>
                {filteredPatients.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.uhid})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {!patient && <p className="text-sm text-muted-foreground text-center py-6">Select a patient above — OPD dues, IPD stays, surgeries and money collected load automatically.</p>}
          {patient && (
            <>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: "OPD due", value: opdDue },
                  { label: "IPD due", value: ipdDue },
                  { label: "Surgery unbilled", value: surgDue },
                  { label: "Total due", value: totalDue },
                ].map((k) => (
                  <div key={k.label} className="rounded-lg bg-muted/50 p-3">
                    <p className="text-[11px] text-muted-foreground">{k.label}</p>
                    <p className="text-base font-bold">₹{k.value.toLocaleString("en-IN")}</p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {canCollect && totalDue > 0.001 && <Button size="sm" onClick={() => setCollectOpen(true)}><Wallet className="h-3.5 w-3.5 mr-1.5" /> Collect All ₹{totalDue.toLocaleString("en-IN")}</Button>}
                <Button size="sm" variant="outline" onClick={printStatement}><Printer className="h-3.5 w-3.5 mr-1.5" /> Print Statement</Button>
              </div>
              {loading && <p className="text-xs text-muted-foreground">Loading dues…</p>}
              {opdDues.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">OPD DUES ({opdDues.length})</p>
                  {opdDues.map((i) => (
                    <div key={i.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <span>{i.invoiceNo} • {i.date} • ₹{(i.total ?? 0).toLocaleString("en-IN")} (paid ₹{(i.paidAmount ?? 0).toLocaleString("en-IN")})</span>
                      <strong className="text-destructive">Due ₹{Math.max(0, (i.total ?? 0) - (i.paidAmount ?? 0)).toLocaleString("en-IN")}</strong>
                    </div>
                  ))}
                </div>
              )}
              {admissions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">IPD ADMISSIONS ({admissions.length})</p>
                  {admissions.map((a) => (
                    <div key={a.admission.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <span>{a.admission.admissionNo} • {(a.admission.admissionAt || "").split("T")[0]} → {(a.admission.dischargeAt || "").split("T")[0] || "open"} • {a.admission.status} <span className="text-muted-foreground">• collected ₹{a.collected.toLocaleString("en-IN")}</span></span>
                      <strong className={a.outstanding > 0.001 ? "text-destructive" : "text-success"}>{a.outstanding > 0.001 ? `Due ₹${a.outstanding.toLocaleString("en-IN")}` : "Settled"}</strong>
                    </div>
                  ))}
                </div>
              )}
              {surgeries.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">SURGERIES ({surgeries.length})</p>
                  {surgeries.map((x) => (
                    <div key={x.surgery.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <span>{x.surgery.caseNo} • {x.surgery.surgeryName} ({x.surgery.surgeon || "TBD"}) • {x.surgery.status}{x.surgery.admissionId ? <span className="text-muted-foreground"> • bills via admission</span> : null}</span>
                      <strong className={x.unpaid > 0.001 ? "text-destructive" : "text-success"}>{x.surgery.admissionId ? "In admission bill" : x.unpaid > 0.001 ? `Unbilled ₹${x.unpaid.toLocaleString("en-IN")}` : "Raised"}</strong>
                    </div>
                  ))}
                </div>
              )}
              {payments.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">MONEY COLLECTED ({payments.length}) — ₹{payments.reduce((s, p) => s + (p.amount ?? 0), 0).toLocaleString("en-IN")}</p>
                  {payments.slice(0, 6).map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                      <span>{p.receiptNo} • {(p.occurredAt || "").split("T")[0]} • {p.kind} • {p.method}</span>
                      <strong>₹{(p.amount ?? 0).toLocaleString("en-IN")}</strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      {collectOpen && patient && (
        <CollectAllDialog
          patientId={patient.id} patientName={patient.name} branch={branch}
          opdDues={opdDues} admissions={admissions} totalDue={totalDue}
          onClose={() => setCollectOpen(false)}
          onDone={() => { setCollectOpen(false); load(patient.id); }}
          updateInvoice={updateInvoice}
        />
      )}
    </div>
  );
}

function CollectAllDialog({ patientId, patientName, branch, opdDues, admissions, totalDue, onClose, onDone, updateInvoice }: {
  patientId: string; patientName: string; branch: string;
  opdDues: Invoice[]; admissions: AdmissionDue[]; totalDue: number;
  onClose: () => void; onDone: () => void;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
}) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [amount, setAmount] = useState(String(Math.round(totalDue)));
  const [method, setMethod] = useState("Cash");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const pay = parseFloat(amount);
    if (!(pay > 0)) {
      toast({ title: "Invalid amount", description: "Amount must be greater than zero.", variant: "destructive" });
      return;
    }
    if (pay > totalDue + 0.001) {
      toast({ title: "Exceeds total due", description: `₹${pay} > ₹${totalDue} due. Record extra as Advance from the IPD ledger.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let left = pay;
      const receipts: string[] = [];
      // Oldest IPD dues first: one receipt per admission.
      const ipdOpen = admissions.filter((a) => a.outstanding > 0.001);
      for (const a of ipdOpen) {
        if (left <= 0.001) break;
        const take = Math.min(left, a.outstanding);
        const res = await fetch("/api/billing/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            patientId, patientName, admissionId: a.admission.id,
            amount: Math.round(take * 100) / 100, method, kind: "Payment",
            notes: "Collected from Patient Bill (all-in-one)",
            idempotencyKey: `onebill-${a.admission.id}-${Date.now()}`,
            receivedBy: currentUser.name, branch,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || "IPD collection failed.");
        receipts.push(body.receiptNo);
        left = Math.round((left - take) * 100) / 100;
      }
      // Then oldest OPD bills first.
      for (const inv of opdDues) {
        if (left <= 0.001) break;
        const due = Math.max(0, (inv.total ?? 0) - (inv.paidAmount ?? 0));
        if (due <= 0.001) continue;
        const take = Math.min(left, due);
        const newPaid = (inv.paidAmount ?? 0) + take;
        const res = await fetch("/api/invoices", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: inv.id,
            paidAmount: Math.round(newPaid * 100) / 100,
            paymentMethod: method,
            status: newPaid >= (inv.total ?? 0) && (inv.total ?? 0) > 0 ? "Paid" : "Partial",
            paidDate: new Date().toISOString().split("T")[0],
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `OPD collection failed (${inv.invoiceNo}).`);
        updateInvoice(inv.id, body);
        left = Math.round((left - take) * 100) / 100;
      }
      toast({ title: "Collected", description: `₹${pay.toLocaleString("en-IN")} via ${method}${receipts.length > 0 ? ` (${receipts.join(", ")})` : ""} for ${patientName}.` });
      onDone();
    } catch (e: any) {
      toast({ title: "Collection stopped", description: `${e.message} — earlier lines in this run were already recorded.`, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Collect — {patientName}</DialogTitle><DialogDescription>Total due ₹{totalDue.toLocaleString("en-IN")} (IPD first, then oldest OPD). One receipt per admission.</DialogDescription></DialogHeader>
        <div className="grid gap-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Amount ₹ *</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-2"><Label>Method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {!isAdmin(currentUser.role) && <p className="text-[11px] text-muted-foreground">Collected by {currentUser.name} ({currentUser.role}).</p>}
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={submit} disabled={saving}>{saving ? "Collecting..." : "Collect"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
