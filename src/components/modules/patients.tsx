"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { patients, patientTimeline } from "@/lib/data";
import { useAppStore } from "@/store/app-store";
import {
  Users, Search, Filter, Plus, QrCode, ArrowLeft, Phone, Mail, MapPin,
  Heart, AlertTriangle, Calendar, FileText, Activity, Pill, Receipt,
  Stethoscope, FlaskConical, ScanLine, CreditCard, RefreshCw, Shield,
  Download, MoreHorizontal, IdCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { motion } from "framer-motion";
import type { TimelineEvent } from "@/lib/types";

const timelineIcons = {
  appointment: Calendar,
  consultation: Stethoscope,
  prescription: Pill,
  lab: FlaskConical,
  radiology: ScanLine,
  billing: Receipt,
  payment: CreditCard,
  followup: RefreshCw,
  admission: Activity,
  discharge: IdCard,
};

const timelineColors = {
  appointment: "bg-primary/10 text-primary",
  consultation: "bg-info/10 text-info",
  prescription: "bg-success/10 text-success",
  lab: "bg-warning/10 text-warning",
  radiology: "bg-info/10 text-info",
  billing: "bg-primary/10 text-primary",
  payment: "bg-success/10 text-success",
  followup: "bg-warning/10 text-warning",
  admission: "bg-destructive/10 text-destructive",
  discharge: "bg-success/10 text-success",
};

export function PatientsModule() {
  const { selectedPatientId, selectPatient } = useAppStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  if (selectedPatient) {
    return <PatientDetail patientId={selectedPatient.id} onBack={() => selectPatient(null)} />;
  }

  const filtered = patients.filter((p) => {
    const matchSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.uhid.toLowerCase().includes(search.toLowerCase()) ||
      p.phone.includes(search);
    const matchStatus = statusFilter === "All" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Patients"
        description="Manage patient records, profiles, and medical history"
        icon={Users}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <QrCode className="h-3.5 w-3.5" /> Scan QR
            </Button>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New Patient
            </Button>
          </>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Patients" value="12,480" icon={Users} color="primary" trend={8} trendLabel="this month" />
        <StatCard title="Admitted" value="48" icon={Activity} color="warning" subtitle="Currently in IPD" />
        <StatCard title="OPD Today" value="186" icon={Stethoscope} color="info" subtitle="Outpatient visits" />
        <StatCard title="New This Week" value="142" icon={Plus} color="success" trend={12} trendLabel="vs last week" />
      </div>

      {/* Filters + Table */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex flex-1 items-center gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, UHID, phone..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <Filter className="h-3.5 w-3.5" /> Filters
              </Button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1">
              {["All", "Active", "Admitted", "OPD", "Discharged"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
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
                  <TableHead className="w-[60px]">UHID</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Blood</TableHead>
                  <TableHead className="hidden lg:table-cell">Insurance</TableHead>
                  <TableHead className="hidden md:table-cell">Last Visit</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => selectPatient(p.id)}
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.uhid}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">{p.photo}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.gender}, {p.age} yrs</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <p className="text-xs">{p.phone}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[160px]">{p.email}</p>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Badge variant="outline" className="font-mono">{p.bloodGroup}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{p.insuranceProvider}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{p.lastVisit}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
            <p>Showing {filtered.length} of {patients.length} patients</p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs">Previous</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-primary text-primary-foreground">1</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">2</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">3</Button>
              <Button variant="outline" size="sm" className="h-7 text-xs">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PatientDetail({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const patient = patients.find((p) => p.id === patientId)!;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" className="gap-2 -ml-2" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> Back to Patients
      </Button>

      {/* Patient Header Card */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-info/15 to-primary/10" />
        <CardContent className="p-6 -mt-12">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold h-full">{patient.photo}</AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold">{patient.name}</h1>
                  <StatusBadge status={patient.status} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">{patient.uhid} • {patient.gender}, {patient.age} years • {patient.bloodGroup}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {patient.phone}</span>
                  <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {patient.email}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {patient.address}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-2">
                <QrCode className="h-3.5 w-3.5" /> QR Code
              </Button>
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="h-3.5 w-3.5" /> Export
              </Button>
              <Button size="sm" className="gap-2">
                <Plus className="h-3.5 w-3.5" /> New Visit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Visits" value="24" icon={Calendar} color="primary" subtitle="All time" />
        <StatCard title="Last Visit" value="Aug 3" icon={Activity} color="info" subtitle="2026" />
        <StatCard title="Total Billed" value="₹1.24L" icon={Receipt} color="success" subtitle="Lifetime" />
        <StatCard title="Outstanding" value="₹0" icon={CreditCard} color="success" subtitle="No dues" />
      </div>

      {/* Tabs: Timeline / Medical Info / Documents / Billing */}
      <Tabs defaultValue="timeline">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="timeline">Patient Timeline</TabsTrigger>
          <TabsTrigger value="medical">Medical Info</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="billing">Billing History</TabsTrigger>
        </TabsList>

        {/* Timeline */}
        <TabsContent value="timeline" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Patient Care Journey
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-border" />
                <div className="space-y-1">
                  {[...patientTimeline].reverse().map((event, idx) => {
                    const Icon = timelineIcons[event.type];
                    return (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="relative flex gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors"
                      >
                        <div className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background ${timelineColors[event.type]}`}>
                          <Icon className="h-4.5 w-4.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-sm font-semibold">{event.title}</p>
                            <StatusBadge status={event.status} />
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {event.timestamp}</span>
                            {event.doctor && <span className="flex items-center gap-1"><Stethoscope className="h-3 w-3" /> {event.doctor}</span>}
                            {event.amount && <span className="flex items-center gap-1 font-medium text-foreground"><Receipt className="h-3 w-3" /> ₹{event.amount.toLocaleString("en-IN")}</span>}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              {/* Workflow indicator */}
              <div className="mt-6 p-4 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground mb-3">CARE WORKFLOW</p>
                <div className="flex items-center gap-1 overflow-x-auto">
                  {["Appointment", "Consultation", "Prescription", "Lab", "Radiology", "Billing", "Payment", "Follow-up"].map((step, i, arr) => (
                    <div key={step} className="flex items-center gap-1 shrink-0">
                      <div className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1">
                        <span className="text-[10px] font-semibold text-primary">{i + 1}</span>
                        <span className="text-[11px] font-medium">{step}</span>
                      </div>
                      {i < arr.length - 1 && <div className="h-px w-3 bg-primary/30" />}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Medical Info */}
        <TabsContent value="medical" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" /> Allergies & Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.allergies.length > 0 ? (
                  patient.allergies.map((a) => (
                    <div key={a} className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/20">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium">{a}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No known allergies</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Heart className="h-4 w-4 text-primary" /> Chronic Conditions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {patient.chronicDiseases.length > 0 ? (
                  patient.chronicDiseases.map((d) => (
                    <div key={d} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                      <Heart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{d}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">No chronic conditions</p>
                )}
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-info" /> Insurance & Emergency</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Provider</span>
                      <span className="font-medium">{patient.insuranceProvider}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Policy Number</span>
                      <span className="font-mono text-xs">{patient.insurancePolicy}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Branch</span>
                      <span className="font-medium">{patient.branch}</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Emergency Contact</span>
                      <span className="font-medium">{patient.emergencyContact}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Registered On</span>
                      <span className="font-medium">{patient.registeredOn}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Address</span>
                      <span className="font-medium text-right text-xs">{patient.address}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Documents */}
        <TabsContent value="documents" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Medical Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { name: "Blood Test Report", date: "Aug 3, 2026", type: "Lab", size: "245 KB" },
                  { name: "Chest X-Ray", date: "Aug 3, 2026", type: "Radiology", size: "1.2 MB" },
                  { name: "Prescription", date: "Aug 3, 2026", type: "Rx", size: "180 KB" },
                  { name: "ECG Report", date: "Aug 3, 2026", type: "Cardiac", size: "420 KB" },
                  { name: "Discharge Summary", date: "Jul 28, 2026", type: "IPD", size: "320 KB" },
                  { name: "Insurance Documents", date: "Mar 15, 2024", type: "Insurance", size: "680 KB" },
                ].map((doc) => (
                  <div key={doc.name} className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{doc.date} • {doc.size}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing History */}
        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> Billing History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { inv: "INV-2026-0156", date: "Aug 3, 2026", items: 7, amount: 24570, status: "Paid" },
                      { inv: "INV-2026-0124", date: "Jul 15, 2026", items: 3, amount: 8200, status: "Paid" },
                      { inv: "INV-2026-0098", date: "Jun 28, 2026", items: 5, amount: 15400, status: "Paid" },
                      { inv: "INV-2026-0067", date: "May 12, 2026", items: 2, amount: 3200, status: "Paid" },
                    ].map((b) => (
                      <TableRow key={b.inv} className="cursor-pointer hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">{b.inv}</TableCell>
                        <TableCell className="text-xs">{b.date}</TableCell>
                        <TableCell className="text-xs">{b.items} items</TableCell>
                        <TableCell className="text-right font-medium">₹{b.amount.toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={b.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
