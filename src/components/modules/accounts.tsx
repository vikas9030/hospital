"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import {
  Wallet, TrendingUp, TrendingDown, HandCoins, Receipt, Plus,
  Search, Download, Pencil, Trash2, CalendarDays, AlertTriangle,
} from "lucide-react";
import { canManageAccounts, isAdmin } from "@/lib/utils";
import type { Expense, Invoice } from "@/lib/types";

type Tab = "overview" | "dues" | "expenses" | "daybook";

const EXPENSE_CATEGORIES: Expense["category"][] = [
  "Salaries", "Medicines", "Supplies", "Utilities", "Rent",
  "Maintenance", "Food", "Transport", "Marketing", "Other",
];
const PAY_METHODS = ["Cash", "UPI", "Card", "Net Banking", "Cheque"];

const paidDateOf = (inv: Invoice): string =>
  inv.paidDate || ((inv.status === "Paid" || inv.status === "Partial") ? inv.date || "" : "");
const dueOf = (inv: Invoice): number => Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));

export function AccountsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const { invoices, patients, branch } = useBranchData();
  const { toast } = useToast();

  const admin = isAdmin(currentUser.role);
  const canWrite = canManageAccounts(currentUser.role);

  const [tab, setTab] = useState<Tab>("overview");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [expensesOn, setExpensesOn] = useState(false);
  const [search, setSearch] = useState("");
  const [expMonth, setExpMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [expCat, setExpCat] = useState("All");
  const [dayDate, setDayDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [collectTarget, setCollectTarget] = useState<Invoice | null>(null);
  const [expDialog, setExpDialog] = useState<null | { mode: "add" } | { mode: "edit"; exp: Expense }>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/expenses?branch=${encodeURIComponent(branch || "")}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setExpenses(data);
          setExpensesOn(true);
        }
      } catch {
        if (live) setExpensesOn(false);
      }
    })();
    return () => { live = false; };
  }, [branch]);

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const monthStr = todayStr.slice(0, 7);

  const audit = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "accounts", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "accounts", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };

  // ---- headline numbers ----
  const collectedToday = invoices.filter((i) => paidDateOf(i) === todayStr).reduce((s, i) => s + (i.paidAmount || 0), 0);
  const collectedMonth = invoices.filter((i) => paidDateOf(i).startsWith(monthStr)).reduce((s, i) => s + (i.paidAmount || 0), 0);
  const expensesMonth = expenses.filter((e) => (e.date || "").startsWith(monthStr)).reduce((s, e) => s + (e.amount || 0), 0);
  const duesTotal = invoices.filter((i) => i.status !== "Paid").reduce((s, i) => s + dueOf(i), 0);
  const duesList = useMemo(
    () => invoices.filter((i) => i.status !== "Paid" && dueOf(i) > 0).sort((a, b) => (a.dueDate || a.date || "").localeCompare(b.dueDate || b.date || "")),
    [invoices]
  );
  const overdueList = useMemo(
    () => duesList.filter((i) => (i.dueDate || "") && (i.dueDate || "") < todayStr),
    [duesList, todayStr]
  );

  const filteredDues = duesList.filter((i) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${i.patientName} ${i.invoiceNo}`.toLowerCase().includes(q);
  });

  const expFiltered = useMemo(() => expenses.filter((e) => {
    if (expMonth && !(e.date || "").startsWith(expMonth)) return false;
    if (expCat !== "All" && e.category !== expCat) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${e.title} ${e.vendor ?? ""} ${e.notes ?? ""}`.toLowerCase().includes(q);
  }), [expenses, expMonth, expCat, search]);
  const expTotal = expFiltered.reduce((s, e) => s + (e.amount || 0), 0);
  const expByCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of expFiltered) map.set(e.category, (map.get(e.category) ?? 0) + (e.amount || 0));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [expFiltered]);

  // ---- day book ----
  const dayIn = invoices.filter((i) => paidDateOf(i) === dayDate && (i.paidAmount || 0) > 0);
  const dayOut = expenses.filter((e) => e.date === dayDate);
  const dayInTotal = dayIn.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const dayOutTotal = dayOut.reduce((s, e) => s + (e.amount || 0), 0);

  const downloadCsv = (name: string, rows: string[][]) => {
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "dues", label: `Dues (${duesList.length})` },
    { id: "expenses", label: "Expenses" },
    { id: "daybook", label: "Day Book" },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Accounts"
        description={admin ? "Collections, dues, expenses and the day book — every rupee in and out." : "Collections, pending dues, expenses and the day book."}
        icon={Wallet}
        action={canWrite && tab === "expenses" ? <Button size="sm" className="gap-1.5 text-xs sm:text-sm" onClick={() => setExpDialog({ mode: "add" })}><Plus className="h-3.5 w-3.5" /> Add Expense</Button> : undefined}
      />

      {!expensesOn && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs">Expenses table is not reachable — run <span className="font-mono">supabase/migrations/017_expenses.sql</span> in Supabase for permanent expense storage. Collections and dues work regardless.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Collected Today" value={`₹${collectedToday.toLocaleString("en-IN")}`} icon={HandCoins} color="success" />
        <StatCard title="Collected (Month)" value={`₹${collectedMonth.toLocaleString("en-IN")}`} icon={TrendingUp} color="primary" />
        <StatCard title="Expenses (Month)" value={`₹${expensesMonth.toLocaleString("en-IN")}`} icon={TrendingDown} color="warning" />
        <StatCard title="Dues Pending" value={`₹${duesTotal.toLocaleString("en-IN")}`} icon={Receipt} color="destructive" subtitle={`${duesList.length} bills • ${overdueList.length} overdue`} />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} className="text-xs" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recent Collections</CardTitle><CardDescription className="text-xs">Latest money received</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {invoices.filter((i) => (i.paidAmount || 0) > 0).sort((a, b) => paidDateOf(b).localeCompare(paidDateOf(a))).slice(0, 6).map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{i.patientName} <span className="font-normal text-muted-foreground">• {i.invoiceNo}</span></p>
                    <p className="text-[11px] text-muted-foreground">{paidDateOf(i) || "—"} • {i.paymentMethod || "Cash"}</p>
                  </div>
                  <p className="text-xs font-bold text-success shrink-0">+₹{(i.paidAmount || 0).toLocaleString("en-IN")}</p>
                </div>
              ))}
              {invoices.filter((i) => (i.paidAmount || 0) > 0).length === 0 && <p className="text-xs text-muted-foreground">No collections yet.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Top Dues & Spend</CardTitle><CardDescription className="text-xs">Who owes, where money went</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {duesList.slice(0, 3).map((i) => (
                <div key={i.id} className="flex items-center gap-2 rounded-lg border border-destructive/20 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{i.patientName} <span className="font-normal text-muted-foreground">• {i.invoiceNo}</span></p>
                    <p className="text-[11px] text-muted-foreground">Due {i.dueDate || i.date || "—"}</p>
                  </div>
                  <p className="text-xs font-bold text-destructive shrink-0">₹{dueOf(i).toLocaleString("en-IN")}</p>
                  {canWrite && <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" onClick={() => setCollectTarget(i)}>Collect</Button>}
                </div>
              ))}
              {expByCat.slice(0, 3).map(([c, amt]) => (
                <div key={c} className="flex items-center gap-2 rounded-lg border p-2.5">
                  <p className="text-xs font-semibold flex-1">{c}</p>
                  <p className="text-xs font-bold shrink-0">₹{amt.toLocaleString("en-IN")}</p>
                </div>
              ))}
              {duesList.length === 0 && expByCat.length === 0 && <p className="text-xs text-muted-foreground">Nothing pending, no expenses this month.</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "dues" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="relative max-w-sm mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search patient or invoice…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            {filteredDues.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No pending dues. Everything is collected.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filteredDues.map((i) => {
                  const overdue = (i.dueDate || "") && (i.dueDate || "") < todayStr;
                  return (
                    <div key={i.id} className={`rounded-lg border p-3 space-y-1.5 ${overdue ? "border-destructive/40 bg-destructive/[0.03]" : ""}`}>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate flex-1">{i.patientName}</p>
                        {overdue ? <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30">Overdue</Badge> : <Badge variant="outline" className="text-[10px] text-warning border-warning/30">{i.status}</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{i.invoiceNo} • Due {i.dueDate || i.date || "—"}</p>
                      <p className="text-xs">Bill ₹{(i.total || 0).toLocaleString("en-IN")} • Paid ₹{(i.paidAmount || 0).toLocaleString("en-IN")} • <strong className="text-destructive">Due ₹{dueOf(i).toLocaleString("en-IN")}</strong></p>
                      {canWrite && <Button size="sm" className="h-7 text-[11px] w-full" onClick={() => setCollectTarget(i)}>Collect Payment</Button>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "expenses" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="relative flex-1 min-w-[160px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search title, vendor, notes…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Input type="month" className="h-9 text-xs w-[150px]" value={expMonth} onChange={(e) => setExpMonth(e.target.value)} />
              <Select value={expCat} onValueChange={setExpCat}>
                <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Badge variant="outline" className="text-[11px] h-9 items-center flex">Total ₹{expTotal.toLocaleString("en-IN")}</Badge>
              <Button
                size="sm" variant="ghost" className="h-9 text-[11px]"
                onClick={() => downloadCsv(`expenses-${expMonth || "all"}.csv`, [
                  ["Date", "Title", "Category", "Vendor", "Method", "Amount", "Recorded By", "Notes"],
                  ...expFiltered.map((e) => [e.date, e.title, e.category, e.vendor ?? "", e.paymentMethod, String(e.amount || 0), e.recordedBy || "", (e.notes ?? "").replace(/\s+/g, " ")]),
                ])}
                disabled={expFiltered.length === 0}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export
              </Button>
            </div>
            {expFiltered.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No expenses for this filter. {canWrite && "Add the first one above."}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {expFiltered.map((e) => (
                  <div key={e.id} className="rounded-lg border p-3 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate flex-1">{e.title}</p>
                      <Badge variant="outline" className="text-[10px] shrink-0">{e.category}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{e.date} • {e.vendor || "—"} • {e.paymentMethod} • by {e.recordedBy || "—"}</p>
                    {e.notes && <p className="text-[11px] text-muted-foreground truncate">{e.notes}</p>}
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold flex-1">₹{(e.amount || 0).toLocaleString("en-IN")}</p>
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setExpDialog({ mode: "edit", exp: e })} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                          {admin && <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => setDeleteTarget(e)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "daybook" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <Input type="date" className="h-9 text-xs w-[160px]" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
              <Button size="sm" variant="outline" className="h-9 text-[11px]" onClick={() => setDayDate(todayStr)}>Today</Button>
              <Badge variant="outline" className="text-[11px]">In ₹{dayInTotal.toLocaleString("en-IN")}</Badge>
              <Badge variant="outline" className="text-[11px]">Out ₹{dayOutTotal.toLocaleString("en-IN")}</Badge>
              <Badge className={`text-[11px] ${dayInTotal - dayOutTotal >= 0 ? "bg-success/15 text-success border-success/30" : "bg-destructive/10 text-destructive border-destructive/30"}`}>
                Net {dayInTotal - dayOutTotal >= 0 ? "+" : "−"}₹{Math.abs(dayInTotal - dayOutTotal).toLocaleString("en-IN")}
              </Badge>
              <Button
                size="sm" variant="ghost" className="h-8 text-[11px] ml-auto"
                onClick={() => downloadCsv(`daybook-${dayDate}.csv`, [
                  ["Type", "Particulars", "Method", "Amount", "By"],
                  ...dayIn.map((i) => ["IN", `${i.invoiceNo} — ${i.patientName}`, i.paymentMethod || "", String(i.paidAmount || 0), "Collection"]),
                  ...dayOut.map((e) => ["OUT", `${e.title}${e.vendor ? ` — ${e.vendor}` : ""}`, e.paymentMethod, String(e.amount || 0), e.recordedBy || ""]),
                ])}
              >
                <Download className="h-3.5 w-3.5 mr-1" /> Export day
              </Button>
            </div>
            <div className="space-y-1.5">
              {dayIn.map((i) => (
                <div key={`in-${i.id}`} className="flex items-center gap-3 rounded-lg border border-success/20 bg-success/[0.03] p-2.5">
                  <p className="text-xs flex-1 min-w-0 truncate"><strong className="text-success">+₹{(i.paidAmount || 0).toLocaleString("en-IN")}</strong> — {i.invoiceNo} • {i.patientName} <span className="text-muted-foreground">({i.paymentMethod || "Cash"})</span></p>
                </div>
              ))}
              {dayOut.map((e) => (
                <div key={`out-${e.id}`} className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.03] p-2.5">
                  <p className="text-xs flex-1 min-w-0 truncate"><strong className="text-destructive">−₹{(e.amount || 0).toLocaleString("en-IN")}</strong> — {e.title} <span className="text-muted-foreground">({e.category}{e.vendor ? ` • ${e.vendor}` : ""})</span></p>
                </div>
              ))}
              {dayIn.length === 0 && dayOut.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No money movement on this date.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <CollectMoneyDialog
        invoice={collectTarget}
        onOpenChange={(v) => { if (!v) setCollectTarget(null); }}
        onCollected={(saved) => {
          updateInvoice(saved.id, saved);
          audit("ACCOUNTS_COLLECT", `${currentUser.name} collected for ${saved.patientName} (${saved.invoiceNo}).`);
        }}
      />

      <ExpenseDialog
        open={!!expDialog}
        initial={expDialog?.mode === "edit" ? expDialog.exp : null}
        branch={branch}
        backendOn={expensesOn}
        onClose={() => setExpDialog(null)}
        onSaved={(saved, isEdit) => {
          setExpenses((rows) => (isEdit ? rows.map((r) => (r.id === saved.id ? saved : r)) : [saved, ...rows]));
          audit(isEdit ? "ACCOUNTS_EXPENSE_EDIT" : "ACCOUNTS_EXPENSE_ADD", `${currentUser.name} ${isEdit ? "updated" : "added"} expense "${saved.title}" ₹${(saved.amount || 0).toLocaleString("en-IN")} (${saved.category}).`);
          toast({ title: isEdit ? "Expense updated" : "Expense added", description: `${saved.title} — ₹${(saved.amount || 0).toLocaleString("en-IN")}.` });
          setExpDialog(null);
        }}
      />

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete expense?</DialogTitle><DialogDescription>Remove “{deleteTarget.title}” (₹{(deleteTarget.amount || 0).toLocaleString("en-IN")}) permanently from the day book.</DialogDescription></DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/expenses", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
                    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed.");
                    setExpenses((rows) => rows.filter((r) => r.id !== deleteTarget.id));
                    audit("ACCOUNTS_EXPENSE_DELETE", `${currentUser.name} deleted expense "${deleteTarget.title}".`);
                    toast({ title: "Expense deleted" });
                    setDeleteTarget(null);
                  } catch (e: any) {
                    toast({ title: "Could not delete", description: e.message, variant: "destructive" });
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function ExpenseDialog({ open, initial, branch, backendOn, onClose, onSaved }: {
  open: boolean;
  initial: Expense | null;
  branch: string;
  backendOn: boolean;
  onClose: () => void;
  onSaved: (saved: Expense, isEdit: boolean) => void;
}) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState<Expense["category"]>(initial?.category ?? "Other");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState(initial?.paymentMethod ?? "Cash");
  const [vendor, setVendor] = useState(initial?.vendor ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Title required", description: "Name the expense (e.g. Staff salaries — August).", variant: "destructive" });
      return;
    }
    const amt = Math.max(0, parseFloat(amount) || 0);
    if (amt <= 0) {
      toast({ title: "Invalid amount", description: "Enter an amount above zero.", variant: "destructive" });
      return;
    }
    if (!backendOn) {
      toast({ title: "Expenses table offline", description: "Run migration 017_expenses.sql first — expenses need the database table.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        const res = await fetch("/api/expenses", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: initial.id, title: title.trim(), category, amount: amt, date, paymentMethod: method, vendor: vendor.trim(), notes: notes.trim() }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed.");
        onSaved(await res.json(), true);
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `exp${Date.now()}`, title: title.trim(), category, amount: amt, date,
            paymentMethod: method, vendor: vendor.trim(), notes: notes.trim(),
            recordedBy: currentUser.name, branch,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
        onSaved(await res.json(), false);
      }
    } catch (e: any) {
      toast({ title: "Could not save expense", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>Money going out — salaries, stock, utilities, rent. Appears in the day book instantly.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1"><Label className="text-xs">Title *</Label><Input className="h-9" placeholder="e.g. Staff salaries — August" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Expense["category"])}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Amount ₹ *</Label><Input className="h-9" type="number" min={0} placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Date</Label><Input className="h-9" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Paid via</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{PAY_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1"><Label className="text-xs">Vendor / Paid to</Label><Input className="h-9" placeholder="e.g. City suppliers" value={vendor} onChange={(e) => setVendor(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea rows={2} placeholder="Bill no, remarks…" value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : initial ? "Save Changes" : "Add Expense"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
