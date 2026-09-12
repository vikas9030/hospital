"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  Pill, Plus, Search, Package, AlertTriangle, TrendingUp,
  FlaskConical, Microscope, CheckCircle2, Check, Clock, ScanLine,
  FileText, Download, Activity, Image as ImageIcon, Pencil, Trash2, Wallet, Eye, BellRing,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { canAddMedicine, canManageLab, canManageRadiology, canEditModule, canDeleteModule, canCollectPayment, normalizeExpiryDate, formatExpiryMonth, sameBranch } from "@/lib/utils";
import { computeDesiredAlerts } from "@/lib/pharmacy-alerts";
import type { Medicine, LabTest, Patient, RadiologyOrder, Lead, Invoice, Prescription } from "@/lib/types";
import { findServicePrice, parseServicePrices } from "@/lib/service-pricing";
import { printLabReport, printRadiologyReport, buildLabReportHtml, buildRadiologyReportHtml, type ReportDoc } from "@/lib/documents";
import { ReportViewerDialog } from "@/components/shared/report-viewer";
import { printInvoice } from "@/lib/invoice-print";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";

function uniqueOptions(values: (string | undefined | null)[], fallback: string[] = []) {
  return Array.from(new Set([...fallback, ...values].map((v) => (v ?? "").trim()).filter(Boolean))).sort();
}

function SearchableField({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search or type custom...",
  emptyLabel = "Use custom value",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const customValue = query.trim();
  const hasExactMatch = options.some((option) => option.toLowerCase() === customValue.toLowerCase());
  const addCustomValue = () => {
    if (!customValue) return;
    onChange(customValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between font-normal">
          <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => { onChange(option); setOpen(false); setQuery(""); }}>
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              disabled={!customValue || hasExactMatch}
              onClick={addCustomValue}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {customValue ? `${emptyLabel}: ${customValue}` : "Type a custom name to add"}
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PatientSearchField({ value, onChange, patients }: { value: string; onChange: (value: string) => void; patients: Patient[] }) {
  const [open, setOpen] = useState(false);
  const selected = patients.find((patient) => patient.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between font-normal">
          <span className={`truncate ${selected ? "" : "text-muted-foreground"}`}>{selected ? `${selected.name} (${selected.uhid})` : "Search patient"}</span>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search name, UHID, or phone..." />
          <CommandList>
            <CommandEmpty>No patient found.</CommandEmpty>
            <CommandGroup>
              {patients.map((patient) => (
                <CommandItem key={patient.id} value={`${patient.name} ${patient.uhid} ${patient.phone}`} onSelect={() => { onChange(patient.id); setOpen(false); }}>
                  <span className="flex-1 truncate">{patient.name}</span>
                  <span className="text-xs text-muted-foreground">{patient.uhid}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PatientNameSearchField({ value, onChange, patients }: { value: string; onChange: (value: string) => void; patients: Patient[] }) {
  const patientNames = uniqueOptions(patients.map((patient) => patient.name));
  return <SearchableField value={value} onChange={onChange} options={patientNames} placeholder="Search/add patient" searchPlaceholder="Search patient or type custom name..." emptyLabel="Add patient name" />;
}

function EditMedicineDialog({ open, onOpenChange, medicine }: { open: boolean; onOpenChange: (v: boolean) => void; medicine: Medicine | null }) {
  const { toast } = useToast();
  const updateMedicine = useAppStore((s) => s.updateMedicine);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", category: "", manufacturer: "", batchNo: "", expiryDate: "", stock: "", stockSheets: "", reorderLevel: "", price: "", stripSize: "10", sheetPrice: "", supplier: "", status: "In Stock" as string });
  const prevId = useState<string | null>(null);
  const medicineNames = uniqueOptions(branchData.medicines.map((item) => item.name));
  const medicineCategories = uniqueOptions(branchData.medicines.map((item) => item.category));
  const suppliers = uniqueOptions(branchData.medicines.map((item) => item.supplier));

  if (medicine && medicine.id !== prevId[0]) {
    prevId[1](medicine.id);
    const strip = medicine.stripSize || 10;
    setForm({
      name: medicine.name, category: medicine.category, manufacturer: medicine.manufacturer,
      batchNo: medicine.batchNo, expiryDate: formatExpiryMonth(medicine.expiryDate), stock: String(medicine.stock),
      stockSheets: strip > 0 && medicine.stock % strip === 0 ? String(medicine.stock / strip) : "",
      reorderLevel: String(medicine.reorderLevel), price: String(medicine.price),
      stripSize: String(strip),
      sheetPrice: medicine.sheetPrice ? String(medicine.sheetPrice) : fmtPrice(medicine.price * strip),
      supplier: medicine.supplier, status: medicine.status,
    });
  }

  const onTabPrice = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, price: v, sheetPrice: v === "" ? "" : fmtPrice((parseFloat(v) || 0) * strip) });
  };
  const onSheetPrice = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, sheetPrice: v, price: v === "" ? "" : fmtPrice((parseFloat(v) || 0) / strip) });
  };
  const onStripSize = (v: string) => {
    const strip = Math.max(1, parseInt(v) || 10);
    setForm({
      ...form, stripSize: v,
      sheetPrice: form.price === "" ? form.sheetPrice : fmtPrice((parseFloat(form.price) || 0) * strip),
      stock: form.stockSheets === "" ? form.stock : String(Math.round((parseFloat(form.stockSheets) || 0) * strip)),
    });
  };
  const onStockSheets = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, stockSheets: v, stock: v === "" ? "" : String(Math.round((parseFloat(v) || 0) * strip)) });
  };

  const handleSubmit = async () => {
    if (!medicine || !form.name) { toast({ title: "Error", description: "Medicine name is required", variant: "destructive" }); return; }
    const expiryDate = normalizeExpiryDate(form.expiryDate);
    if (!expiryDate) { toast({ title: "Invalid expiry", description: `Could not understand "${form.expiryDate || "—"}". Use MM/YYYY, e.g. 07/2027.`, variant: "destructive" }); return; }
    const stripCount = parseInt(form.stripSize) || 0;
    if (!Number.isInteger(stripCount) || stripCount < 1) { toast({ title: "Strip count required", description: "Enter how many tablets each sheet/strip contains (e.g. 10 or 15) — the sheet price is calculated from it.", variant: "destructive" }); return; }
    const updates = {
      name: form.name, category: form.category, manufacturer: form.manufacturer,
      batchNo: form.batchNo, expiryDate, stock: parseInt(form.stock) || 0,
      reorderLevel: parseInt(form.reorderLevel) || 0, price: parseFloat(form.price) || 0,
      stripSize: stripCount, sheetPrice: parseFloat(form.sheetPrice) || 0,
      supplier: form.supplier, status: form.status as Medicine["status"],
    };
    try {
      const res = await fetch("/api/medicines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: medicine.id, ...updates }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update medicine."); }
      const saved = await res.json();
      updateMedicine(medicine.id, saved);
      toast({ title: "Updated", description: `Medicine ${form.name} updated successfully` });
      if ((saved.stripSize ?? 10) !== updates.stripSize) {
        toast({ title: "Strip settings not saved", description: "Run migration 005 (strip_size, sheet_price columns) in Supabase, then edit and save this medicine again.", variant: "destructive" });
      }
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Medicine</DialogTitle><DialogDescription>Update medicine details</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Name *</Label><SearchableField value={form.name} onChange={(name) => setForm({ ...form, name })} options={medicineNames} placeholder="Search/add medicine" /></div>
          <div className="space-y-2"><Label>Category</Label><SearchableField value={form.category} onChange={(category) => setForm({ ...form, category })} options={medicineCategories} placeholder="Search/add category" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer" /></div>
          <div className="space-y-2"><Label>Batch No</Label><Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} placeholder="Batch number" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Expiry</Label><Input value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} placeholder="MM/YYYY" /></div>
          <div className="space-y-2"><Label>Reorder Lvl (tablets)</Label><Input value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder="Min stock" /></div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Stock — enter sheets, tablets auto-fill</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Sheets / Strips</Label><Input type="number" min={0} value={form.stockSheets} onChange={(e) => onStockSheets(e.target.value)} placeholder="e.g. 10 sheets" /></div>
            <div className="space-y-2"><Label>Tablets (loose count)</Label><Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value, stockSheets: "" })} placeholder="Tablets count" title="Type sheets above to auto-calculate, or enter loose tablets directly" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(parseInt(form.stock) || 0) > 0
              ? `Stock = ${(parseInt(form.stock) || 0).toLocaleString("en-IN")} tablets (${stockBreakdown(parseInt(form.stock) || 0, parseInt(form.stripSize) || 10)})`
              : "Enter sheets (uses Tablets-per-Sheet below) or type loose tablets directly."}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pricing — tablet & sheet auto-calculate</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Single Tablet (₹)</Label><Input type="number" min={0} value={form.price} onChange={(e) => onTabPrice(e.target.value)} placeholder="Per tablet" /></div>
            <div className="space-y-2"><Label>Tablets per Sheet *</Label><Input type="number" min={1} value={form.stripSize} onChange={(e) => onStripSize(e.target.value)} placeholder="e.g. 10 or 15" className={!form.stripSize || (parseInt(form.stripSize) || 0) < 1 ? "border-warning" : ""} /><p className="text-[10px] text-muted-foreground">Strip count — sheet price = tabs × single-tablet price</p></div>
            <div className="space-y-2"><Label>Sheet Price (₹)</Label><Input type="number" min={0} value={form.sheetPrice} onChange={(e) => onSheetPrice(e.target.value)} placeholder="Per sheet" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(parseFloat(form.price) || 0) > 0 || (parseFloat(form.sheetPrice) || 0) > 0
              ? `1 tab = ₹${fmtPrice(parseFloat(form.price) || 0)} • 1 sheet (${Math.max(1, parseInt(form.stripSize) || 10)} tabs) = ₹${fmtPrice(parseFloat(form.sheetPrice) || 0)}`
              : "Enter either price — the other calculates automatically."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Supplier</Label><SearchableField value={form.supplier} onChange={(supplier) => setForm({ ...form, supplier })} options={suppliers} placeholder="Search/add supplier" /></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["In Stock", "Low Stock", "Out of Stock", "Expiring Soon", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddMedicineDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addMedicine = useAppStore((s) => s.addMedicine);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", category: "", manufacturer: "", batchNo: "", expiryDate: "", stock: "", stockSheets: "", reorderLevel: "", price: "", stripSize: "10", sheetPrice: "", supplier: "" });
  const medicineNames = uniqueOptions(branchData.medicines.map((medicine) => medicine.name));
  const medicineCategories = uniqueOptions(branchData.medicines.map((medicine) => medicine.category));
  const suppliers = uniqueOptions(branchData.medicines.map((medicine) => medicine.supplier));

  const onTabPrice = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, price: v, sheetPrice: v === "" ? "" : fmtPrice((parseFloat(v) || 0) * strip) });
  };
  const onSheetPrice = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, sheetPrice: v, price: v === "" ? "" : fmtPrice((parseFloat(v) || 0) / strip) });
  };
  const onStripSize = (v: string) => {
    const strip = Math.max(1, parseInt(v) || 10);
    setForm({
      ...form, stripSize: v,
      sheetPrice: form.price === "" ? form.sheetPrice : fmtPrice((parseFloat(form.price) || 0) * strip),
      stock: form.stockSheets === "" ? form.stock : String(Math.round((parseFloat(form.stockSheets) || 0) * strip)),
    });
  };
  const onStockSheets = (v: string) => {
    const strip = Math.max(1, parseInt(form.stripSize) || 10);
    setForm({ ...form, stockSheets: v, stock: v === "" ? "" : String(Math.round((parseFloat(v) || 0) * strip)) });
  };

  const handleSubmit = async () => {
    if (!form.name) { toast({ title: "Error", description: "Medicine name is required", variant: "destructive" }); return; }
    const expiryDate = normalizeExpiryDate(form.expiryDate);
    if (!expiryDate) { toast({ title: "Invalid expiry", description: `Could not understand "${form.expiryDate || "—"}". Use MM/YYYY, e.g. 07/2027.`, variant: "destructive" }); return; }
    const stripCount = parseInt(form.stripSize) || 0;
    if (!Number.isInteger(stripCount) || stripCount < 1) { toast({ title: "Strip count required", description: "Enter how many tablets each sheet/strip contains (e.g. 10 or 15) — the sheet price is calculated from it.", variant: "destructive" }); return; }
    const newMedicine = {
      id: `med${Date.now()}`, name: form.name, category: form.category || "Tablet",
      manufacturer: form.manufacturer, batchNo: form.batchNo, expiryDate,
      stock: parseInt(form.stock) || 0, reorderLevel: parseInt(form.reorderLevel) || 0,
      price: parseFloat(form.price) || 0,
      stripSize: stripCount, sheetPrice: parseFloat(form.sheetPrice) || 0,
      supplier: form.supplier,
      status: (parseInt(form.stock) > 0 ? "In Stock" : "Out of Stock") as Medicine["status"], branch: branchData.branch,
    };
    try {
      const res = await fetch("/api/medicines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newMedicine) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add medicine."); }
      const saved = await res.json();
      addMedicine(saved);
      toast({ title: "Success", description: `Medicine ${form.name} added successfully` });
      if ((saved.stripSize ?? 10) !== newMedicine.stripSize) {
        toast({ title: "Strip settings not saved", description: "Run migration 005 (strip_size, sheet_price columns) in Supabase, then edit and save this medicine again.", variant: "destructive" });
      }
      setForm({ name: "", category: "", manufacturer: "", batchNo: "", expiryDate: "", stock: "", stockSheets: "", reorderLevel: "", price: "", stripSize: "10", sheetPrice: "", supplier: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add medicine", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add Medicine</DialogTitle><DialogDescription>Add a new medicine to the pharmacy inventory</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Name *</Label><SearchableField value={form.name} onChange={(name) => setForm({ ...form, name })} options={medicineNames} placeholder="Search/add medicine" /></div>
          <div className="space-y-2"><Label>Category</Label><SearchableField value={form.category} onChange={(category) => setForm({ ...form, category })} options={medicineCategories} placeholder="Search/add category" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Manufacturer</Label><Input value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} placeholder="Manufacturer name" /></div>
          <div className="space-y-2"><Label>Batch No</Label><Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} placeholder="Batch number" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Expiry Date</Label><Input value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} placeholder="MM/YYYY" /></div>
          <div className="space-y-2"><Label>Reorder Lvl (tablets)</Label><Input value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} placeholder="Min stock" /></div>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Stock — enter sheets, tablets auto-fill</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Sheets / Strips</Label><Input type="number" min={0} value={form.stockSheets} onChange={(e) => onStockSheets(e.target.value)} placeholder="e.g. 10 sheets" /></div>
            <div className="space-y-2"><Label>Tablets (loose count)</Label><Input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value, stockSheets: "" })} placeholder="Tablets count" title="Type sheets above to auto-calculate, or enter loose tablets directly" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(parseInt(form.stock) || 0) > 0
              ? `Stock = ${(parseInt(form.stock) || 0).toLocaleString("en-IN")} tablets (${stockBreakdown(parseInt(form.stock) || 0, parseInt(form.stripSize) || 10)})`
              : "Enter sheets (uses Tablets-per-Sheet below) or type loose tablets directly."}
          </p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Pricing — tablet & sheet auto-calculate</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2"><Label>Single Tablet (₹)</Label><Input type="number" min={0} value={form.price} onChange={(e) => onTabPrice(e.target.value)} placeholder="Per tablet" /></div>
            <div className="space-y-2"><Label>Tablets per Sheet *</Label><Input type="number" min={1} value={form.stripSize} onChange={(e) => onStripSize(e.target.value)} placeholder="e.g. 10 or 15" className={!form.stripSize || (parseInt(form.stripSize) || 0) < 1 ? "border-warning" : ""} /><p className="text-[10px] text-muted-foreground">Strip count — sheet price = tabs × single-tablet price</p></div>
            <div className="space-y-2"><Label>Sheet Price (₹)</Label><Input type="number" min={0} value={form.sheetPrice} onChange={(e) => onSheetPrice(e.target.value)} placeholder="Per sheet" /></div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {(parseFloat(form.price) || 0) > 0 || (parseFloat(form.sheetPrice) || 0) > 0
              ? `1 tab = ₹${fmtPrice(parseFloat(form.price) || 0)} • 1 sheet (${Math.max(1, parseInt(form.stripSize) || 10)} tabs) = ₹${fmtPrice(parseFloat(form.sheetPrice) || 0)}`
              : "Enter either price — the other calculates automatically."}
          </p>
        </div>
        <div className="space-y-2"><Label>Supplier</Label><SearchableField value={form.supplier} onChange={(supplier) => setForm({ ...form, supplier })} options={suppliers} placeholder="Search/add supplier" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Add Medicine</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLabTestDialog({ open, onOpenChange, test }: { open: boolean; onOpenChange: (v: boolean) => void; test: LabTest | null }) {
  const { toast } = useToast();
  const updateLabTest = useAppStore((s) => s.updateLabTest);
  const branchData = useBranchData();
  const [form, setForm] = useState({ patientName: "", test: "", category: "", orderedBy: "", status: "Ordered" as string, result: "", findings: "", problems: "", price: "" });
  const prevId = useState<string | null>(null);
  const testNames = uniqueOptions(branchData.labTests.map((item) => item.test));
  const testCategories = uniqueOptions(branchData.labTests.map((item) => item.category));
  const doctors = uniqueOptions(branchData.doctors.map((doctor) => doctor.name));

  if (test && test.id !== prevId[0]) {
    prevId[1](test.id);
    setForm({
      patientName: test.patientName, test: test.test, category: test.category,
      orderedBy: test.orderedBy, status: test.status, result: test.result || "",
      findings: test.findings || "", problems: test.problems || "",
      price: String(test.price),
    });
  }

  const handleSubmit = async () => {
    if (!test) return;
    const updates = {
      patientName: form.patientName, test: form.test, category: form.category,
      orderedBy: form.orderedBy, status: form.status as LabTest["status"],
      result: form.result || undefined, findings: form.findings || undefined,
      problems: form.problems || undefined, price: parseFloat(form.price) || 0,
      reportReady: form.status === "Approved",
    };
    try {
      const res = await fetch("/api/lab-tests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: test.id, ...updates }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update lab test."); }
      const saved = await res.json();
      updateLabTest(test.id, saved);
      toast({ title: "Updated", description: `Test order for ${form.patientName} updated` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Lab Test</DialogTitle><DialogDescription>Update lab test order details and report</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Patient</Label><PatientNameSearchField value={form.patientName} onChange={(patientName) => setForm({ ...form, patientName })} patients={branchData.patients} /></div>
          <div className="space-y-2"><Label>Test</Label><SearchableField value={form.test} onChange={(testName) => setForm({ ...form, test: testName })} options={testNames} placeholder="Search/add test" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Category</Label><SearchableField value={form.category} onChange={(category) => setForm({ ...form, category })} options={testCategories} placeholder="Search/add category" /></div>
          <div className="space-y-2"><Label>Ordered By</Label><SearchableField value={form.orderedBy} onChange={(orderedBy) => setForm({ ...form, orderedBy })} options={doctors} placeholder="Search/add doctor" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Ordered", "Sample Collected", "Testing", "Quality Check", "Approved", "Rejected", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Price (₹)</Label><Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" /></div>
        </div>
        <div className="space-y-2"><Label>Result</Label><Textarea value={form.result} onChange={(e) => setForm({ ...form, result: e.target.value })} placeholder="Test result summary" /></div>
        <div className="space-y-2"><Label>Findings</Label><Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} placeholder="Detailed findings from the test" /></div>
        <div className="space-y-2"><Label>Problems / Diagnosis</Label><Textarea value={form.problems} onChange={(e) => setForm({ ...form, problems: e.target.value })} placeholder="Identified problems or diagnosis" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTestOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addLabTest = useAppStore((s) => s.addLabTest);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);
  const branchData = useBranchData();
  const [form, setForm] = useState({ patientId: "", test: "", category: "", priority: "", notes: "", price: "" });
  const [priceTouched, setPriceTouched] = useState(false);
  const selectedPatient = branchData.patients.find((patient) => patient.id === form.patientId);
  const servicePrices = parseServicePrices(settings).filter((item) => item.module === "Laboratory");
  const selectedService = findServicePrice(servicePrices, "Laboratory", form.test, form.category);
  const testNames = uniqueOptions(branchData.labTests.map((test) => test.test), servicePrices.map((item) => item.name));
  const testCategories = uniqueOptions(branchData.labTests.map((test) => test.category), servicePrices.map((item) => item.category));

  const applyTestChange = (test: string) => {
    const svc = findServicePrice(servicePrices, "Laboratory", test);
    setForm({ ...form, test, category: svc?.category ?? form.category, price: svc ? String(svc.price) : form.price });
    setPriceTouched(false);
  };
  const applyCategoryChange = (category: string) => {
    const svc = findServicePrice(servicePrices, "Laboratory", form.test, category);
    setForm({ ...form, category, price: svc && !priceTouched ? String(svc.price) : form.price });
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !form.test) { toast({ title: "Error", description: "Patient and Test are required", variant: "destructive" }); return; }
    const price = Math.max(0, parseFloat(form.price) || 0);
    const newTest = {
      id: `lt${Date.now()}`, orderId: `LT-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
      patientName: selectedPatient.name, patientId: selectedPatient.id, test: form.test, category: form.category || "Blood",
      orderedBy: "", orderedOn: new Date().toISOString().split("T")[0], status: "Ordered" as LabTest["status"],
      reportReady: false, price, branch: branchData.branch,
    };
    try {
      const res = await fetch("/api/lab-tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newTest) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create test order."); }
      const saved = await res.json();
      addLabTest(saved);
      let invoiceNo = "";
      if (newTest.price > 0) {
        const today = new Date().toISOString().split("T")[0];
        const invRes = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `inv${Date.now()}`,
            invoiceNo: "",
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            date: today,
            dueDate: today,
            items: [{ description: newTest.test, category: "Lab", quantity: 1, rate: newTest.price, amount: newTest.price }],
            subtotal: newTest.price,
            tax: 0,
            discount: 0,
            total: newTest.price,
            paidAmount: 0,
            status: "Pending",
            branch: branchData.branch,
          }),
        });
        if (invRes.ok) {
          const savedInv = await invRes.json();
          addInvoice(savedInv);
          invoiceNo = savedInv.invoiceNo;
        }
      }
      toast({ title: "Success", description: `Test order created for ${selectedPatient.name}${newTest.price > 0 ? ` and ₹${newTest.price.toLocaleString("en-IN")} added to Billing${invoiceNo ? ` (${invoiceNo})` : ""}` : ""}` });
      setForm({ patientId: "", test: "", category: "", priority: "", notes: "", price: "" });
      setPriceTouched(false);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create order", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Test Order</DialogTitle><DialogDescription>Create a new laboratory test order</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Patient *</Label><PatientSearchField value={form.patientId} onChange={(patientId) => setForm({ ...form, patientId })} patients={branchData.patients} /></div>
          <div className="space-y-2"><Label>Test *</Label><SearchableField value={form.test} onChange={applyTestChange} options={testNames} placeholder="Search/add test" /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Category</Label><SearchableField value={form.category} onChange={applyCategoryChange} options={testCategories} placeholder="Search/add category" /></div>
          <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger><SelectContent>{["Normal", "Urgent", "STAT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2">
          <Label>Price (₹) *</Label>
          <Input type="number" min={0} value={form.price} onChange={(e) => { setForm({ ...form, price: e.target.value }); setPriceTouched(true); }} placeholder="Test price" />
          {selectedService
            ? <p className="text-xs text-success">Admin price: ₹{selectedService.price.toLocaleString("en-IN")} — added as a pending patient invoice. You can adjust it above.</p>
            : <p className="text-xs text-warning">No admin price set for this test — enter the price manually{servicePrices.length === 0 ? " (no Laboratory prices configured in Settings yet)" : ""}.</p>}
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Order</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRadiologyDialog({ open, onOpenChange, order }: { open: boolean; onOpenChange: (v: boolean) => void; order: RadiologyOrder | null }) {
  const { toast } = useToast();
  const updateRadiologyOrder = useAppStore((s) => s.updateRadiologyOrder);
  const branchData = useBranchData();
  const [form, setForm] = useState({ patientName: "", modality: "X-Ray" as string, region: "", orderedBy: "", status: "Ordered" as string, findings: "", problems: "", price: "" });
  const prevId = useState<string | null>(null);
  const modalities = uniqueOptions(branchData.radiologyOrders.map((item) => item.modality));
  const regions = uniqueOptions(branchData.radiologyOrders.map((item) => item.region));
  const doctors = uniqueOptions(branchData.doctors.map((doctor) => doctor.name));

  if (order && order.id !== prevId[0]) {
    prevId[1](order.id);
    setForm({
      patientName: order.patientName, modality: order.modality, region: order.region,
      orderedBy: order.orderedBy, status: order.status,
      findings: order.findings || "", problems: order.problems || "",
      price: String(order.price),
    });
  }

  const handleSubmit = async () => {
    if (!order) return;
    const updates = {
      patientName: form.patientName, modality: form.modality as RadiologyOrder["modality"],
      region: form.region, orderedBy: form.orderedBy,
      status: form.status as RadiologyOrder["status"], price: parseFloat(form.price) || 0,
      findings: form.findings || undefined, problems: form.problems || undefined,
    };
    try {
      const res = await fetch("/api/radiology-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, ...updates }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update order."); }
      const saved = await res.json();
      updateRadiologyOrder(order.id, saved);
      toast({ title: "Updated", description: `Radiology order for ${form.patientName} updated` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Radiology Order</DialogTitle><DialogDescription>Update radiology order details and report</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Patient</Label><PatientNameSearchField value={form.patientName} onChange={(patientName) => setForm({ ...form, patientName })} patients={branchData.patients} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Modality</Label><SearchableField value={form.modality} onChange={(modality) => setForm({ ...form, modality })} options={modalities} placeholder="Search/add modality" /></div>
          <div className="space-y-2"><Label>Region</Label><SearchableField value={form.region} onChange={(region) => setForm({ ...form, region })} options={regions} placeholder="Search/add region" /></div>
        </div>
        <div className="space-y-2"><Label>Ordered By</Label><SearchableField value={form.orderedBy} onChange={(orderedBy) => setForm({ ...form, orderedBy })} options={doctors} placeholder="Search/add doctor" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Ordered", "In Progress", "Image Captured", "Report Generated", "Approved", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Price (₹)</Label><Input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Price" /></div>
        </div>
        <div className="space-y-2"><Label>Findings</Label><Textarea value={form.findings} onChange={(e) => setForm({ ...form, findings: e.target.value })} placeholder="Radiology findings" /></div>
        <div className="space-y-2"><Label>Problems / Diagnosis</Label><Textarea value={form.problems} onChange={(e) => setForm({ ...form, problems: e.target.value })} placeholder="Identified problems or diagnosis" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewRadiologyOrderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addRadiologyOrder = useAppStore((s) => s.addRadiologyOrder);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);
  const branchData = useBranchData();
  const [form, setForm] = useState({ patientId: "", modality: "", region: "", priority: "", notes: "", price: "" });
  const [priceTouched, setPriceTouched] = useState(false);
  const selectedPatient = branchData.patients.find((patient) => patient.id === form.patientId);
  const servicePrices = parseServicePrices(settings).filter((item) => item.module === "Radiology");
  const selectedService = findServicePrice(servicePrices, "Radiology", form.region, form.modality);
  const modalities = uniqueOptions(branchData.radiologyOrders.map((order) => order.modality), servicePrices.map((item) => item.category));
  const regions = uniqueOptions(branchData.radiologyOrders.map((order) => order.region), servicePrices.map((item) => item.name));

  const applyRegionChange = (region: string) => {
    const svc = findServicePrice(servicePrices, "Radiology", region);
    setForm({ ...form, region, modality: svc?.category ?? form.modality, price: svc ? String(svc.price) : form.price });
    setPriceTouched(false);
  };
  const applyModalityChange = (modality: string) => {
    const svc = findServicePrice(servicePrices, "Radiology", form.region, modality);
    setForm({ ...form, modality, price: svc && !priceTouched ? String(svc.price) : form.price });
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !form.region) { toast({ title: "Error", description: "Patient and Region are required", variant: "destructive" }); return; }
    const price = Math.max(0, parseFloat(form.price) || 0);
    const newOrder = {
      id: `ro${Date.now()}`, orderId: `RO-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
      patientName: selectedPatient.name, patientId: selectedPatient.id, modality: (form.modality || "X-Ray") as RadiologyOrder["modality"],
      region: form.region, orderedBy: "", orderedOn: new Date().toISOString().split("T")[0],
      status: "Ordered" as RadiologyOrder["status"], price, branch: branchData.branch,
    };
    try {
      const res = await fetch("/api/radiology-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newOrder) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create order."); }
      const saved = await res.json();
      addRadiologyOrder(saved);
      let invoiceNo = "";
      if (newOrder.price > 0) {
        const today = new Date().toISOString().split("T")[0];
        const invRes = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `inv${Date.now()}`,
            invoiceNo: "",
            patientId: selectedPatient.id,
            patientName: selectedPatient.name,
            date: today,
            dueDate: today,
            items: [{ description: `${newOrder.modality} - ${newOrder.region}`, category: "Radiology", quantity: 1, rate: newOrder.price, amount: newOrder.price }],
            subtotal: newOrder.price,
            tax: 0,
            discount: 0,
            total: newOrder.price,
            paidAmount: 0,
            status: "Pending",
            branch: branchData.branch,
          }),
        });
        if (invRes.ok) {
          const savedInv = await invRes.json();
          addInvoice(savedInv);
          invoiceNo = savedInv.invoiceNo;
        }
      }
      toast({ title: "Success", description: `Radiology order created for ${selectedPatient.name}${newOrder.price > 0 ? ` and ₹${newOrder.price.toLocaleString("en-IN")} added to Billing${invoiceNo ? ` (${invoiceNo})` : ""}` : ""}` });
      setForm({ patientId: "", modality: "", region: "", priority: "", notes: "", price: "" });
      setPriceTouched(false);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not create order", description: e.message, variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Radiology Order</DialogTitle><DialogDescription>Create a new radiology order</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Patient *</Label><PatientSearchField value={form.patientId} onChange={(patientId) => setForm({ ...form, patientId })} patients={branchData.patients} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Modality</Label><SearchableField value={form.modality} onChange={applyModalityChange} options={modalities} placeholder="Search/add modality" /></div>
          <div className="space-y-2"><Label>Region *</Label><SearchableField value={form.region} onChange={applyRegionChange} options={regions} placeholder="Search/add region" /></div>
        </div>
        <div className="space-y-2"><Label>Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger><SelectContent>{["Normal", "Urgent", "STAT"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2">
          <Label>Price (₹) *</Label>
          <Input type="number" min={0} value={form.price} onChange={(e) => { setForm({ ...form, price: e.target.value }); setPriceTouched(true); }} placeholder="Study price" />
          {selectedService
            ? <p className="text-xs text-success">Admin price: ₹{selectedService.price.toLocaleString("en-IN")} — added as a pending patient invoice. You can adjust it above.</p>
            : <p className="text-xs text-warning">No admin price set for this study — enter the price manually{servicePrices.length === 0 ? " (no Radiology prices configured in Settings yet)" : ""}.</p>}
        </div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes" /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Order</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Pharmacy Module =====
export function PharmacyModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const updateMedicine = useAppStore((s) => s.updateMedicine);
  const deleteMedicine = useAppStore((s) => s.deleteMedicine);
  const settings = useAppStore((s) => s.settings);
  const { medicines, invoices, branch } = useBranchData();
  const [search, setSearch] = useState("");
  const [addMedicineOpen, setAddMedicineOpen] = useState(false);
  const [dispenseOpen, setDispenseOpen] = useState(false);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [editMedicine, setEditMedicine] = useState<Medicine | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const showAdd = canAddMedicine(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "pharmacy");
  const showDelete = canDeleteModule(currentUser.role, "pharmacy");
  const showDispense = showAdd || showEdit;

  const todayStr = new Date().toISOString().split("T")[0];
  const recentSales = invoices
    .filter((i) => i.date === todayStr && (i.items ?? []).some((it) => it.category === "Pharmacy"))
    .slice(0, 8);

  // Doctor-issued prescriptions awaiting fulfillment.
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxSearch, setRxSearch] = useState("");
  const filteredPrescriptions = prescriptions.filter((p) =>
    p.patientName.toLowerCase().includes(rxSearch.trim().toLowerCase()) ||
    p.items.some((it) => it.medicineName.toLowerCase().includes(rxSearch.trim().toLowerCase()))
  );
  const [dispensePrefill, setDispensePrefill] = useState<{ patientName: string; items: { name: string; qty: number; unit: "Tablet" | "Sheet" }[] } | null>(null);
  const loadPrescriptions = async () => {
    setRxLoading(true);
    try {
      const res = await fetch(`/api/prescriptions?branch=${encodeURIComponent(branch)}`);
      if (res.ok) {
        const all = await res.json();
        setPrescriptions((Array.isArray(all) ? all : []).filter((p: Prescription) => p.status === "Issued" || p.status === "Partially Dispensed"));
      }
    } catch {
      // Prescriptions table may predate migration 006; queue stays empty.
    } finally {
      setRxLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadPrescriptions(); }, [branch]);

  // Backend-synced pharmacy alerts: recompute from live stock + expiry on
  // every medicine/branch change and persist the active set to Supabase
  // (medicine_alerts) so the bell + dashboards stay correct everywhere.
  const medicineAlerts = useAppStore((s) => s.medicineAlerts);
  const acknowledgeMedicineAlert = useAppStore((s) => s.acknowledgeMedicineAlert);
  const expiryDays = Math.max(1, parseInt(settings.pharmacy_expiryDays ?? "30") || 30);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (medicines.length === 0) return;
    const desired = computeDesiredAlerts(medicines, expiryDays);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/medicine-alerts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alerts: desired, branch }),
        });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (Array.isArray(data)) useAppStore.setState({ medicineAlerts: data });
      } catch {
        // Offline or migration 029 pending: fall back to the live computation.
        if (!cancelled) {
          useAppStore.setState({
            medicineAlerts: desired.map((d) => ({
              id: `local-${d.medicineId}-${d.alertType}`,
              medicineId: d.medicineId,
              medicineName: d.medicineName,
              batchNo: d.batchNo,
              alertType: d.alertType,
              severity: d.severity,
              message: d.message,
              daysToExpiry: d.daysToExpiry ?? null,
              stock: d.stock,
              threshold: d.threshold,
              status: "active" as const,
              branch: d.branch,
              createdAt: new Date().toISOString(),
              resolvedAt: null,
            })),
          });
        }
      }
    })();
    return () => { cancelled = true; };
  }, [medicines, branch, expiryDays]);

  const markPrescription = async (id: string, status: Prescription["status"]) => {
    try {
      const res = await fetch("/api/prescriptions", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status }) });
      if (!res.ok) throw new Error("Failed");
      setPrescriptions((l) => l.filter((p) => p.id !== id || status === "Partially Dispensed").map((p) => (p.id === id ? { ...p, status } : p)));
      if (status === "Dispensed") setPrescriptions((l) => l.filter((p) => p.id !== id));
      toast({ title: "Prescription Updated", description: `Marked as ${status}.` });
    } catch {
      toast({ title: "Could not update prescription", variant: "destructive" });
    }
  };
  const pharmacySalesToday = invoices
    .filter((i) => i.date === todayStr)
    .reduce((s, inv) => s + inv.items.filter((it) => it.category === "Pharmacy").reduce((is, it) => is + it.amount, 0), 0);
  const fmtLakh = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` : `₹${Math.round(n).toLocaleString("en-IN")}`;

  const filtered = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );
  const {
    pageItems: pagedMedicines, page: medPage, setPage: setMedPage,
    pageSize: medPageSize, setPageSize: setMedPageSize, totalPages: medPages, total: medTotal,
  } = usePagination(filtered, search);
  const addMedicine = useAppStore((s) => s.addMedicine);
  const medicineIO: EntityIOConfig<Medicine> = {
    entity: "medicines",
    filename: "medicines",
    columns: [
      { header: "name", sample: "Paracetamol 500mg" },
      { header: "category", sample: "Tablet" },
      { header: "manufacturer", sample: "GSK" },
      { header: "batchNo", sample: "B123" },
      { header: "expiryDate", sample: "12/2027" },
      { header: "stock", sample: "100" },
      { header: "reorderLevel", sample: "20" },
      { header: "price", sample: "5" },
      { header: "stripSize", sample: "10" },
      { header: "sheetPrice", sample: "50" },
      { header: "supplier", sample: "MediSupply" },
      { header: "status", sample: "In Stock" },
      { header: "branch", sample: branch },
    ],
    toRow: (m) => [m.name, m.category, m.manufacturer, m.batchNo, formatExpiryMonth(m.expiryDate), m.stock, m.reorderLevel, m.price, m.stripSize ?? 10, m.sheetPrice ?? 0, m.supplier, m.status, m.branch],
    fromRow: (row, i) => {
      if (!row.name) throw new Error("name is required.");
      const expiryDate = normalizeExpiryDate(row.expiryDate);
      if (!expiryDate) throw new Error(`Invalid expiry "${row.expiryDate || "—"}". Use MM/YYYY.`);
      const stock = parseInt(row.stock) || 0;
      return {
        id: `med${Date.now()}${i}`,
        name: row.name,
        category: row.category || "Tablet",
        manufacturer: row.manufacturer || "",
        batchNo: row.batchNo || "",
        expiryDate,
        stock,
        reorderLevel: parseInt(row.reorderLevel) || 0,
        price: parseFloat(row.price) || 0,
        stripSize: Math.max(1, parseInt(row.stripSize) || 10),
        sheetPrice: parseFloat(row.sheetPrice) || 0,
        supplier: row.supplier || "",
        status: stock > 0 ? "In Stock" : "Out of Stock",
        branch: row.branch || branch,
      };
    },
    endpoint: "/api/medicines",
    onImported: (saved) => addMedicine(saved),
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/medicines", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
      deleteMedicine(deleteTarget.id);
      toast({ title: "Deleted", description: `${deleteTarget.name} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  const handlePurchaseOrder = () => {
    const hospitalName = settings.hospitalName || "MediCore Hospital";
    const lowStock = medicines.filter((m) => m.status === "Low Stock" || m.status === "Out of Stock" || m.stock <= m.reorderLevel);
    const items = lowStock.length ? lowStock : medicines;
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const generatedOn = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const rows = items.length
      ? items
          .map((m, i) => {
            const suggested = Math.max(m.reorderLevel * 3 - m.stock, m.reorderLevel, 1);
            return `<tr>
            <td style="padding:8px 10px;border:1px solid #e5e7eb">${i + 1}. ${esc(m.name)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center">${esc(m.stock)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center">${esc(m.reorderLevel)}</td>
            <td style="padding:8px 10px;border:1px solid #e5e7eb;text-align:center;font-weight:700">${suggested}</td>
          </tr>`;
          })
          .join("")
      : `<tr><td colspan="4" style="padding:12px;border:1px solid #e5e7eb;text-align:center;color:#888">No items to reorder</td></tr>`;
    const win = window.open("", "_blank", "width=760,height=920");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow popups to generate the purchase order.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Purchase Order</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 32px; max-width: 720px; margin: 0 auto; }
    .head { text-align: center; border-bottom: 3px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .hname { font-size: 26px; font-weight: 800; letter-spacing: 0.5px; }
    .htitle { font-size: 15px; font-weight: 700; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px; color: #374151; }
    .meta { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 16px; font-size: 13px; }
    .meta .label { color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 14px; }
    th { background: #f3f4f6; text-align: left; padding: 8px 10px; border: 1px solid #e5e7eb; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    .foot { margin-top: 28px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #d1d5db; padding-top: 12px; }
    @media print { body { padding: 0; } }
  </style></head><body>
    <div class="head">
      <div class="hname">${esc(hospitalName)}</div>
      <div class="htitle">Purchase Order</div>
    </div>
    <div class="meta">
      <div><div class="label">Generated</div><strong>${esc(generatedOn)}</strong></div>
      <div><div class="label">Items</div><strong>${items.length}</strong></div>
      <div><div class="label">Basis</div>${lowStock.length ? "Low / Out of Stock" : "Full Inventory"}</div>
    </div>
    <table>
      <thead><tr><th>Item</th><th style="text-align:center">Current Stock</th><th style="text-align:center">Reorder Level</th><th style="text-align:center">Suggested Qty</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="foot">Generated by ${esc(hospitalName)} Pharmacy &mdash; review quantities before submitting to supplier.</div>
  </body></html>`);
    win.document.close();
    win.focus();
    win.print();
    toast({ title: "Purchase Order ready", description: lowStock.length ? `${lowStock.length} low-stock item${lowStock.length === 1 ? "" : "s"} listed.` : "No low stock — full inventory template generated." });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy"
        description="Medicine inventory, prescriptions, sales, and supplier management"
        icon={Pill}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePurchaseOrder}><Package className="h-3.5 w-3.5" /> Purchase Order</Button>
            {showDispense && <Button variant="outline" size="sm" className="gap-2 border-success/50 text-success hover:bg-success/10" onClick={() => setDispenseOpen(true)}><Pill className="h-3.5 w-3.5" /> Dispense / New Sale</Button>}
            {showAdd && <Button size="sm" className="gap-2" onClick={() => setAddMedicineOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Medicine</Button>}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Medicines" value={medicines.length.toString()} icon={Pill} color="primary" />
        <StatCard title="Today's Sales" value={fmtLakh(pharmacySalesToday)} icon={TrendingUp} color="success" />
        <StatCard title="Low Stock" value={medicines.filter(m => m.status === "Low Stock").length.toString()} icon={AlertTriangle} color="warning" />
        <StatCard title="Expiring Soon" value={medicines.filter(m => m.status === "Expiring Soon").length.toString()} icon={Clock} color="destructive" />
      </div>

      {medicineAlerts.filter((a) => a.status === "active").length > 0 && (
        <Card className="border-warning/40">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <BellRing className="h-4 w-4 text-warning" />
              Stock & Expiry Alerts
              <Badge variant="outline" className="text-[10px]">{medicineAlerts.filter((a) => a.status === "active").length} active</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {medicineAlerts.filter((a) => a.status === "active").slice(0, 8).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-xs">
                <Badge variant="outline" className={`text-[10px] shrink-0 ${a.severity === "high" ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-warning/10 text-warning border-warning/30"}`}>
                  {a.alertType === "expiry" ? "Expiring" : a.alertType === "expired" ? "Expired" : a.alertType === "low_stock" ? "Low Stock" : "Out of Stock"}
                </Badge>
                <p className="flex-1 min-w-0">{a.message}</p>
                <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={() => acknowledgeMedicineAlert(a.id)} title="Mark as seen">
                  <Check className="h-3 w-3 mr-1" /> Seen
                </Button>
              </div>
            ))}
            {medicineAlerts.filter((a) => a.status === "active").length > 8 && (
              <p className="text-[11px] text-muted-foreground">+{medicineAlerts.filter((a) => a.status === "active").length - 8} more — see the notification bell.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <div className="relative flex-1 max-w-sm min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            {showAdd && <ImportExportButtons config={medicineIO} items={filtered} compact />}
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Medicine</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="hidden lg:table-cell">Batch No</TableHead>
                  <TableHead className="hidden lg:table-cell">Expiry</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  {(showEdit || showDelete) && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedMedicines.map((m) => (
                  <TableRow key={m.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.manufacturer}</p>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px]">{m.category}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell font-mono text-xs">{m.batchNo}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{formatExpiryMonth(m.expiryDate)}</TableCell>
                    <TableCell>
                      <div className="w-28">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium" title={`${m.stock} tablets = ${stockBreakdown(m.stock, m.stripSize)}`}>{m.stock} tabs</span>
                          <span className="text-muted-foreground">/ {m.reorderLevel}</span>
                        </div>
                        <Progress value={(m.stock / (m.reorderLevel * 3)) * 100} className="h-1.5" />
                        <p className="text-[10px] text-muted-foreground mt-0.5">{stockBreakdown(m.stock, m.stripSize)}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{m.price}</TableCell>
                    <TableCell>
                      <Select value={m.status} onValueChange={async (v) => {
                        try {
                          const res = await fetch("/api/medicines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, status: v }) });
                          if (!res.ok) throw new Error("Failed");
                          updateMedicine(m.id, { status: v as Medicine["status"] });
                        } catch { toast({ title: "Could not update status", variant: "destructive" }); }
                      }}>
                        <SelectTrigger className="h-7 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["In Stock", "Low Stock", "Out of Stock", "Expiring Soon", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    {(showEdit || showDelete) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditMedicine(m)}><Pencil className="h-3.5 w-3.5" /></Button>}
                          {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: m.id, name: m.name })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pt-2">
            <DataPagination page={medPage} totalPages={medPages} pageSize={medPageSize} total={medTotal} onPage={setMedPage} onPageSize={setMedPageSize} />
          </div>
        </CardContent>
      </Card>
      {recentSales.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> Today&apos;s Sales ({recentSales.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Bill</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Tablets</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]">Collect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSales.map((inv) => {
                    const tabs = (inv.items ?? []).filter((it) => it.category === "Pharmacy").reduce((s, it) => s + (it.quantity || 0), 0);
                    const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                    return (
                      <TableRow key={inv.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
                        <TableCell className="text-sm">{inv.patientName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(inv.items ?? []).filter((it) => it.category === "Pharmacy").map((it) => it.description).join("; ").slice(0, 80)}
                          <span className="block text-[11px]">{tabs} tablet(s)</span>
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell>
                          {outstanding > 0
                            ? <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => setCollectInvoice(inv)} title={`Collect ₹${outstanding.toLocaleString("en-IN")}`}><TrendingUp className="h-3.5 w-3.5" /></Button>
                            : <span className="text-[11px] text-success">Paid</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      {(prescriptions.length > 0 || rxLoading || rxSearch.trim()) && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base flex items-center gap-2 shrink-0">
              <Pill className="h-4 w-4 text-primary" /> Prescriptions to Fulfill ({filteredPrescriptions.length})
            </CardTitle>
            <div className="flex items-center gap-1.5 flex-1 max-w-xs">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search patient or tablet…" value={rxSearch} onChange={(e) => setRxSearch(e.target.value)} className="pl-8 h-8 text-xs" />
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[11px] shrink-0" onClick={loadPrescriptions} disabled={rxLoading}>{rxLoading ? "Loading…" : "Refresh"}</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Patient</TableHead>
                    <TableHead>Tablets</TableHead>
                    <TableHead className="hidden md:table-cell">Doctor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[170px]">Fulfill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPrescriptions.map((rx) => (
                    <TableRow key={rx.id} className="hover:bg-muted/40">
                      <TableCell>
                        <p className="text-sm font-medium">{rx.patientName}</p>
                        <p className="text-[11px] text-muted-foreground">{rx.date}{rx.diagnosis ? ` • ${rx.diagnosis}` : ""}</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {rx.items.map((it, i) => (
                          <p key={i} className="truncate max-w-xs">{it.medicineName} — {it.quantity} {it.unit === "Sheet" ? "sheet(s)" : "tab(s)"}{it.dosage ? ` • ${it.dosage}` : ""}{it.frequency ? ` • ${it.frequency}` : ""}</p>
                        ))}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs">{rx.doctorName || "—"}</TableCell>
                      <TableCell><StatusBadge status={rx.status} /></TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-success/50 text-success hover:bg-success/10"
                            onClick={() => {
                              setDispensePrefill({
                                patientName: rx.patientName,
                                items: rx.items.map((it) => ({ name: it.medicineName, qty: it.quantity, unit: it.unit })),
                              });
                              setDispenseOpen(true);
                            }}
                            title="Open dispense with these tablets"
                          >
                            <Pill className="h-3 w-3" /> Dispense
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => markPrescription(rx.id, "Dispensed")} title="Mark as dispensed">
                            Done
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
      <AddMedicineDialog open={addMedicineOpen} onOpenChange={setAddMedicineOpen} />
      <DispenseMedicineDialog
        key={dispensePrefill ? `${dispensePrefill.patientName}-${dispensePrefill.items.length}` : "manual"}
        open={dispenseOpen}
        onOpenChange={(v) => { if (!v) { setDispenseOpen(false); setDispensePrefill(null); loadPrescriptions(); } else setDispenseOpen(true); }}
        prefill={dispensePrefill}
      />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Payment" />
      <EditMedicineDialog open={!!editMedicine} onOpenChange={(v) => { if (!v) setEditMedicine(null); }} medicine={editMedicine} />
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Medicine</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Shared Clinical Dialogs =====

// Sheet ↔ single-tablet price helpers (two-way: editing one derives the other).
const roundPrice = (n: number) => Math.round(n * 100) / 100;
const fmtPrice = (n: number) => String(roundPrice(n));

// Stock is counted in tablets; show the sheet equivalent alongside so both
// units are always visible (e.g. 255 tabs → "25 sheets + 5 tabs").
function stockBreakdown(stock: number, stripSize?: number | null): string {
  const strip = Math.max(1, stripSize || 10);
  const sheets = Math.floor(stock / strip);
  const loose = stock % strip;
  if (loose === 0) return `${sheets} sheet(s)`;
  if (sheets === 0) return `${loose} tab(s)`;
  return `${sheets} sheet(s) + ${loose} tab(s)`;
}

interface DispenseRow { medId: string; unit: "Tablet" | "Sheet"; perSheet: string; qty: string; }

function DispenseMedicineDialog({ open, onOpenChange, prefill }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  prefill?: { patientName: string; items: { name: string; qty: number; unit: "Tablet" | "Sheet" }[] } | null;
}) {
  const { toast } = useToast();
  const addInvoice = useAppStore((s) => s.addInvoice);
  const updateMedicine = useAppStore((s) => s.updateMedicine);
  const settings = useAppStore((s) => s.settings);
  const branchData = useBranchData();
  const [patientName, setPatientName] = useState("");
  const [rows, setRows] = useState<DispenseRow[]>([{ medId: "", unit: "Tablet", perSheet: "10", qty: "" }]);
  const [collected, setCollected] = useState(true);
  const [saving, setSaving] = useState(false);
  const prevOpen = useState(false);

  if (open && !prevOpen[0]) {
    prevOpen[1](true);
    if (prefill) {
      setPatientName(prefill.patientName || "");
      setRows(prefill.items.length > 0 ? prefill.items.map((it) => {
        const m = branchData.medicines.find((x) => x.name.toLowerCase() === it.name.toLowerCase());
        return { medId: m ? m.id : it.name, unit: it.unit, perSheet: String(m?.stripSize || 10), qty: String(it.qty || "") };
      }) : [{ medId: "", unit: "Tablet", perSheet: "10", qty: "" }]);
    }
  }
  if (!open && prevOpen[0]) prevOpen[1](false);

  const patientOptions = branchData.patients.map((p) => p.name);
  const medOptions = branchData.medicines
    .filter((m) => m.stock > 0)
    .map((m) => `${m.name} — ₹${m.price}/tab (${m.stock} in stock)`);

  const lines = rows.map((r) => {
    const med = branchData.medicines.find((m) => m.id === r.medId || m.name === r.medId);
    const qty = Math.max(0, parseFloat(r.qty) || 0);
    const perSheet = Math.max(1, parseInt(r.perSheet) || 10);
    // Stock is always counted in individual tablets: sheet sales deduct
    // sheets × tablets-per-sheet, loose sales deduct tablets.
    const sheets = Math.max(0, Math.round(qty));
    const tablets = r.unit === "Sheet" ? sheets * perSheet : Math.max(0, Math.round(qty));
    const deduction = tablets;
    const tabPrice = med?.price || 0;
    const sheetCost = perSheet * tabPrice;
    const amount = roundPrice(tablets * tabPrice);
    return { med, qty, sheets, perSheet, tablets, deduction, amount, unit: r.unit, tabPrice, sheetCost };
  });
  const validLines = lines.filter((l) => l.med && l.tablets > 0);
  const total = validLines.reduce((s, l) => s + l.amount, 0);

  const setRow = (idx: number, patch: Partial<DispenseRow>) =>
    setRows((list) => list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const handleSubmit = async () => {
    const patient = branchData.patients.find((p) => p.name === patientName);
    if (!patientName.trim()) { toast({ title: "Patient required", description: "Search a patient or type a custom name.", variant: "destructive" }); return; }
    if (validLines.length === 0) { toast({ title: "No medicines", description: "Add at least one medicine with quantity.", variant: "destructive" }); return; }
    const short = validLines.find((l) => l.deduction > (l.med?.stock || 0));
    if (short) {
      toast({ title: "Insufficient stock", description: `Only ${short.med?.stock} tabs (${stockBreakdown(short.med?.stock || 0, short.med?.stripSize)}) of ${short.med?.name} in stock.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const invRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `inv${Date.now()}`,
          patientId: patient?.id || "",
          patientName: patientName.trim(),
          date: today,
          dueDate: today,
          items: validLines.map((l) => ({
            description: l.unit === "Sheet"
              ? `${l.med!.name} — ${l.sheets} sheet(s) × ${l.perSheet} tabs (${l.tablets} tabs) @ ₹${l.tabPrice}/tab`
              : `${l.med!.name} — ${l.tablets} tablet(s) @ ₹${l.tabPrice}/tab`,
            category: "Pharmacy",
            quantity: l.tablets,
            rate: l.tabPrice,
            amount: l.amount,
          })),
          subtotal: total,
          tax: 0,
          discount: 0,
          total,
          paidAmount: collected ? total : 0,
          status: collected ? "Paid" : "Pending",
          paymentMethod: collected ? "Cash" : "",
          branch: branchData.branch,
          paidDate: collected ? today : "",
        }),
      });
      if (!invRes.ok) { const b = await invRes.json().catch(() => ({})); throw new Error(b.error || "Failed to create the bill."); }
      const savedInv = await invRes.json();
      // Cut stock for every dispensed medicine (DB + local store together).
      const stockNotes: string[] = [];
      for (const l of validLines) {
        const med = l.med!;
        const newStock = Math.max(0, Math.round(med.stock - l.deduction));
        const status: Medicine["status"] =
          newStock === 0 ? "Out of Stock"
          : newStock <= med.reorderLevel ? (med.status === "Expiring Soon" || med.status === "Follow Up" ? med.status : "Low Stock")
          : (med.status === "Expiring Soon" || med.status === "Follow Up" ? med.status : "In Stock");
        const res = await fetch("/api/medicines", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: med.id, stock: newStock, status }) });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Stock update failed for ${med.name}. Bill ${savedInv.invoiceNo} was still created — fix stock from the medicine list.`); }
        updateMedicine(med.id, await res.json());
        stockNotes.push(`${med.name}: ${med.stock} → ${newStock} tabs (${stockBreakdown(newStock, med.stripSize)})`);
      }
      addInvoice(savedInv);
      if (!printInvoice(savedInv, settings, patient)) {
        toast({ title: "Bill ready to download", description: "Allow pop-ups for auto-print, or download it from Billing." });
      }
      toast({ title: "Medicines Dispensed", description: `${validLines.length} item(s) billed ₹${total.toLocaleString("en-IN")} ${collected ? "collected" : "pending"} (${savedInv.invoiceNo}). Stock: ${stockNotes.join("; ")}.` });
      setPatientName("");
      setRows([{ medId: "", unit: "Tablet", perSheet: "10", qty: "" }]);
      setCollected(true);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not dispense", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dispense Medicines</DialogTitle><DialogDescription>Bill tablets to a patient — stock cuts automatically and the sale appears in Billing.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs grid grid-cols-3 gap-2">
            <div><p className="text-muted-foreground">Items</p><p className="text-base font-bold">{validLines.length}</p></div>
            <div><p className="text-muted-foreground">Quantity</p><p className="text-base font-bold">{(() => { const sh = validLines.filter((l) => l.unit === "Sheet").reduce((s, l) => s + l.sheets, 0); const tb = validLines.filter((l) => l.unit !== "Sheet").reduce((s, l) => s + l.tablets, 0); return [sh > 0 ? `${sh} sheet(s)` : "", tb > 0 ? `${tb} tab(s)` : ""].filter(Boolean).join(" • ") || "—"; })()}</p></div>
            <div><p className="text-muted-foreground">Bill total</p><p className="text-base font-bold text-primary">₹{total.toLocaleString("en-IN")}</p></div>
          </div>
          <div className="space-y-2">
            <Label>Patient *</Label>
            <SearchableField value={patientName} onChange={setPatientName} options={patientOptions} placeholder="Search patient or type custom name" searchPlaceholder="Search patient or type custom name..." emptyLabel="Use custom name" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Medicines</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRows((l) => [...l, { medId: "", unit: "Tablet", perSheet: "10", qty: "" }])}><Plus className="h-3 w-3 mr-1" /> Add Tablet</Button>
            </div>
            {rows.map((r, i) => {
              const line = lines[i];
              return (
                <div key={i} className="rounded-lg border p-2 space-y-1.5">
                  <div className={`grid gap-1.5 items-center ${r.unit === "Sheet" ? "grid-cols-[1fr_104px_76px_86px_32px]" : "grid-cols-[1fr_104px_76px_32px]"}`}>
                    <SearchableField value={(() => { const m = branchData.medicines.find((x) => x.id === r.medId); return m ? `${m.name} — ₹${m.price}/tab (${m.stock} in stock)` : r.medId; })()} onChange={(v) => { const name = v.split(" — ₹")[0].trim(); const m = branchData.medicines.find((x) => x.name === name); setRow(i, { medId: m ? m.id : name, perSheet: m?.stripSize ? String(m.stripSize) : r.perSheet }); }} options={medOptions} placeholder="Search tablet" searchPlaceholder="Search in-stock tablets..." emptyLabel="No tablet found" />
                    <Select value={r.unit} onValueChange={(v) => setRow(i, { unit: v as DispenseRow["unit"] })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Tablet">Tablet(s)</SelectItem><SelectItem value="Sheet">Sheet(s)</SelectItem></SelectContent>
                    </Select>
                    <div className="space-y-0.5">
                      <Input className="h-8 text-xs" type="number" min={0} title={r.unit === "Sheet" ? "Number of sheets" : "Number of tablets"} placeholder={r.unit === "Sheet" ? "Sheets" : "Qty"} value={r.qty} onChange={(e) => setRow(i, { qty: e.target.value })} />
                      <p className="text-[9px] text-muted-foreground leading-none">{r.unit === "Sheet" ? "Sheets" : "Tablets"}</p>
                    </div>
                    {r.unit === "Sheet" && (
                      <div className="space-y-0.5">
                        <Input className="h-8 text-xs border-primary/40" type="number" min={1} title="Manually enter how many tablets this sheet contains" placeholder="Tabs/sheet" value={r.perSheet} onChange={(e) => setRow(i, { perSheet: e.target.value })} />
                        <p className="text-[9px] text-muted-foreground leading-none">Tabs / sheet</p>
                      </div>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} title="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="flex items-center gap-1.5 pl-0.5 flex-wrap">
                    <span className="ml-auto text-[11px] font-medium text-right">
                      {line?.med ? (
                        r.unit === "Sheet"
                          ? <>1 tab ₹{line.tabPrice.toLocaleString("en-IN")} • 1 sheet ({line.perSheet} tabs) = <span className="text-primary">₹{line.sheetCost.toLocaleString("en-IN")}</span><br />{line.sheets} sheet(s) = {line.tablets} tabs • Total <span className="text-primary">₹{(line.amount || 0).toLocaleString("en-IN")}</span> • Stock −{line.tablets} tabs{line.deduction > (line.med.stock || 0) ? " — exceeds stock!" : ""}</>
                          : <>{line.tablets} tab(s) × ₹{line.tabPrice.toLocaleString("en-IN")} = <span className="text-primary">₹{(line.amount || 0).toLocaleString("en-IN")}</span> • Stock −{line.tablets} tabs{line.deduction > (line.med.stock || 0) ? " — exceeds stock!" : ""}</>
                      ) : "Pick a tablet above"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>Payment</Label>
            <Select value={collected ? "collected" : "pending"} onValueChange={(v) => setCollected(v === "collected")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collected">Collected now — Paid bill in Billing</SelectItem>
                <SelectItem value="pending">Not collected — Pending bill, collect later</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Dispensing..." : `Dispense • ₹${total.toLocaleString("en-IN")}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function UpdateLeadDialog({ open, onOpenChange, patientId }: { open: boolean; onOpenChange: (v: boolean) => void; patientId: string | null }) {
  const { toast } = useToast();
  const updateLead = useAppStore((s) => s.updateLead);
  const leads = useAppStore((s) => s.leads);
  const patients = useAppStore((s) => s.patients);
  const [stage, setStage] = useState("");
  const [saving, setSaving] = useState(false);
  const prevPatient = useState<string | null>(null);
  const patient = patientId ? patients.find((p) => p.id === patientId) : null;
  // Branch-scoped: same name/phone in another branch must never match.
  const lead = patient ? leads.find((l) => (l.name === patient.name || l.phone === patient.phone) && sameBranch(l.branch, patient.branch)) : null;
  const stageOptions: Lead["stage"][] = ["New Lead", "Contacted", "Appointment", "Visit", "Treatment", "Follow-up", "Review", "Repeat Patient"];

  if (patientId && patientId !== prevPatient[0]) {
    prevPatient[1](patientId);
    const matched = (() => {
      const p = patients.find((pt) => pt.id === patientId);
      return p ? leads.find((l) => (l.name === p.name || l.phone === p.phone) && sameBranch(l.branch, p.branch)) : null;
    })();
    setStage(matched ? matched.stage : "");
  }

  const handleSubmit = async () => {
    if (!lead || !stage) { onOpenChange(false); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, stage, lastContact: new Date().toISOString().split("T")[0] }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update lead."); }
      const saved = await res.json();
      updateLead(lead.id, saved);
      toast({ title: "Lead Updated", description: `${lead.name} moved to ${stage}` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update lead", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;
  if (!lead) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Update Lead</DialogTitle><DialogDescription>No CRM lead found for {patient?.name || "this patient"}. Leads are created in the Marketing module.</DialogDescription></DialogHeader>
          <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Update Lead</DialogTitle><DialogDescription>Update lead stage for {lead.name}</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Lead Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{stageOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Updating..." : "Update Lead"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



// ===== Laboratory Module =====
const labStatusFlow = ["Ordered", "Sample Collected", "Testing", "Quality Check", "Approved", "Follow Up"];

export function LaboratoryModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const updateLabTest = useAppStore((s) => s.updateLabTest);
  const deleteLabTest = useAppStore((s) => s.deleteLabTest);
  const { labTests, invoices, patients, branch } = useBranchData();
  const settings = useAppStore((s) => s.settings);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const addLabTest = useAppStore((s) => s.addLabTest);
  const labIO: EntityIOConfig<LabTest> = {
    entity: "lab tests",
    filename: "lab-tests",
    columns: [
      { header: "patientName", sample: "Ravi Kumar" },
      { header: "patientId", sample: "" },
      { header: "test", sample: "Complete Blood Count" },
      { header: "category", sample: "Blood" },
      { header: "orderedBy", sample: "Dr. Smith" },
      { header: "orderedOn", sample: new Date().toISOString().split("T")[0] },
      { header: "status", sample: "Ordered" },
      { header: "price", sample: "450" },
      { header: "result", sample: "" },
    ],
    toRow: (t) => [t.patientName, t.patientId, t.test, t.category, t.orderedBy, t.orderedOn, t.status, t.price, t.result || ""],
    fromRow: (row, i) => {
      if (!row.patientName || !row.test) throw new Error("patientName and test are required.");
      return {
        id: `lt${Date.now()}${i}`,
        orderId: `LT-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
        patientName: row.patientName,
        patientId: row.patientId || "",
        test: row.test,
        category: row.category || "Blood",
        orderedBy: row.orderedBy || "",
        orderedOn: row.orderedOn || new Date().toISOString().split("T")[0],
        status: "Ordered",
        reportReady: false,
        price: parseFloat(row.price) || 0,
        result: row.result || "",
        branch,
      };
    },
    endpoint: "/api/lab-tests",
    onImported: (saved) => addLabTest(saved),
  };
  const [newTestOrderOpen, setNewTestOrderOpen] = useState(false);
  const [editLabTest, setEditLabTest] = useState<LabTest | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [updateLeadPatientId, setUpdateLeadPatientId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);
  const openLabPreview = (t: LabTest) => {
    setViewDoc(buildLabReportHtml(t, patients.find((p) => p.id === t.patientId), settings));
    viewDownloadRef.current = () => { if (!printLabReport(t, patients.find((p) => p.id === t.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); };
  };
  const showAdd = canManageLab(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "laboratory");
  const showDelete = canDeleteModule(currentUser.role, "laboratory");

  const statusOptions = ["All", "Ordered", "Sample Collected", "Testing", "Quality Check", "Approved", "Rejected", "Follow Up"];
  const filteredTests = statusFilter === "All" ? labTests : labTests.filter(t => t.status === statusFilter);
  const {
    pageItems: pagedTests, page: labPage, setPage: setLabPage,
    pageSize: labPageSize, setPageSize: setLabPageSize, totalPages: labPages, total: labTotal,
  } = usePagination(filteredTests, statusFilter);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/lab-tests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
      deleteLabTest(deleteTarget.id);
      toast({ title: "Deleted", description: `Test for ${deleteTarget.name} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  // Create a pending bill for a test that has no invoice yet (e.g. created
  // with ₹0 before an admin price existed), then open collection immediately.
  const billTest = async (t: LabTest) => {
    if ((t.price || 0) <= 0) {
      toast({ title: "No price set", description: "Set the test price via Edit first, then create the bill.", variant: "destructive" });
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `inv${Date.now()}`,
          patientId: t.patientId,
          patientName: t.patientName,
          date: today,
          dueDate: today,
          items: [{ description: t.test, category: "Lab", quantity: 1, rate: t.price, amount: t.price }],
          subtotal: t.price,
          tax: 0,
          discount: 0,
          total: t.price,
          paidAmount: 0,
          status: "Pending",
          branch: t.branch,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create bill."); }
      const saved = await res.json();
      addInvoice(saved);
      toast({ title: "Bill Created", description: `₹${t.price.toLocaleString("en-IN")} pending bill ${saved.invoiceNo} created for ${t.patientName}.` });
      setCollectInvoice(saved);
    } catch (e: any) {
      toast({ title: "Could not create bill", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory"
        description="Test orders, sample collection, results, and approvals"
        icon={FlaskConical}
        action={showAdd ? <div className="flex items-center gap-1.5"><ImportExportButtons config={labIO} items={filteredTests} compact /><Button size="sm" className="gap-2" onClick={() => setNewTestOrderOpen(true)}><Plus className="h-3.5 w-3.5" /> New Test Order</Button></div> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Tests Today" value={labTests.length.toString()} icon={FlaskConical} color="primary" />
        <StatCard title="Pending" value={labTests.filter(t => !t.reportReady).length.toString()} icon={Clock} color="warning" />
        <StatCard title="Ready" value={labTests.filter(t => t.reportReady).length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Revenue" value={`₹${labTests.reduce((s, t) => s + t.price, 0).toLocaleString("en-IN")}`} icon={TrendingUp} color="success" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-primary" /> Lab Test Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {labStatusFlow.map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{i + 1}</span>
                  <span className="text-xs font-medium whitespace-nowrap">{step}</span>
                </div>
                {i < arr.length - 1 && <div className="h-px w-4 bg-primary/30" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Test Orders ({labTotal})</CardTitle>
          {showAdd && <ImportExportButtons config={labIO} items={filteredTests} compact />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 mx-4 mb-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
              {statusOptions.map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Test</TableHead>
                  <TableHead className="hidden md:table-cell">Ordered By</TableHead>
                  <TableHead className="hidden lg:table-cell">Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedTests.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{t.orderId}</TableCell>
                    <TableCell className="text-sm font-medium">{t.patientName}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{t.test}</p>
                        {t.result && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{t.result}</p>}
                        {t.findings && <p className="text-xs text-primary mt-0.5 truncate max-w-xs">{t.findings}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{t.orderedBy}</TableCell>
                    <TableCell className="hidden lg:table-cell"><Badge variant="outline" className="text-[10px]">{t.category}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{(t.price || 0).toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Select value={t.status} onValueChange={async (v) => {
                        try {
                          const res = await fetch("/api/lab-tests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, status: v, reportReady: v === "Approved" }) });
                          if (!res.ok) throw new Error("Failed");
                          updateLabTest(t.id, { status: v as LabTest["status"], reportReady: v === "Approved" });
                        } catch { toast({ title: "Could not update status", variant: "destructive" }); }
                      }}>
                        <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Ordered", "Sample Collected", "Testing", "Quality Check", "Approved", "Rejected", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const inv = invoices.find((i) => i.patientId === t.patientId && i.items?.some((it) => it.category === "Lab" && it.description === t.test));
                        if (!inv) {
                          return (t.price || 0) > 0
                            ? <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-warning/50 text-warning hover:bg-warning/10" onClick={() => billTest(t)} title={`Create ₹${t.price.toLocaleString("en-IN")} bill and collect`}><Wallet className="h-3 w-3" /> Bill ₹{t.price.toLocaleString("en-IN")}</Button>
                            : <span className="text-[11px] text-muted-foreground" title="No price set — use Edit to set the price, then bill it">No bill</span>;
                        }
                        const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                        if (outstanding <= 0) return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Paid ₹{(inv.paidAmount || 0).toLocaleString("en-IN")}</Badge>;
                        return (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">Due ₹{outstanding.toLocaleString("en-IN")}</Badge>
                            {canCollectPayment(currentUser.role) && <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => setCollectInvoice(inv)} title={`Collect ₹${outstanding.toLocaleString("en-IN")} (${inv.invoiceNo})`}><TrendingUp className="h-3.5 w-3.5" /></Button>}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openLabPreview(t)} title="View report (no download needed)"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!printLabReport(t, patients.find((p) => p.id === t.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); }} title="Download / Print Report"><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-info" onClick={() => setUpdateLeadPatientId(t.patientId)} title="Update Lead"><Activity className="h-3.5 w-3.5" /></Button>
                        {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditLabTest(t)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                        {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: t.id, name: t.patientName })} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pb-3">
            <DataPagination page={labPage} totalPages={labPages} pageSize={labPageSize} total={labTotal} onPage={setLabPage} onPageSize={setLabPageSize} />
          </div>
        </CardContent>
      </Card>
      <NewTestOrderDialog open={newTestOrderOpen} onOpenChange={setNewTestOrderOpen} />
      <EditLabTestDialog open={!!editLabTest} onOpenChange={(v) => { if (!v) setEditLabTest(null); }} test={editLabTest} />
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Money" />
      <UpdateLeadDialog open={!!updateLeadPatientId} onOpenChange={(v) => { if (!v) setUpdateLeadPatientId(null); }} patientId={updateLeadPatientId} />
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Lab Test</DialogTitle><DialogDescription>Are you sure you want to delete the test for <strong>{deleteTarget.name}</strong>?</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Radiology Module =====
const radiologyModalityIcons: Record<string, { icon: typeof ImageIcon; color: string }> = {
  "X-Ray": { icon: ImageIcon, color: "primary" },
  "CT Scan": { icon: ScanLine, color: "info" },
  "MRI": { icon: ScanLine, color: "warning" },
  "Ultrasound": { icon: ImageIcon, color: "success" },
  "ECG": { icon: Activity, color: "destructive" },
};

export function RadiologyModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const updateRadiologyOrder = useAppStore((s) => s.updateRadiologyOrder);
  const deleteRadiologyOrder = useAppStore((s) => s.deleteRadiologyOrder);
  const { radiologyOrders, invoices, patients, branch } = useBranchData();
  const settings = useAppStore((s) => s.settings);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const addRadiologyOrder = useAppStore((s) => s.addRadiologyOrder);
  const radIO: EntityIOConfig<RadiologyOrder> = {
    entity: "radiology orders",
    filename: "radiology-orders",
    columns: [
      { header: "patientName", sample: "Ravi Kumar" },
      { header: "patientId", sample: "" },
      { header: "modality", sample: "X-Ray" },
      { header: "region", sample: "Chest" },
      { header: "orderedBy", sample: "Dr. Smith" },
      { header: "orderedOn", sample: new Date().toISOString().split("T")[0] },
      { header: "status", sample: "Ordered" },
      { header: "price", sample: "800" },
    ],
    toRow: (r) => [r.patientName, r.patientId, r.modality, r.region, r.orderedBy, r.orderedOn, r.status, r.price],
    fromRow: (row, i) => {
      if (!row.patientName || !row.region) throw new Error("patientName and region are required.");
      return {
        id: `ro${Date.now()}${i}`,
        orderId: `RO-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`,
        patientName: row.patientName,
        patientId: row.patientId || "",
        modality: row.modality || "X-Ray",
        region: row.region,
        orderedBy: row.orderedBy || "",
        orderedOn: row.orderedOn || new Date().toISOString().split("T")[0],
        status: "Ordered",
        price: parseFloat(row.price) || 0,
        branch,
      };
    },
    endpoint: "/api/radiology-orders",
    onImported: (saved) => addRadiologyOrder(saved),
  };
  const {
    pageItems: pagedRadOrders, page: radPage, setPage: setRadPage,
    pageSize: radPageSize, setPageSize: setRadPageSize, totalPages: radPages, total: radTotal,
  } = usePagination(radiologyOrders, "");
  const [newRadiologyOrderOpen, setnewRadiologyOrderOpen] = useState(false);
  const [editRadiology, setEditRadiology] = useState<RadiologyOrder | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [updateLeadPatientId, setUpdateLeadPatientId] = useState<string | null>(null);
  const showAdd = canManageRadiology(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "radiology");
  const showDelete = canDeleteModule(currentUser.role, "radiology");
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);
  const openRadPreview = (r: RadiologyOrder) => {
    setViewDoc(buildRadiologyReportHtml(r, patients.find((p) => p.id === r.patientId), settings));
    viewDownloadRef.current = () => { if (!printRadiologyReport(r, patients.find((p) => p.id === r.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); };
  };

  const radiologyRevenue = radiologyOrders.reduce((s, r) => s + r.price, 0);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/radiology-orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
      deleteRadiologyOrder(deleteTarget.id);
      toast({ title: "Deleted", description: `Order for ${deleteTarget.name} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  // Create a pending bill for an order that has no invoice yet, then open collection.
  const billOrder = async (r: RadiologyOrder) => {
    if ((r.price || 0) <= 0) {
      toast({ title: "No price set", description: "Set the order price via Edit first, then create the bill.", variant: "destructive" });
      return;
    }
    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `inv${Date.now()}`,
          patientId: r.patientId,
          patientName: r.patientName,
          date: today,
          dueDate: today,
          items: [{ description: `${r.modality} - ${r.region}`, category: "Radiology", quantity: 1, rate: r.price, amount: r.price }],
          subtotal: r.price,
          tax: 0,
          discount: 0,
          total: r.price,
          paidAmount: 0,
          status: "Pending",
          branch: r.branch,
        }),
      });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to create bill."); }
      const saved = await res.json();
      addInvoice(saved);
      toast({ title: "Bill Created", description: `₹${r.price.toLocaleString("en-IN")} pending bill ${saved.invoiceNo} created for ${r.patientName}.` });
      setCollectInvoice(saved);
    } catch (e: any) {
      toast({ title: "Could not create bill", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Radiology"
        description="Radiology orders, image capture, report generation, and approvals"
        icon={ScanLine}
        action={showAdd ? <div className="flex items-center gap-1.5"><ImportExportButtons config={radIO} items={radiologyOrders} compact /><Button size="sm" className="gap-2" onClick={() => setnewRadiologyOrderOpen(true)}><Plus className="h-3.5 w-3.5" /> New Radiology Order</Button></div> : undefined}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Radiology Today" value={radiologyOrders.length.toString()} icon={ScanLine} color="primary" />
        <StatCard title="In Progress" value={radiologyOrders.filter(r => r.status === "In Progress" || r.status === "Image Captured").length.toString()} icon={Clock} color="warning" />
        <StatCard title="Reports Ready" value={radiologyOrders.filter(r => r.status === "Approved" || r.status === "Report Generated").length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Revenue" value={`₹${radiologyRevenue.toLocaleString("en-IN")}`} icon={TrendingUp} color="success" />
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.entries(radiologyOrders.reduce<Record<string, number>>((acc, order) => {
          acc[order.modality] = (acc[order.modality] || 0) + 1;
          return acc;
        }, {})).map(([name, count]) => {
          const meta = radiologyModalityIcons[name] ?? { icon: ScanLine, color: "primary" };
          const Icon = meta.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            warning: "bg-warning/10 text-warning",
            success: "bg-success/10 text-success",
            destructive: "bg-destructive/10 text-destructive",
          };
          return (
            <Card key={name} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[meta.color as keyof typeof colorMap]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold mt-3">{name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{count} order{count === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
          );
        })}
        {radiologyOrders.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">No radiology orders yet. Create one to see modality breakdown.</CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base">Radiology Orders ({radTotal})</CardTitle>
          {showAdd && <ImportExportButtons config={radIO} items={radiologyOrders} compact />}
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Order ID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead>Modality</TableHead>
                  <TableHead className="hidden md:table-cell">Region</TableHead>
                  <TableHead className="hidden lg:table-cell">Ordered By</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead className="w-[140px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRadOrders.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{r.orderId}</TableCell>
                    <TableCell className="text-sm font-medium">{r.patientName}</TableCell>
                    <TableCell>
                      <div>
                        <Badge variant="outline" className="text-[10px]">{r.modality}</Badge>
                        {r.findings && <p className="text-xs text-primary mt-0.5 truncate max-w-xs">{r.findings}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{r.region}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{r.orderedBy}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{r.price.toLocaleString("en-IN")}</TableCell>
                    <TableCell>
                      <Select value={r.status} onValueChange={async (v) => {
                        try {
                          const res = await fetch("/api/radiology-orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: v }) });
                          if (!res.ok) throw new Error("Failed");
                          updateRadiologyOrder(r.id, { status: v as RadiologyOrder["status"] });
                        } catch { toast({ title: "Could not update status", variant: "destructive" }); }
                      }}>
                        <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["Ordered", "In Progress", "Image Captured", "Report Generated", "Approved", "Follow Up"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const inv = invoices.find((i) => i.patientId === r.patientId && i.items?.some((it) => it.category === "Radiology" && it.description === `${r.modality} - ${r.region}`));
                        if (!inv) {
                          return (r.price || 0) > 0
                            ? <Button size="sm" variant="outline" className="h-7 text-[11px] gap-1 border-warning/50 text-warning hover:bg-warning/10" onClick={() => billOrder(r)} title={`Create ₹${r.price.toLocaleString("en-IN")} bill and collect`}><Wallet className="h-3 w-3" /> Bill ₹{r.price.toLocaleString("en-IN")}</Button>
                            : <span className="text-[11px] text-muted-foreground" title="No price set — use Edit to set the price, then bill it">No bill</span>;
                        }
                        const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                        if (outstanding <= 0) return <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Paid ₹{(inv.paidAmount || 0).toLocaleString("en-IN")}</Badge>;
                        return (
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className="text-[10px] border-warning/50 text-warning">Due ₹{outstanding.toLocaleString("en-IN")}</Badge>
                            {canCollectPayment(currentUser.role) && <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => setCollectInvoice(inv)} title={`Collect ₹${outstanding.toLocaleString("en-IN")} (${inv.invoiceNo})`}><TrendingUp className="h-3.5 w-3.5" /></Button>}
                          </div>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openRadPreview(r)} title="View report (no download needed)"><Eye className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (!printRadiologyReport(r, patients.find((p) => p.id === r.patientId), settings)) toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the report.", variant: "destructive" }); }} title="Download / Print Report"><Download className="h-3.5 w-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-info" onClick={() => setUpdateLeadPatientId(r.patientId)} title="Update Lead"><Activity className="h-3.5 w-3.5" /></Button>
                        {showEdit && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRadiology(r)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                        {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: r.id, name: r.patientName })} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pb-3">
            <DataPagination page={radPage} totalPages={radPages} pageSize={radPageSize} total={radTotal} onPage={setRadPage} onPageSize={setRadPageSize} />
          </div>
        </CardContent>
      </Card>
      <NewRadiologyOrderDialog open={newRadiologyOrderOpen} onOpenChange={setnewRadiologyOrderOpen} />
      <EditRadiologyDialog open={!!editRadiology} onOpenChange={(v) => { if (!v) setEditRadiology(null); }} order={editRadiology} />
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Money" />
      <UpdateLeadDialog open={!!updateLeadPatientId} onOpenChange={(v) => { if (!v) setUpdateLeadPatientId(null); }} patientId={updateLeadPatientId} />
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Radiology Order</DialogTitle><DialogDescription>Are you sure you want to delete the order for <strong>{deleteTarget.name}</strong>?</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDelete}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
