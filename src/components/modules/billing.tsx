"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { useBranchData } from "@/hooks/use-branch-data";
import {
  Receipt, Plus, Download, DollarSign, TrendingUp, CreditCard,
  Wallet, Search, FileText, Percent, ArrowUpDown,
  Pencil, Trash2, Eye, HeartPulse, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { canCreateInvoice, canEditModule, canDeleteModule, isAdmin } from "@/lib/utils";
import { printInvoice } from "@/lib/invoice-print";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { InvoiceViewDialog } from "@/components/shared/invoice-view-dialog";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import type { Invoice, InvoiceItem, InvoiceTaxLine } from "@/lib/types";
import { parseServicePrices } from "@/lib/service-pricing";
import { calcInvoiceTotals, billingDefaults, defaultTaxLines, parseTaxPresets, displayTaxLines } from "@/lib/billing";
import { IPDBillingPanel } from "@/components/modules/ipd-billing";

export interface EditableTaxLine {
  name: string;
  percent: string;
}

// Dynamic tax editor: any tax names (GST, CGST, SGST, …) with their own %.
// Amounts preview from the taxable base; the parent computes via
// calcInvoiceTotals. Locked once the bill is paid.
function TaxLinesEditor({ lines, computed, onChange, disabled, lockNote }: {
  lines: EditableTaxLine[];
  computed: InvoiceTaxLine[];
  onChange: (lines: EditableTaxLine[]) => void;
  disabled?: boolean;
  lockNote?: string;
}) {
  const settings = useAppStore((s) => s.settings);
  const presets = parseTaxPresets(settings);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Taxes — name + %</Label>
        {!disabled && (
          <div className="flex items-center gap-1.5">
            {presets.length > 0 && (
              <Select
                value="__none"
                onValueChange={(v) => {
                  if (v === "__none") return;
                  const p = presets.find((x) => `${x.name}|${x.percent}|${x.sector ?? "All"}` === v);
                  if (p) onChange([...lines, { name: p.name, percent: String(p.percent) }]);
                }}
              >
                <SelectTrigger className="h-7 w-[150px] text-xs"><SelectValue placeholder="Add preset…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Add preset…</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={`${p.name}|${p.percent}|${p.sector ?? "All"}`} value={`${p.name}|${p.percent}|${p.sector ?? "All"}`}>
                      {p.name} {p.percent}%{p.sector && p.sector !== "All" ? ` (${p.sector})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onChange([...lines, { name: "", percent: "" }])}><Plus className="h-3 w-3 mr-1" /> Tax</Button>
          </div>
        )}
      </div>
      {lines.length === 0 && <p className="text-[11px] text-muted-foreground">No taxes on this bill.</p>}
      {lines.map((l, i) => (
        <div key={i} className="grid grid-cols-[1fr_84px_90px_32px] gap-1.5 items-center">
          <Input className="h-8 text-xs" placeholder="GST / CGST / SGST…" value={l.name} disabled={disabled} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
          <Input className="h-8 text-xs" type="number" min={0} title="Percent %" placeholder="%" value={l.percent} disabled={disabled} onChange={(e) => onChange(lines.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} />
          <div className="text-xs text-right font-medium">₹{(computed[i]?.amount ?? 0).toLocaleString("en-IN")}</div>
          {!disabled && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onChange(lines.filter((_, j) => j !== i))} title="Remove tax"><Trash2 className="h-3.5 w-3.5" /></Button>
          )}
        </div>
      ))}
      {disabled && lockNote && <p className="text-[11px] text-muted-foreground">{lockNote}</p>}
    </div>
  );
}

const METHOD_PALETTE = [
  "oklch(0.55 0.22 259)", "oklch(0.62 0.19 155)", "oklch(0.72 0.18 70)",
  "oklch(0.6 0.13 230)", "oklch(0.58 0.24 27)", "oklch(0.65 0.15 300)",
];

const fmtMoney = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

function NewInvoiceDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);
  const branchData = useBranchData();
  const defaults = billingDefaults(settings);
  const defaultLines = (): EditableTaxLine[] =>
    defaultTaxLines(settings).map((l) => ({ name: l.name ?? "GST", percent: String(l.percent ?? 0) }));
  const [form, setForm] = useState({ patientId: "", department: "", paymentMethod: "", serviceId: "", items: "", amount: "", notes: "", discountPercent: String(defaults.discountPercent ?? 0) });
  const [taxLines, setTaxLines] = useState<EditableTaxLine[]>(defaultLines);
  const selectedPatient = branchData.patients.find((patient) => patient.id === form.patientId);
  const servicePrices = parseServicePrices(settings);
  const selectedService = servicePrices.find((service) => service.id === form.serviceId);
  const previewAmount = selectedService ? selectedService.price : parseFloat(form.amount) || 0;
  const preview = calcInvoiceTotals(previewAmount, { discountPercent: form.discountPercent, taxes: taxLines });

  const handleSubmit = async () => {
    if (!selectedPatient) {
      toast({ title: "Error", description: "Patient is required", variant: "destructive" });
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const amount = selectedService ? selectedService.price : parseFloat(form.amount) || 0;
    const category = selectedService?.module === "Laboratory" ? "Lab" : selectedService?.module || "Other";
    const itemDescription = selectedService ? selectedService.name : (form.items.split(",").map((s) => s.trim()).filter(Boolean)[0] || form.notes || "Consultation");
    const finalItems: InvoiceItem[] = [{ description: itemDescription, category: category as InvoiceItem["category"], quantity: 1, rate: amount, amount }];
    const t = calcInvoiceTotals(amount, { discountPercent: form.discountPercent, taxes: taxLines });
    const newInvoice: Invoice = {
      id: `inv${Date.now()}`,
      invoiceNo: "",
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      date: today,
      dueDate: today,
      items: finalItems,
      subtotal: t.subtotal,
      tax: t.tax,
      discount: t.discount,
      discountPercent: t.discountPercent,
      gstPercent: t.gstPercent,
      gstAmount: t.gstAmount,
      cstPercent: t.cstPercent,
      cstAmount: t.cstAmount,
      taxes: t.taxes,
      total: t.total,
      paidAmount: form.paymentMethod ? t.total : 0,
      status: form.paymentMethod ? "Paid" : "Pending",
      paymentMethod: form.paymentMethod || undefined,
      branch: branchData.branch,
      paidDate: form.paymentMethod ? today : undefined,
    };
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newInvoice),
      });
      if (!res.ok) throw new Error("Request failed");
      addInvoice(await res.json());
      toast({ title: "Success", description: `Invoice created for ${selectedPatient.name} — ₹${t.total.toLocaleString("en-IN")}` });
      setForm({ patientId: "", department: "", paymentMethod: "", serviceId: "", items: "", amount: "", notes: "", discountPercent: String(defaults.discountPercent ?? 0) });
      setTaxLines(defaultLines());
      onOpenChange(false);
    } catch {
      toast({ title: "Error", description: "Failed to create invoice. Please try again.", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden"><DialogHeader className="shrink-0"><DialogTitle>Create Invoice</DialogTitle><DialogDescription>Create a new billing invoice</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 overflow-y-auto pr-1 -mr-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Patient *</Label><Select value={form.patientId} onValueChange={(v) => setForm({ ...form, patientId: v })}><SelectTrigger><SelectValue placeholder="Select patient" /></SelectTrigger><SelectContent>{branchData.patients.map((patient) => <SelectItem key={patient.id} value={patient.id}>{patient.name} ({patient.uhid})</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Department</Label><Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{branchData.departmentNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2">
          <Label>Admin Service / Test</Label>
          <Select value={form.serviceId} onValueChange={(serviceId) => {
            const service = servicePrices.find((s) => s.id === serviceId);
            setForm({ ...form, serviceId, items: service?.name ?? form.items, amount: service ? String(service.price) : form.amount });
          }}>
            <SelectTrigger><SelectValue placeholder="Select priced service or use custom below" /></SelectTrigger>
            <SelectContent>
              {servicePrices.map((service) => <SelectItem key={service.id} value={service.id}>{service.module} - {service.name} ({service.category}) - ₹{service.price}</SelectItem>)}
              {servicePrices.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No admin service prices configured.</div>}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Payment Method</Label><Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}><SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger><SelectContent>{["Cash", "UPI", "Card", "Insurance", "Net Banking"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Amount (₹){selectedService ? " — auto-filled" : ""}</Label><Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value, serviceId: "" })} placeholder="Total amount" /></div>
        </div>
        <div className="space-y-2"><Label>Items</Label><Input value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value, serviceId: "" })} placeholder="e.g. Consultation, Lab Test, Medicine" /></div>
        <div className="space-y-2"><Label>Discount %</Label><Input type="number" min={0} max={100} value={form.discountPercent} onChange={(e) => setForm({ ...form, discountPercent: e.target.value })} placeholder="0" /></div>
        <TaxLinesEditor lines={taxLines} computed={preview.taxes} onChange={setTaxLines} />
        <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{preview.subtotal.toLocaleString("en-IN")}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Discount ({preview.discountPercent}%)</span><span>− ₹{preview.discount.toLocaleString("en-IN")}</span></div>
          {preview.taxes.map((tx, i) => (
            <div key={i} className="flex justify-between"><span className="text-muted-foreground">{tx.name} ({tx.percent}%)</span><span>+ ₹{tx.amount.toLocaleString("en-IN")}</span></div>
          ))}
          <div className="flex justify-between text-sm font-bold pt-1 border-t"><span>Bill Total</span><span>₹{preview.total.toLocaleString("en-IN")}</span></div>
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" /></div>
      </div>
      <DialogFooter className="shrink-0 border-t pt-4"><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Invoice</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const ITEM_CATEGORIES: InvoiceItem["category"][] = ["Consultation", "OPD", "IPD", "Lab", "Radiology", "Pharmacy", "Room", "Procedure", "Other"];

function EditInvoiceDialog({ invoice, onOpenChange }: { invoice: Invoice | null; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const [items, setItems] = useState<InvoiceItem[]>(() =>
    (invoice?.items ?? []).map((it) => ({ ...it }))
  );
  // Legacy bills (flat ₹ or GST/CST columns) convert to editable tax lines;
  // old invoices keep showing the same net total.
  const initTaxState = () => {
    const sub = (invoice?.items ?? []).reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0), 0);
    const disc = invoice?.discount ?? 0;
    const base = Math.max(0, sub - disc);
    const pct = (amt: number, of: number) => (of > 0 && amt > 0 ? String(Math.round((amt / of) * 1000) / 10) : "0");
    let lines: EditableTaxLine[];
    if (invoice?.taxes && invoice.taxes.length > 0) {
      lines = invoice.taxes.map((tx) => ({ name: tx.name, percent: String(tx.percent) }));
    } else {
      lines = [];
      if ((invoice?.gstAmount ?? 0) > 0 || (invoice?.gstPercent ?? 0) > 0) lines.push({ name: "GST", percent: String(invoice?.gstPercent ?? 0) });
      if ((invoice?.cstAmount ?? 0) > 0 || (invoice?.cstPercent ?? 0) > 0) lines.push({ name: "CST", percent: String(invoice?.cstPercent ?? 0) });
      if (lines.length === 0 && (invoice?.tax ?? 0) > 0) lines.push({ name: "Tax", percent: pct(invoice?.tax ?? 0, base) });
    }
    return {
      discountPercent: String(invoice?.discountPercent ?? pct(disc, sub)),
      lines,
    };
  };
  const [discountPercent, setDiscountPercent] = useState(initTaxState().discountPercent);
  const [taxLines, setTaxLines] = useState<EditableTaxLine[]>(initTaxState().lines);
  const [paymentMethod, setPaymentMethod] = useState(invoice?.paymentMethod ?? "");
  const [paidAmount, setPaidAmount] = useState(invoice ? String(invoice.paidAmount ?? 0) : "0");
  const [saving, setSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState<Invoice | null>(null);
  const [collectOpen, setCollectOpen] = useState(false);

  if (!invoice) return null;

  // Taxes lock once money is collected — amounts already paid must not change.
  const taxesLocked = invoice.status === "Paid" || (invoice.paidAmount ?? 0) > 0;
  const subtotal = items.reduce((s, it) => s + (it.quantity || 0) * (it.rate || 0), 0);
  const t = calcInvoiceTotals(subtotal, { discountPercent, taxes: taxLines });
  const total = t.total;
  const paid = parseFloat(paidAmount) || 0;
  const outstanding = Math.max(0, total - paid);

  const setItem = (idx: number, patch: Partial<InvoiceItem>) =>
    setItems((list) => list.map((it, i) => (i === idx ? { ...it, ...patch, amount: (patch.quantity ?? it.quantity) * (patch.rate ?? it.rate) } : it)));

  const handleSave = async () => {
    if (items.length === 0) { toast({ title: "No items", description: "Add at least one bill line item.", variant: "destructive" }); return; }
    if (items.some((it) => !it.description.trim() || (it.rate || 0) < 0)) { toast({ title: "Invalid items", description: "Each item needs a description and a valid rate.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const itemsRes = await fetch("/api/invoice-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, items }),
      });
      if (!itemsRes.ok) throw new Error("Failed to save bill items");
      if (!taxesLocked) {
        const taxesRes = await fetch("/api/invoice-taxes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: invoice.id, taxes: t.taxes }),
        });
        if (!taxesRes.ok) throw new Error("Failed to save bill taxes");
      }
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoice.id,
          subtotal,
          tax: t.tax,
          discount: t.discount,
          discountPercent: t.discountPercent,
          gstPercent: t.gstPercent,
          gstAmount: t.gstAmount,
          cstPercent: t.cstPercent,
          cstAmount: t.cstAmount,
          taxes: t.taxes,
          total,
          paymentMethod: paymentMethod || undefined,
          paidAmount: paid,
          paidDate: paid > 0 ? new Date().toISOString().split("T")[0] : invoice.paidDate,
        }),
      });
      if (!res.ok) throw new Error("Request failed");
      const saved = await res.json();
      updateInvoice(invoice.id, saved);
      setSavedInvoice(saved);
      const balance = Math.max(0, (saved.total || 0) - (saved.paidAmount || 0));
      toast({ title: "Bill Updated", description: `Invoice ${invoice.invoiceNo || ""} saved as ${saved.status}${balance > 0 ? ` — ₹${balance.toLocaleString("en-IN")} outstanding` : ""}.` });
    } catch {
      toast({ title: "Error", description: "Failed to update invoice. Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const savedBalance = savedInvoice ? Math.max(0, (savedInvoice.total || 0) - (savedInvoice.paidAmount || 0)) : outstanding;

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle>Edit Bill — {invoice.invoiceNo}</DialogTitle>
          <DialogDescription>Change bill items or amounts for {invoice.patientName}. Status re-calculates automatically.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4 overflow-y-auto pr-1 -mr-1">
          <div className="rounded-lg bg-muted/50 p-3 text-xs grid grid-cols-3 gap-2">
            <div><p className="text-muted-foreground">Bill total</p><p className="text-base font-bold">₹{total.toLocaleString("en-IN")}</p></div>
            <div><p className="text-muted-foreground">Collected</p><p className="text-base font-bold text-success">₹{paid.toLocaleString("en-IN")}</p></div>
            <div><p className="text-muted-foreground">Outstanding</p><p className="text-base font-bold text-destructive">₹{outstanding.toLocaleString("en-IN")}</p></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Bill Items</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setItems((l) => [...l, { description: "", category: "Other", quantity: 1, rate: 0, amount: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
            </div>
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-[1fr_110px_70px_90px_32px] gap-1.5 items-center">
                <Input className="h-8 text-xs" placeholder="Service / item" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                <Select value={it.category} onValueChange={(v) => setItem(i, { category: v as InvoiceItem["category"] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{ITEM_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-8 text-xs" type="number" min={1} title="Qty" value={String(it.quantity)} onChange={(e) => setItem(i, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} />
                <Input className="h-8 text-xs" type="number" min={0} title="Rate ₹" value={String(it.rate)} onChange={(e) => setItem(i, { rate: Math.max(0, parseFloat(e.target.value) || 0) })} />
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setItems((l) => l.filter((_, j) => j !== i))} title="Remove item"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Discount %</Label><Input type="number" min={0} max={100} value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} disabled={taxesLocked} /></div>
            <div className="space-y-2"><Label>Payment Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>{["Cash", "UPI", "Card", "Insurance", "Net Banking"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Collected (₹)</Label><Input type="number" min={0} value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Paid amount" /></div>
          </div>
          <TaxLinesEditor lines={taxLines} computed={t.taxes} onChange={setTaxLines} disabled={taxesLocked} lockNote="Taxes are locked — this bill already has payment collected." />
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount ({t.discountPercent}%)</span><span>− ₹{t.discount.toLocaleString("en-IN")}</span></div>
            {t.taxes.map((tx, i) => (
              <div key={i} className="flex justify-between"><span className="text-muted-foreground">{tx.name} ({tx.percent}%)</span><span>+ ₹{tx.amount.toLocaleString("en-IN")}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1 border-t"><span>Bill Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
          </div>
          {savedInvoice && savedBalance > 0 && (
            <div className="flex items-center justify-between rounded-lg border border-warning/40 bg-warning/10 p-3">
              <p className="text-xs">₹{savedBalance.toLocaleString("en-IN")} still outstanding on this bill.</p>
              <Button size="sm" onClick={() => setCollectOpen(true)}><Wallet className="h-3.5 w-3.5 mr-1.5" /> Collect Remaining</Button>
            </div>
          )}
        </div>
        <DialogFooter className="shrink-0 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Bill"}</Button>
        </DialogFooter>
      </DialogContent>
      <CollectMoneyDialog
        invoice={collectOpen ? savedInvoice : null}
        onOpenChange={(v) => { if (!v) setCollectOpen(false); }}
        onCollected={(saved) => { setSavedInvoice(saved); setPaidAmount(String(saved.paidAmount ?? 0)); }}
        title="Collect Remaining Amount"
      />
    </Dialog>
  );
}

export function BillingModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { invoices, patients, doctors, branch } = useBranchData();
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const deleteInvoice = useAppStore((s) => s.deleteInvoice);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const [refreshingBills, setRefreshingBills] = useState(false);
  const refreshBills = async () => {
    setRefreshingBills(true);
    try {
      await loadFromSupabase();
      toast({ title: "Bills refreshed", description: "Latest invoices pulled from the database." });
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setRefreshingBills(false);
    }
  };
  const invoiceIO: EntityIOConfig<Invoice> = {
    entity: "invoices",
    filename: "invoices",
    columns: [
      { header: "invoiceNo", sample: "(auto)" },
      { header: "patientName", sample: "Ravi Kumar" },
      { header: "patientId", sample: "" },
      { header: "date", sample: new Date().toISOString().split("T")[0] },
      { header: "description", sample: "OPD Consultation" },
      { header: "category", sample: "OPD" },
      { header: "quantity", sample: "1" },
      { header: "rate", sample: "500" },
      { header: "paidAmount", sample: "0" },
      { header: "paymentMethod", sample: "Cash" },
      { header: "branch", sample: branch },
    ],
    toRow: (inv) => {
      const first = (inv.items ?? [])[0];
      return [inv.invoiceNo, inv.patientName, inv.patientId, inv.date, first?.description ?? "", first?.category ?? "", first?.quantity ?? 1, first?.rate ?? inv.total, inv.paidAmount ?? 0, inv.paymentMethod ?? "", inv.branch];
    },
    fromRow: (row, i) => {
      if (!row.patientName || !row.description) throw new Error("patientName and description are required.");
      const qty = Math.max(1, parseInt(row.quantity) || 1);
      const rate = Math.max(0, parseFloat(row.rate) || 0);
      const total = qty * rate;
      const paid = Math.max(0, parseFloat(row.paidAmount) || 0);
      const today = new Date().toISOString().split("T")[0];
      return {
        id: `inv${Date.now()}${i}`,
        invoiceNo: "",
        patientId: row.patientId || "",
        patientName: row.patientName,
        date: row.date || today,
        dueDate: row.date || today,
        items: [{ description: row.description, category: row.category || "Other", quantity: qty, rate, amount: total }],
        subtotal: total,
        tax: 0,
        discount: 0,
        total,
        paidAmount: Math.min(paid, total),
        status: paid >= total && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Pending",
        paymentMethod: row.paymentMethod || (paid > 0 ? "Cash" : ""),
        branch: row.branch || branch,
        paidDate: paid > 0 ? (row.date || today) : "",
      };
    },
    endpoint: "/api/invoices",
    onImported: (saved) => addInvoice(saved),
  };
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sectionFilter, setSectionFilter] = useState("All");
  const [doctorFilter, setDoctorFilter] = useState("All");
  const [departmentFilter, setDepartmentFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);
  const showAdd = canCreateInvoice(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "billing");
  const showDelete = canDeleteModule(currentUser.role, "billing");
  const latestInvoice = invoices[0];
  const [consolidatedItems, setConsolidatedItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const inv = invoices[0];
      if (!inv) return;
      try {
        const res = await fetch(`/api/invoice-items?invoiceId=${encodeURIComponent(inv.id)}`);
        const data = res.ok ? await res.json() : [];
        if (!cancelled) setConsolidatedItems(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setConsolidatedItems([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoices]);

  // Link invoices to patients/doctors/departments for filtering.
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients]);
  const doctorByName = useMemo(() => new Map(doctors.map((d) => [d.name, d])), [doctors]);
  const invoiceDoctor = (inv: (typeof invoices)[number]) => patientById.get(inv.patientId ?? "")?.doctorName || "";
  const invoiceDepartment = (inv: (typeof invoices)[number]) => {
    const patient = patientById.get(inv.patientId ?? "");
    if (!patient) return "";
    return doctorByName.get(patient.doctorName ?? "")?.department || patient.doctorName || "";
  };
  const invoiceUhid = (inv: (typeof invoices)[number]) => patientById.get(inv.patientId ?? "")?.uhid || "";
  // Payments are reported on the date money was collected (paid_date), not the
  // appointment/service date. Legacy Paid invoices fall back to their invoice
  // date (fees were collected at creation).
  const invoicePaidDate = (inv: (typeof invoices)[number]) =>
    inv.paidDate || ((inv.status === "Paid" || inv.status === "Partial") ? inv.date || "" : "");

  // Section = which module the charges came from, based on item categories.
  // First-aid bills created by nurses carry a "First Aid — …" line item
  // (hyphen/en-dash variants accepted for older rows).
  const isFirstAidInvoice = (inv: (typeof invoices)[number]): boolean =>
    (inv.items ?? []).some((it) => /^First Aid\s+[-–—]/.test(it.description || ""));
  const invoiceSection = (inv: (typeof invoices)[number]): string => {
    if (isFirstAidInvoice(inv)) return "First Aid";
    const cats = new Set((inv.items ?? []).map((it) => it.category));
    if (cats.has("OPD") || cats.has("Consultation")) return "Patient Fees";
    if (cats.has("IPD") || cats.has("Room")) return "Beds (IPD)";
    if (cats.has("Lab")) return "Laboratory";
    if (cats.has("Pharmacy")) return "Pharmacy";
    if (cats.has("Radiology")) return "Radiology";
    return "Other";
  };
  const SECTIONS = ["All", "Patient Fees", "Beds (IPD)", "Laboratory", "Pharmacy", "Radiology", "First Aid", "Other"];
  const doctorOptions = useMemo(() => Array.from(new Set(doctors.map((d) => d.name))).sort(), [doctors]);
  const departmentOptions = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.department).filter(Boolean))).sort(),
    [doctors]
  );

  const filtered = invoices.filter((inv) => {
    const uhid = invoiceUhid(inv).toLowerCase();
    const matchSearch =
      inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) ||
      inv.patientName.toLowerCase().includes(search.toLowerCase()) ||
      (search !== "" && uhid.includes(search.toLowerCase()));
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    const matchSection = sectionFilter === "All" || invoiceSection(inv) === sectionFilter;
    const matchDoctor = doctorFilter === "All" || invoiceDoctor(inv) === doctorFilter;
    const matchDepartment = departmentFilter === "All" || invoiceDepartment(inv) === departmentFilter;
    const invDate = invoicePaidDate(inv);
    const matchDate = (!dateFrom || invDate >= dateFrom) && (!dateTo || invDate <= dateTo);
    return matchSearch && matchStatus && matchSection && matchDoctor && matchDepartment && matchDate;
  });

  const {
    pageItems: pagedInvoices, page: invPage, setPage: setInvPage,
    pageSize: invPageSize, setPageSize: setInvPageSize, totalPages: invPages, total: invTotal,
  } = usePagination(filtered, `${search}|${statusFilter}|${sectionFilter}|${doctorFilter}|${departmentFilter}|${dateFrom}|${dateTo}`);

  // All summary numbers respond to the active filters (date, section, doctor, department, status, search).
  const totalRevenue = filtered.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const pendingAmount = filtered.filter((i) => i.status !== "Paid").reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);
  const todayStr = new Date().toISOString().split("T")[0];
  const invoicesToday = filtered.filter((i) => invoicePaidDate(i) === todayStr).length;
  const avgInvoice = filtered.length > 0 ? Math.round(filtered.reduce((s, i) => s + (i.total || 0), 0) / filtered.length) : 0;

  // Real payment-method breakdown from collected amounts (respects all filters).
  const methodBreakdown = (() => {
    const map = new Map<string, number>();
    for (const inv of filtered) {
      const method = inv.paymentMethod || "Cash";
      map.set(method, (map.get(method) || 0) + (inv.paidAmount || 0));
    }
    return Array.from(map.entries())
      .map(([method, amount], i) => ({ method, amount, color: METHOD_PALETTE[i % METHOD_PALETTE.length] }))
      .sort((a, b) => b.amount - a.amount);
  })();
  const collectedTotal = methodBreakdown.reduce((s, m) => s + m.amount, 0);

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ["Invoice #", "Section", "Patient", "UHID", "Date", "Paid On", "Total", "Paid", "Balance", "Status", "Method", "Branch"],
      ...filtered.map((i) => [
        i.invoiceNo, invoiceSection(i), i.patientName, invoiceUhid(i), i.date, invoicePaidDate(i), i.total ?? 0, i.paidAmount ?? 0,
        Math.max(0, (i.total ?? 0) - (i.paidAmount ?? 0)), i.status, i.paymentMethod ?? "", i.branch ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoices-${todayStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Payments"
        description="Consolidated invoicing across all hospital departments"
        icon={Receipt}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={refreshBills} disabled={refreshingBills} title="Pull latest bills from the database">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshingBills ? "animate-spin" : ""}`} /> Refresh
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} title="Detailed export with section, UHID, paid-on">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            {showAdd && <ImportExportButtons config={invoiceIO} items={filtered} compact hideExport />}
            {showAdd && (
              <Button size="sm" className="gap-2" onClick={() => setNewInvoiceOpen(true)}>
                <Plus className="h-3.5 w-3.5" /> Create Invoice
              </Button>
            )}
          </>
        }
      />

      <Tabs defaultValue="opd" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="opd">OPD / All Bills</TabsTrigger>
          <TabsTrigger value="ipd">IPD Admissions Ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="ipd" className="pt-4">
          <IPDBillingPanel />
        </TabsContent>
        <TabsContent value="opd" className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Revenue" value={fmtMoney(totalRevenue)} icon={DollarSign} color="success" subtitle="Collected (filtered)" />
        <StatCard title="Pending Amount" value={fmtMoney(pendingAmount)} icon={Wallet} color="destructive" subtitle="To be collected" />
        <StatCard title="Invoices" value={filtered.length.toString()} icon={FileText} color="primary" subtitle={`${invoicesToday} paid today • ${invoices.length} total`} />
        <StatCard title="Avg Invoice Value" value={fmtMoney(avgInvoice)} icon={TrendingUp} color="info" subtitle="Across filtered invoices" />
      </div>

      {(() => {
        const fa = invoices.filter(isFirstAidInvoice);
        if (fa.length === 0) return null;
        const billed = fa.reduce((s, i) => s + (i.total || 0), 0);
        const collected = fa.reduce((s, i) => s + (i.paidAmount || 0), 0);
        const due = fa.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0);
        return (
          <div className="rounded-xl border border-info/30 bg-info/5 p-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span className="flex items-center gap-2 text-sm font-semibold"><HeartPulse className="h-4 w-4 text-info" /> First Aid (nursing)</span>
            <span className="text-xs text-muted-foreground">{fa.length} bill{fa.length === 1 ? "" : "s"}</span>
            <span className="text-xs">Billed <strong>{fmtMoney(billed)}</strong></span>
            <span className="text-xs">Collected <strong className="text-success">{fmtMoney(collected)}</strong></span>
            {due > 0 && <span className="text-xs">Due <strong className="text-destructive">{fmtMoney(due)}</strong></span>}
            <button className="ml-auto text-xs text-primary hover:underline font-medium" onClick={() => setSectionFilter("First Aid")}>Show bills →</button>
          </div>
        );
      })()}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment Methods Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {methodBreakdown.length === 0 ? (
              <div className="py-16 text-center">
                <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No payments collected yet</p>
                <p className="text-xs text-muted-foreground mt-1">Collected fees from OPD visits and IPD discharges appear here.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={methodBreakdown} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                  <XAxis dataKey="method" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}K` : `${v}`)} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                  <Bar dataKey="amount" radius={[6, 6, 0, 0]} name="Collected">
                    {methodBreakdown.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Payment Methods Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {methodBreakdown.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No data yet.</p>
            ) : (
              methodBreakdown.map((p) => {
                const pct = collectedTotal > 0 ? Math.round((p.amount / collectedTotal) * 100) : 0;
                return (
                  <div key={p.method} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${p.color}20`, color: p.color }}>
                      {p.method === "UPI" && <Wallet className="h-4 w-4" />}
                      {p.method === "Card" && <CreditCard className="h-4 w-4" />}
                      {p.method !== "UPI" && p.method !== "Card" && <DollarSign className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium">{p.method}</span>
                        <span className="text-xs font-semibold">{fmtMoney(p.amount)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 mb-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by invoice #, patient, or UHID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
                {["All", "Paid", "Partial", "Pending", "Overdue", "Follow Up"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Section</span>
                <Select value={sectionFilter} onValueChange={setSectionFilter}>
                  <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input type="date" className="h-8 w-[140px] text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="Paid from date" />
                <span className="text-xs text-muted-foreground">to</span>
                <Input type="date" className="h-8 w-[140px] text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="Paid to date" />
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-[11px]" onClick={() => { setDateFrom(""); setDateTo(""); }}>
                    Clear
                  </Button>
                )}
                <Select value={doctorFilter} onValueChange={setDoctorFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="All doctors" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All doctors</SelectItem>
                    {doctorOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="All departments" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All departments</SelectItem>
                    {departmentOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden lg:table-cell">UHID</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Paid On</TableHead>
                  <TableHead className="hidden lg:table-cell">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
                  <TableHead className="hidden lg:table-cell">Method</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="w-[110px]">Invoice</TableHead>
                   {(showEdit || showDelete) && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">
                      {inv.invoiceNo}
                      <p className="text-[10px] text-muted-foreground font-sans">{invoiceSection(inv)}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                            {inv.patientName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{inv.patientName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs text-muted-foreground">{invoiceUhid(inv) || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{inv.date}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">
                      {invoicePaidDate(inv) ? (
                        <span className="font-medium text-success">{invoicePaidDate(inv)}</span>
                      ) : (
                        <span className="text-muted-foreground">Not paid</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{inv.items.length} items</TableCell>
                    <TableCell className="text-right font-medium">₹{inv.total.toLocaleString("en-IN")}
                      {(() => {
                        const lines = displayTaxLines(inv);
                        return ((inv.discountPercent ?? 0) > 0 || lines.length > 0) ? (
                          <p className="text-[10px] font-normal text-muted-foreground font-sans">
                            {(inv.discountPercent ?? 0) > 0 && <span>−{inv.discountPercent}% </span>}
                            {lines.map((l, i) => <span key={i}>+{l.name} {l.percent}% </span>)}
                          </p>
                        ) : null;
                      })()}
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-success">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {inv.paymentMethod && <Badge variant="outline" className="text-[10px]">{inv.paymentMethod}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={inv.status}
                        onValueChange={async (v) => {
                          try {
                            const res = await fetch("/api/invoices", {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                id: inv.id,
                                status: v,
                                ...(v === "Paid" ? { paidAmount: inv.total, paidDate: new Date().toISOString().split("T")[0] } : {}),
                              }),
                            });
                            if (!res.ok) throw new Error("Request failed");
                            updateInvoice(inv.id, await res.json());
                          } catch {
                            toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Paid", "Partial", "Pending", "Overdue", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View bill"
                          onClick={() => setViewInvoice(inv)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Download / print invoice"
                          onClick={() => {
                            if (!printInvoice(inv, settings, patients.find((p) => p.id === inv.patientId))) {
                              toast({ title: "Pop-up blocked", description: "Allow pop-ups for this site to download invoices." });
                            }
                          }}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        {Math.max(0, (inv.total || 0) - (inv.paidAmount || 0)) > 0 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-success"
                            title={`Collect outstanding ₹${Math.max(0, (inv.total || 0) - (inv.paidAmount || 0)).toLocaleString("en-IN")}`}
                            onClick={() => setCollectInvoice(inv)}
                          >
                            <Wallet className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    {(showEdit || showDelete) && (
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit invoice" onClick={(e) => { e.stopPropagation(); setEditTarget(inv); }}><Pencil className="h-3.5 w-3.5" /></Button>}
                          {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Delete invoice" onClick={(e) => { e.stopPropagation(); setDeleteTarget({ id: inv.id, name: inv.patientName }); }}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pt-3">
            <DataPagination page={invPage} totalPages={invPages} pageSize={invPageSize} total={invTotal} onPage={setInvPage} onPageSize={setInvPageSize} />
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Billing — latest invoice */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4 text-primary" /> Auto-Consolidated Billing
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Charges from all departments automatically consolidated into a single invoice
          </p>
        </CardHeader>
        <CardContent>
          {!latestInvoice ? (
            <div className="py-12 text-center">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No invoices yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create an invoice to see consolidated billing here.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <div className="bg-muted/50 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Invoice {latestInvoice.invoiceNo}</p>
                  <p className="text-xs text-muted-foreground">{latestInvoice.patientName} • {latestInvoice.date}</p>
                </div>
                <StatusBadge status={latestInvoice.status} />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedItems.length > 0 ? (
                    consolidatedItems.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm font-medium">{item.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                        <TableCell className="text-right text-sm">₹{(item.rate ?? 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right text-sm font-medium">₹{(item.amount ?? 0).toLocaleString("en-IN")}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-6 text-muted-foreground text-sm">
                        No line items recorded for this invoice.
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-muted/30 font-semibold">
                    <TableCell colSpan={4} className="text-right text-sm">Subtotal</TableCell>
                    <TableCell className="text-right">₹{(latestInvoice.subtotal ?? 0).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={4} className="text-right text-sm text-muted-foreground flex items-center justify-end gap-1">
                      <Percent className="h-3 w-3" /> Tax
                    </TableCell>
                    <TableCell className="text-right text-sm">₹{(latestInvoice.tax ?? 0).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                  <TableRow className="bg-success/5 font-bold">
                    <TableCell colSpan={4} className="text-right">Total Paid</TableCell>
                    <TableCell className="text-right text-success">₹{(latestInvoice.total ?? 0).toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <NewInvoiceDialog open={newInvoiceOpen} onOpenChange={setNewInvoiceOpen} />
      <EditInvoiceDialog key={editTarget?.id ?? "none"} invoice={editTarget} onOpenChange={(o) => { if (!o) setEditTarget(null); }} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Payment" />
      <InvoiceViewDialog invoice={viewInvoice} patient={viewInvoice ? patients.find((p) => p.id === viewInvoice.patientId) : null} onOpenChange={(v) => { if (!v) setViewInvoice(null); }} />
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Invoice</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the invoice for {deleteTarget?.name}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch("/api/invoices", {
                    method: "DELETE",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ id: deleteTarget.id }),
                  });
                  if (!res.ok) throw new Error("Request failed");
                  deleteInvoice(deleteTarget.id);
                  toast({ title: "Deleted", description: `Invoice for ${deleteTarget.name} deleted` });
                  setDeleteTarget(null);
                } catch {
                  toast({ title: "Error", description: "Failed to delete invoice. Please try again.", variant: "destructive" });
                }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </TabsContent>
      </Tabs>
    </div>
  );
}
