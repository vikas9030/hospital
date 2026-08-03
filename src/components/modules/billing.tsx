"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { invoices } from "@/lib/data";
import {
  Receipt, Plus, Download, DollarSign, TrendingUp, CreditCard,
  Wallet, Building2, Search, FileText, Percent, ArrowUpDown,
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
import { useState } from "react";

const paymentMethodData = [
  { method: "UPI", amount: 1840000, color: "oklch(0.55 0.22 259)" },
  { method: "Card", amount: 1240000, color: "oklch(0.62 0.19 155)" },
  { method: "Cash", amount: 920000, color: "oklch(0.72 0.18 70)" },
  { method: "Insurance", amount: 680000, color: "oklch(0.6 0.13 230)" },
  { method: "Net Banking", amount: 140000, color: "oklch(0.58 0.24 27)" },
];

export function BillingModule() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const filtered = invoices.filter((inv) => {
    const matchSearch = inv.invoiceNo.toLowerCase().includes(search.toLowerCase()) || inv.patientName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || inv.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const totalRevenue = invoices.reduce((s, i) => s + i.paidAmount, 0);
  const pendingAmount = invoices.filter(i => i.status !== "Paid").reduce((s, i) => s + (i.total - i.paidAmount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Billing & Payments"
        description="Consolidated invoicing across all hospital departments"
        icon={Receipt}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> Create Invoice
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Revenue" value={`₹${(totalRevenue / 100000).toFixed(2)}L`} icon={DollarSign} color="success" trend={18} trendLabel="this month" />
        <StatCard title="Pending Amount" value={`₹${(pendingAmount / 1000).toFixed(0)}K`} icon={Wallet} color="destructive" subtitle="To be collected" />
        <StatCard title="Invoices Today" value="48" icon={FileText} color="primary" />
        <StatCard title="Avg Invoice Value" value="₹6,240" icon={TrendingUp} color="info" trend={5} trendLabel="vs last week" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Payment Methods Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={paymentMethodData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="method" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="amount" radius={[6, 6, 0, 0]} name="Amount">
                  {paymentMethodData.map((d, i) => (
                    <Cell key={i} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment Methods Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payment Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {paymentMethodData.map((p) => {
              const total = paymentMethodData.reduce((s, p) => s + p.amount, 0);
              const pct = Math.round((p.amount / total) * 100);
              return (
                <div key={p.method} className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: `${p.color}20`, color: p.color }}>
                    {p.method === "UPI" && <Wallet className="h-4 w-4" />}
                    {p.method === "Card" && <CreditCard className="h-4 w-4" />}
                    {p.method === "Cash" && <DollarSign className="h-4 w-4" />}
                    {p.method === "Insurance" && <Building2 className="h-4 w-4" />}
                    {p.method === "Net Banking" && <Building2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between">
                      <span className="text-xs font-medium">{p.method}</span>
                      <span className="text-xs font-semibold">₹{(p.amount / 100000).toFixed(1)}L</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
              {["All", "Paid", "Partial", "Pending", "Overdue"].map((s) => (
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

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Paid</TableHead>
                  <TableHead className="hidden lg:table-cell">Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
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
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{inv.date}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{inv.items.length} items</TableCell>
                    <TableCell className="text-right font-medium">₹{inv.total.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-success">₹{inv.paidAmount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {inv.paymentMethod && <Badge variant="outline" className="text-[10px]">{inv.paymentMethod}</Badge>}
                    </TableCell>
                    <TableCell><StatusBadge status={inv.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Consolidated Billing Demo */}
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
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/50 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Invoice INV-2026-0156</p>
                <p className="text-xs text-muted-foreground">Aarav Sharma • August 3, 2026</p>
              </div>
              <StatusBadge status="Paid" />
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
                {invoices[0].items.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{item.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                    <TableCell className="text-right text-sm">₹{item.rate.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{item.amount.toLocaleString("en-IN")}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 font-semibold">
                  <TableCell colSpan={4} className="text-right text-sm">Subtotal</TableCell>
                  <TableCell className="text-right">₹{invoices[0].subtotal.toLocaleString("en-IN")}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right text-sm text-muted-foreground flex items-center justify-end gap-1">
                    <Percent className="h-3 w-3" /> Tax (5%)
                  </TableCell>
                  <TableCell className="text-right text-sm">₹{invoices[0].tax.toLocaleString("en-IN")}</TableCell>
                </TableRow>
                <TableRow className="bg-success/5 font-bold">
                  <TableCell colSpan={4} className="text-right">Total Paid</TableCell>
                  <TableCell className="text-right text-success">₹{invoices[0].total.toLocaleString("en-IN")}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
