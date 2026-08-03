"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { beds } from "@/lib/data";
import {
  BedDouble, Activity, ClipboardList, Plus, Users, DollarSign,
  Stethoscope, FileText, ArrowRightLeft, Pill, FlaskConical,
  Receipt, AlertTriangle, CheckCircle2, Wrench, Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";

const wardColors = {
  "ICU": "from-destructive/20 to-destructive/5 border-destructive/20",
  "General Ward": "from-primary/20 to-primary/5 border-primary/20",
  "Private Room": "from-success/20 to-success/5 border-success/20",
  "Semi Private": "from-warning/20 to-warning/5 border-warning/20",
  "Emergency": "from-destructive/30 to-destructive/10 border-destructive/30",
  "Operation Theatre": "from-info/20 to-info/5 border-info/20",
};

const bedStatusStyles = {
  Available: "bg-success/10 text-success border-success/30 hover:bg-success/20",
  Occupied: "bg-destructive/10 text-destructive border-destructive/30",
  Maintenance: "bg-muted text-muted-foreground border-border",
  Reserved: "bg-warning/10 text-warning border-warning/30",
};

export function BedsModule() {
  const wards = ["ICU", "General Ward", "Private Room", "Semi Private", "Emergency", "Operation Theatre"];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bed Management"
        description="Real-time bed occupancy across all wards"
        icon={BedDouble}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add Bed</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Beds" value={beds.length.toString()} icon={BedDouble} color="primary" />
        <StatCard title="Occupied" value={beds.filter(b => b.status === "Occupied").length.toString()} icon={Activity} color="destructive" />
        <StatCard title="Available" value={beds.filter(b => b.status === "Available").length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="Occupancy Rate" value={`${Math.round((beds.filter(b => b.status === "Occupied").length / beds.length) * 100)}%`} icon={DollarSign} color="warning" />
      </div>

      {/* Legend */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <span className="font-semibold text-muted-foreground">LEGEND:</span>
            {Object.entries(bedStatusStyles).map(([status, style]) => (
              <div key={status} className="flex items-center gap-1.5">
                <div className={`h-3 w-3 rounded border ${style.split(" ").slice(0, 3).join(" ")}`} />
                <span>{status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bed Map by Ward */}
      <div className="grid gap-4 lg:grid-cols-2">
        {wards.map((ward) => {
          const wardBeds = beds.filter((b) => b.ward === ward);
          const occupied = wardBeds.filter((b) => b.status === "Occupied").length;
          const rate = Math.round((occupied / wardBeds.length) * 100);

          return (
            <motion.div key={ward} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <Card className={`bg-gradient-to-br ${wardColors[ward as keyof typeof wardColors]}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      {ward === "ICU" && <Activity className="h-4 w-4" />}
                      {ward === "Operation Theatre" && <Stethoscope className="h-4 w-4" />}
                      {ward === "Emergency" && <AlertTriangle className="h-4 w-4" />}
                      {(ward === "General Ward" || ward === "Private Room" || ward === "Semi Private") && <BedDouble className="h-4 w-4" />}
                      {ward}
                    </CardTitle>
                    <Badge variant="outline" className="bg-background/50">
                      {occupied}/{wardBeds.length} occupied
                    </Badge>
                  </div>
                  <Progress value={rate} className="h-1.5 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {wardBeds.map((bed) => (
                      <div
                        key={bed.id}
                        className={`group relative rounded-lg border-2 p-2.5 transition-all cursor-pointer hover:scale-105 ${bedStatusStyles[bed.status]}`}
                        title={bed.patientName || bed.status}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <BedDouble className="h-3.5 w-3.5" />
                          {bed.status === "Maintenance" && <Wrench className="h-3 w-3" />}
                          {bed.status === "Reserved" && <Clock className="h-3 w-3" />}
                        </div>
                        <p className="text-[11px] font-bold">{bed.number}</p>
                        <p className="text-[9px] mt-0.5 opacity-80">
                          {bed.status === "Occupied" ? bed.patientName?.split(" ")[0] : bed.status}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Daily Rate</span>
                    <span className="font-semibold">₹{wardBeds[0]?.dailyRate.toLocaleString()}/day</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ===== OPD Module =====
export function OPDModule() {
  const opdPatients = [
    { token: "OPD-001", name: "Priya Patel", doctor: "Dr. Rajesh Kumar", dept: "Cardiology", time: "09:00", status: "Completed", fee: 1200 },
    { token: "OPD-002", name: "Rohan Mehta", doctor: "Dr. Aakash Verma", dept: "Orthopedics", time: "10:00", status: "In Consultation", fee: 1000 },
    { token: "OPD-003", name: "Arjun Nair", doctor: "Dr. Karthik Rao", dept: "Pediatrics", time: "10:30", status: "Checked-in", fee: 800 },
    { token: "OPD-004", name: "Sneha Iyer", doctor: "Dr. Sunita Menon", dept: "Neurology", time: "12:00", status: "Waiting", fee: 1500 },
    { token: "OPD-005", name: "Kavya Gowda", doctor: "Dr. Neha Gupta", dept: "Dermatology", time: "11:00", status: "Scheduled", fee: 700 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="OPD — Outpatient Department"
        description="Manage outpatient registrations, consultations, and follow-ups"
        icon={ClipboardList}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New OPD Registration</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="OPD Patients Today" value="186" icon={Users} color="primary" trend={8} trendLabel="vs yesterday" />
        <StatCard title="In Consultation" value="12" icon={Stethoscope} color="warning" />
        <StatCard title="Waiting" value="24" icon={Clock} color="info" />
        <StatCard title="OPD Revenue" value="₹2.98L" icon={DollarSign} color="success" trend={12} trendLabel="today" />
      </div>

      {/* OPD Workflow */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">OPD Workflow</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {["Registration", "Consultation", "Prescription", "Billing", "Follow-up"].map((step, i, arr) => (
              <div key={step} className="flex items-center gap-1 shrink-0">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">{i + 1}</span>
                    <span className="text-xs font-medium whitespace-nowrap">{step}</span>
                  </div>
                </div>
                {i < arr.length - 1 && <ArrowRightLeft className="h-4 w-4 text-muted-foreground shrink-0" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Today's OPD Queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[80px]">Token</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Doctor</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead>Time</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opdPatients.map((p) => (
                  <TableRow key={p.token} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell><Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{p.token}</Badge></TableCell>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{p.doctor}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.dept}</TableCell>
                    <TableCell className="text-sm">{p.time}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{p.fee}</TableCell>
                    <TableCell><StatusBadge status={p.status} /></TableCell>
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

// ===== IPD Module =====
export function IPDModule() {
  const ipdPatients = beds.filter((b) => b.status === "Occupied").map((b, i) => ({
    ...b,
    doctor: ["Dr. Rajesh Kumar", "Dr. Sunita Menon", "Dr. Aakash Verma", "Dr. Meera Joshi"][i % 4],
    diagnosis: ["Cardiac Evaluation", "Migraine Treatment", "Knee Surgery Recovery", "Thyroid Management"][i % 4],
    admissionDate: b.admittedOn,
    daysAdmitted: Math.floor(Math.random() * 5) + 1,
    dailyCharges: b.dailyRate,
    totalCharges: b.dailyRate * (Math.floor(Math.random() * 5) + 1),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="IPD — Inpatient Department"
        description="Manage admissions, ward transfers, nursing, and discharges"
        icon={BedDouble}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Admission</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Admitted Patients" value={ipdPatients.length.toString()} icon={BedDouble} color="warning" />
        <StatCard title="Discharges Today" value="9" icon={CheckCircle2} color="success" />
        <StatCard title="Avg Stay" value="3.2 days" icon={Clock} color="info" />
        <StatCard title="IPD Revenue" value="₹1.84L" icon={DollarSign} color="success" trend={15} trendLabel="today" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Current Admissions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Patient</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead className="hidden md:table-cell">Doctor</TableHead>
                    <TableHead className="hidden lg:table-cell">Diagnosis</TableHead>
                    <TableHead className="hidden md:table-cell">Days</TableHead>
                    <TableHead className="text-right">Charges</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ipdPatients.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40 cursor-pointer">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                              {p.patientName?.split(" ").map(n => n[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{p.patientName}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="font-mono text-[10px]">{p.number}</Badge></TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{p.doctor}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{p.diagnosis}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{p.daysAdmitted}d</TableCell>
                      <TableCell className="text-right text-sm font-medium">₹{p.totalCharges.toLocaleString("en-IN")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Nursing Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-destructive/5 p-3 border border-destructive/20">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <p className="text-sm font-semibold">Critical Patients</p>
              </div>
              <p className="text-2xl font-bold text-destructive">3</p>
              <p className="text-xs text-muted-foreground mt-1">Require immediate attention</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs flex items-center gap-2"><Pill className="h-3 w-3 text-primary" /> Medication Due</span>
                <Badge className="bg-warning/10 text-warning border-warning/20">8</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs flex items-center gap-2"><FlaskConical className="h-3 w-3 text-info" /> Lab Samples Pending</span>
                <Badge className="bg-info/10 text-info border-info/20">5</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs flex items-center gap-2"><FileText className="h-3 w-3 text-primary" /> Vitals Due</span>
                <Badge className="bg-primary/10 text-primary border-primary/20">12</Badge>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <span className="text-xs flex items-center gap-2"><Receipt className="h-3 w-3 text-success" /> Discharge Pending</span>
                <Badge className="bg-success/10 text-success border-success/20">4</Badge>
              </div>
            </div>
            <Button className="w-full" size="sm" variant="outline">Doctor Rounds Schedule</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
