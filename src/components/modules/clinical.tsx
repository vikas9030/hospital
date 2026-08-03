"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { medicines, labTests, radiologyOrders } from "@/lib/data";
import {
  Pill, Plus, Search, Package, AlertTriangle, TrendingUp,
  FlaskConical, Microscope, CheckCircle2, Clock, ScanLine,
  FileText, Download, Activity, Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";

// ===== Pharmacy Module =====
export function PharmacyModule() {
  const [search, setSearch] = useState("");
  const filtered = medicines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pharmacy"
        description="Medicine inventory, prescriptions, sales, and supplier management"
        icon={Pill}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2"><Package className="h-3.5 w-3.5" /> Purchase Order</Button>
            <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add Medicine</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Medicines" value={medicines.length.toString()} icon={Pill} color="primary" />
        <StatCard title="Today's Sales" value="₹38K" icon={TrendingUp} color="success" trend={15} trendLabel="vs yesterday" />
        <StatCard title="Low Stock" value={medicines.filter(m => m.status === "Low Stock").length.toString()} icon={AlertTriangle} color="warning" />
        <StatCard title="Expiring Soon" value={medicines.filter(m => m.status === "Expiring Soon").length.toString()} icon={Clock} color="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search medicines..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Export</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
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
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{m.expiryDate}</TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{m.stock}</span>
                          <span className="text-muted-foreground">/ {m.reorderLevel}</span>
                        </div>
                        <Progress
                          value={(m.stock / (m.reorderLevel * 3)) * 100}
                          className="h-1.5"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{m.price}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Laboratory Module =====
const labStatusFlow = ["Ordered", "Sample Collected", "Testing", "Quality Check", "Approved"];

export function LaboratoryModule() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory"
        description="Test orders, sample collection, results, and approvals"
        icon={FlaskConical}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Test Order</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Tests Today" value={labTests.length.toString()} icon={FlaskConical} color="primary" />
        <StatCard title="Pending" value={labTests.filter(t => !t.reportReady).length.toString()} icon={Clock} color="warning" />
        <StatCard title="Ready" value={labTests.filter(t => t.reportReady).length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Revenue" value="₹12.4K" icon={TrendingUp} color="success" />
      </div>

      {/* Lab Workflow */}
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
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Test Orders</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {labTests.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{t.orderId}</TableCell>
                    <TableCell className="text-sm font-medium">{t.patientName}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{t.test}</p>
                        {t.result && <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{t.result}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{t.orderedBy}</TableCell>
                    <TableCell className="hidden lg:table-cell"><Badge variant="outline" className="text-[10px]">{t.category}</Badge></TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{t.price}</TableCell>
                    <TableCell><StatusBadge status={t.status} /></TableCell>
                    <TableCell>
                      {t.reportReady && (
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Radiology Module =====
const radiologyModalities = [
  { name: "X-Ray", icon: ImageIcon, color: "primary", count: 4 },
  { name: "CT Scan", icon: ScanLine, color: "info", count: 2 },
  { name: "MRI", icon: ScanLine, color: "warning", count: 1 },
  { name: "Ultrasound", icon: ImageIcon, color: "success", count: 3 },
  { name: "ECG", icon: Activity, color: "destructive", count: 5 },
];

export function RadiologyModule() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Radiology"
        description="Imaging orders, image capture, report generation, and approvals"
        icon={ScanLine}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Imaging Order</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Imaging Today" value={radiologyOrders.length.toString()} icon={ScanLine} color="primary" />
        <StatCard title="In Progress" value={radiologyOrders.filter(r => r.status === "In Progress" || r.status === "Image Captured").length.toString()} icon={Clock} color="warning" />
        <StatCard title="Reports Ready" value={radiologyOrders.filter(r => r.status === "Approved" || r.status === "Report Generated").length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Revenue" value="₹18.6K" icon={TrendingUp} color="success" />
      </div>

      {/* Modality Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {radiologyModalities.map((m, i) => {
          const Icon = m.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            warning: "bg-warning/10 text-warning",
            success: "bg-success/10 text-success",
            destructive: "bg-destructive/10 text-destructive",
          };
          return (
            <Card key={m.name} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[m.color as keyof typeof colorMap]}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-sm font-semibold mt-3">{m.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{m.count} today</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Imaging Orders</CardTitle>
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
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {radiologyOrders.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{r.orderId}</TableCell>
                    <TableCell className="text-sm font-medium">{r.patientName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{r.modality}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{r.region}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{r.orderedBy}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{r.price.toLocaleString("en-IN")}</TableCell>
                    <TableCell><StatusBadge status={r.status} /></TableCell>
                    <TableCell>
                      {(r.status === "Approved" || r.status === "Report Generated") && (
                        <Button variant="ghost" size="icon" className="h-7 w-7">
                          <FileText className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
