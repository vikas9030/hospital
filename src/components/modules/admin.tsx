"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { staffMembers, inventoryItems, branches } from "@/lib/data";
import {
  BarChart3, Download, FileText, TrendingUp, Users, Package,
  Settings as SettingsIcon, Plus, Search, Mail, Phone, Calendar,
  Shield, Bell, CreditCard, MessageSquare, Database, Building2,
  ConciergeBell, FolderOpen, IdCard, Wrench, AlertTriangle,
  CheckCircle2, Clock, MapPin, UserPlus, QrCode, Printer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useState } from "react";

// ===== Reports Module =====
export function ReportsModule() {
  const revenueByDept = [
    { dept: "Cardiology", revenue: 1240000, opd: 842, ipd: 124 },
    { dept: "Neurology", revenue: 980000, opd: 456, ipd: 89 },
    { dept: "Orthopedics", revenue: 1120000, opd: 689, ipd: 145 },
    { dept: "Pediatrics", revenue: 685000, opd: 1240, ipd: 56 },
    { dept: "Gynecology", revenue: 845000, opd: 567, ipd: 178 },
    { dept: "Dermatology", revenue: 320000, opd: 324, ipd: 0 },
  ];

  const monthlyTrend = [
    { month: "Jan", revenue: 2850000, patients: 8420, appointments: 1240 },
    { month: "Feb", revenue: 3120000, patients: 8900, appointments: 1380 },
    { month: "Mar", revenue: 3480000, patients: 9420, appointments: 1520 },
    { month: "Apr", revenue: 3210000, patients: 9870, appointments: 1450 },
    { month: "May", revenue: 3850000, patients: 10450, appointments: 1680 },
    { month: "Jun", revenue: 4120000, patients: 11060, appointments: 1820 },
    { month: "Jul", revenue: 4380000, patients: 11705, appointments: 1940 },
    { month: "Aug", revenue: 4820000, patients: 12480, appointments: 2120 },
  ];

  const reportTypes = [
    { title: "Revenue Reports", desc: "Daily, weekly, monthly revenue", icon: TrendingUp, color: "primary" },
    { title: "Doctor Reports", desc: "Performance & consultations", icon: Users, color: "info" },
    { title: "Department Reports", desc: "Department-wise analytics", icon: Building2, color: "success" },
    { title: "Patient Reports", desc: "Demographics & history", icon: FileText, color: "warning" },
    { title: "Appointment Reports", desc: "Booking & no-show analysis", icon: Calendar, color: "primary" },
    { title: "Insurance Reports", desc: "Claims & settlements", icon: Shield, color: "info" },
    { title: "Inventory Reports", desc: "Stock & consumables", icon: Package, color: "success" },
    { title: "Marketing Reports", desc: "Campaign performance", icon: BarChart3, color: "warning" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description="Comprehensive insights across all hospital operations"
        icon={BarChart3}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2"><FileText className="h-3.5 w-3.5" /> PDF</Button>
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> Excel</Button>
            <Button variant="outline" size="sm" className="gap-2"><Download className="h-3.5 w-3.5" /> CSV</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Revenue (YTD)" value="₹2.98Cr" icon={TrendingUp} color="success" trend={18} trendLabel="YoY" />
        <StatCard title="Total Patients" value="12,480" icon={Users} color="primary" trend={8} trendLabel="this year" />
        <StatCard title="Avg Revenue/Patient" value="₹2,386" icon={BarChart3} color="info" />
        <StatCard title="Satisfaction Score" value="4.8/5" icon={CheckCircle2} color="warning" subtitle="Based on 3,240 reviews" />
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {reportTypes.map((r) => {
          const Icon = r.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
          };
          return (
            <Card key={r.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${colorMap[r.color as keyof typeof colorMap]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs">View Report</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByDept} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="oklch(0.55 0.22 259)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Cr`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 259)" strokeWidth={2.5} dot={{ r: 3 }} name="Revenue" />
                <Line type="monotone" dataKey="patients" stroke="oklch(0.62 0.19 155)" strokeWidth={2} dot={{ r: 3 }} name="Patients" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Staff Module =====
export function StaffModule() {
  const [search, setSearch] = useState("");
  const filtered = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff Management"
        description="Doctors, nurses, technicians, and administrative staff"
        icon={IdCard}
        action={<Button size="sm" className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Add Staff</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Staff" value="342" icon={Users} color="primary" />
        <StatCard title="Active Today" value="298" icon={CheckCircle2} color="success" />
        <StatCard title="On Leave" value="12" icon={Calendar} color="warning" />
        <StatCard title="Avg Attendance" value="96%" icon={TrendingUp} color="info" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Shift</TableHead>
                  <TableHead className="hidden lg:table-cell">Attendance</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Salary</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{s.role}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.department}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{s.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{s.shift}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${s.attendance >= 95 ? "bg-success" : s.attendance >= 90 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${s.attendance}%` }} />
                        </div>
                        <span className="text-xs">{s.attendance}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm font-medium">₹{s.salary.toLocaleString("en-IN")}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
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

// ===== Inventory Module =====
export function InventoryModule() {
  const [search, setSearch] = useState("");
  const filtered = inventoryItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory Management"
        description="Medical equipment, consumables, and supplies"
        icon={Package}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add Item</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Items" value={inventoryItems.length.toString()} icon={Package} color="primary" />
        <StatCard title="Total Value" value="₹48.2L" icon={TrendingUp} color="success" />
        <StatCard title="Low Stock" value={inventoryItems.filter(i => i.status === "Low Stock").length.toString()} icon={AlertTriangle} color="warning" />
        <StatCard title="Out of Stock" value={inventoryItems.filter(i => i.status === "Out of Stock").length.toString()} icon={XCircle} color="destructive" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">Supplier</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          item.category === "Equipment" ? "bg-primary/10 text-primary" :
                          item.category === "Consumable" ? "bg-warning/10 text-warning" :
                          item.category === "Furniture" ? "bg-info/10 text-info" :
                          "bg-success/10 text-success"
                        }`}>
                          {item.category === "Equipment" ? <Package className="h-4 w-4" /> :
                           item.category === "Consumable" ? <Package className="h-4 w-4" /> :
                           item.category === "Furniture" ? <Package className="h-4 w-4" /> :
                           <Package className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.unit} • Restocked {item.lastRestocked}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{item.supplier}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{item.location}</TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{item.stock}</span>
                          <span className="text-muted-foreground">/ {item.reorderLevel}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${
                            item.stock === 0 ? "bg-destructive" :
                            item.stock < item.reorderLevel ? "bg-warning" : "bg-success"
                          }`} style={{ width: `${Math.min((item.stock / (item.reorderLevel * 2)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm font-medium">₹{item.price.toLocaleString("en-IN")}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
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

function XCircle({ className }: { className?: string }) {
  return <AlertTriangle className={className} />;
}

// ===== Settings Module =====
export function SettingsModule() {
  const [activeTab, setActiveTab] = useState("general");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure hospital, branches, roles, integrations, and preferences"
        icon={SettingsIcon}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="branches">Branches</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="security">Security & Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hospital Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Hospital Name</label>
                  <Input defaultValue="MediCore Hospital" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Registration Number</label>
                  <Input defaultValue="MH-BLR-2024-001234" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Contact Number</label>
                  <Input defaultValue="+91 80 1234 5678" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Email</label>
                  <Input defaultValue="info@medicore.com" className="mt-1 h-9" />
                </div>
                <Button size="sm" className="mt-2">Save Changes</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Tax & Currency</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Currency</label>
                  <Input defaultValue="INR (₹)" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Default Tax Rate (%)</label>
                  <Input defaultValue="5" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Timezone</label>
                  <Input defaultValue="Asia/Kolkata (IST)" className="mt-1 h-9" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Date Format</label>
                  <Input defaultValue="YYYY-MM-DD" className="mt-1 h-9" />
                </div>
                <Button size="sm" className="mt-2">Save Changes</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="branches" className="mt-4">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base">Hospital Branches</CardTitle>
              <Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Add Branch</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="rounded-lg border overflow-hidden mx-4 mb-4">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>Branch Name</TableHead>
                      <TableHead className="hidden md:table-cell">Location</TableHead>
                      <TableHead className="text-right">Patients</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Revenue (YTD)</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Staff</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((b) => (
                      <TableRow key={b.id} className="hover:bg-muted/40 cursor-pointer">
                        <TableCell className="font-medium text-sm">{b.name}</TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {b.location}
                        </TableCell>
                        <TableCell className="text-right text-sm">{b.patients.toLocaleString()}</TableCell>
                        <TableCell className="text-right hidden md:table-cell text-sm font-medium">₹{(b.revenue / 100000).toFixed(1)}L</TableCell>
                        <TableCell className="text-right hidden lg:table-cell text-sm">{b.staff}</TableCell>
                        <TableCell><StatusBadge status={b.status} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {["Super Admin", "Hospital Admin", "Doctor", "Receptionist", "Nurse", "Pharmacist", "Lab Technician", "Radiologist", "Accountant", "HR", "Marketing", "Patient"].map((role) => (
              <Card key={role} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Shield className="h-4 w-4" />
                    </div>
                    <Switch defaultChecked={role === "Super Admin" || role === "Hospital Admin"} />
                  </div>
                  <p className="text-sm font-semibold">{role}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {role === "Super Admin" ? "Full system access" :
                     role === "Doctor" ? "Clinical access" :
                     role === "Patient" ? "Self-service portal" :
                     "Role-based access"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { title: "Appointment Reminders", desc: "Send SMS/Email 24h before appointment", icon: Calendar },
              { title: "Prescription Ready", desc: "Notify patient when prescription is ready", icon: FileText },
              { title: "Lab Report Ready", desc: "Notify patient when lab results are available", icon: Bell },
              { title: "Bill Pending", desc: "Remind patient of pending payments", icon: CreditCard },
              { title: "Insurance Approved", desc: "Notify on insurance claim approval", icon: Shield },
              { title: "Birthday Wishes", desc: "Send birthday wishes to patients", icon: Calendar },
            ].map((n) => {
              const Icon = n.icon;
              return (
                <Card key={n.title}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "WhatsApp Business", desc: "Send WhatsApp notifications", icon: MessageSquare, status: "Connected" },
              { name: "SMS Gateway", desc: "Twilio / MSG91", icon: MessageSquare, status: "Connected" },
              { name: "Email SMTP", desc: "SendGrid / AWS SES", icon: Mail, status: "Connected" },
              { name: "Payment Gateway", desc: "Stripe / Razorpay", icon: CreditCard, status: "Connected" },
              { name: "Google Calendar", desc: "Sync appointments", icon: Calendar, status: "Not Connected" },
              { name: "Video Consultation", desc: "Zoom / Twilio Video", icon: Phone, status: "Connected" },
            ].map((int) => {
              const Icon = int.icon;
              return (
                <Card key={int.name}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <Badge variant="outline" className={int.status === "Connected" ? "text-success border-success/20 bg-success/10" : "text-muted-foreground"}>
                        {int.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-semibold">{int.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{int.desc}</p>
                    <Button variant="outline" size="sm" className="w-full mt-3 text-xs">
                      {int.status === "Connected" ? "Configure" : "Connect"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="security" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Security Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "Two-Factor Authentication", desc: "Require OTP for login", on: true },
                  { label: "Session Timeout", desc: "Auto logout after 30 min", on: true },
                  { label: "IP Whitelisting", desc: "Restrict access by IP", on: false },
                  { label: "Audit Logging", desc: "Log all user actions", on: true },
                  { label: "Data Encryption", desc: "Encrypt sensitive data at rest", on: true },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-3 p-3 rounded-lg border">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{s.label}</p>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                    <Switch defaultChecked={s.on} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Audit Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {[
                    { user: "Dr. Aditya Sharma", action: "Updated patient record", time: "2 min ago", ip: "192.168.1.10" },
                    { user: "Nurse Lakshmi Nair", action: "Marked medication given", time: "15 min ago", ip: "192.168.1.45" },
                    { user: "Receptionist Anita", action: "Created new appointment", time: "32 min ago", ip: "192.168.1.22" },
                    { user: "Dr. Rajesh Kumar", action: "Generated prescription", time: "1 hour ago", ip: "192.168.1.15" },
                    { user: "Accountant Manoj", action: "Processed invoice payment", time: "2 hours ago", ip: "192.168.1.30" },
                  ].map((log, i) => (
                    <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-info/10 text-info text-[10px] font-semibold">
                        {log.user.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs"><span className="font-semibold">{log.user}</span> {log.action}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{log.time} • IP: {log.ip}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Reception Module =====
export function ReceptionModule() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reception"
        description="Front desk operations — registration, tokens, and helpdesk"
        icon={ConciergeBell}
        action={<Button size="sm" className="gap-2"><UserPlus className="h-3.5 w-3.5" /> New Registration</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Today's Check-ins" value="186" icon={CheckCircle2} color="primary" />
        <StatCard title="Waiting" value="14" icon={Clock} color="warning" />
        <StatCard title="Tokens Issued" value="62" icon={QrCode} color="info" />
        <StatCard title="Payments Collected" value="₹38K" icon={CreditCard} color="success" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "New Patient", icon: UserPlus, color: "primary" },
          { label: "Book Appointment", icon: Calendar, color: "info" },
          { label: "OPD Registration", icon: FileText, color: "success" },
          { label: "IPD Admission", icon: Building2, color: "warning" },
          { label: "Print Token", icon: Printer, color: "primary" },
          { label: "Collect Payment", icon: CreditCard, color: "destructive" },
        ].map((a) => {
          const Icon = a.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
            destructive: "bg-destructive/10 text-destructive",
          };
          return (
            <Card key={a.label} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[a.color as keyof typeof colorMap]} mb-2`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium">{a.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { token: "A-009", name: "Ravi Kumar", doctor: "Dr. Rajesh Kumar", time: "13:30", status: "Waiting" },
              { token: "A-010", name: "Meena Jain", doctor: "Dr. Karthik Rao", time: "13:45", status: "Checked-in" },
              { token: "A-011", name: "Suresh Babu", doctor: "Dr. Sunita Menon", time: "14:00", status: "Waiting" },
              { token: "A-012", name: "Lakshmi Devi", doctor: "Dr. Meera Joshi", time: "14:15", status: "Waiting" },
              { token: "A-013", name: "Karthik S", doctor: "Dr. Aakash Verma", time: "14:30", status: "Scheduled" },
            ].map((p) => (
              <div key={p.token} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                  {p.token.split("-")[1]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.doctor} • {p.time}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Helpdesk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">Next Token</p>
              <p className="text-3xl font-bold text-primary">A-009</p>
              <Button size="sm" className="w-full mt-2">Call Next</Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold text-warning">14</p>
                <p className="text-[10px] text-muted-foreground">Waiting</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold text-success">48</p>
                <p className="text-[10px] text-muted-foreground">Served</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">AVG WAIT TIME</p>
              <p className="text-2xl font-bold">12 min</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ===== Medical Records Module =====
export function RecordsModule() {
  const records = [
    { id: "r1", patient: "Aarav Sharma", type: "Prescription", doctor: "Dr. Rajesh Kumar", date: "Aug 3, 2026", dept: "Cardiology" },
    { id: "r2", patient: "Aarav Sharma", type: "Lab Report", doctor: "Lab Tech Suresh", date: "Aug 3, 2026", dept: "Hematology" },
    { id: "r3", patient: "Aarav Sharma", type: "Radiology", doctor: "Dr. Mehta", date: "Aug 3, 2026", dept: "Radiology" },
    { id: "r4", patient: "Vikram Singh", type: "Discharge Summary", doctor: "Dr. Rajesh Kumar", date: "Aug 3, 2026", dept: "Cardiology" },
    { id: "r5", patient: "Ananya Reddy", type: "Clinical Notes", doctor: "Dr. Meera Joshi", date: "Jul 28, 2026", dept: "Gynecology" },
    { id: "r6", patient: "Rohan Mehta", type: "Medical Certificate", doctor: "Dr. Aakash Verma", date: "Aug 3, 2026", dept: "Orthopedics" },
    { id: "r7", patient: "Priya Patel", type: "Prescription", doctor: "Dr. Rajesh Kumar", date: "Aug 2, 2026", dept: "Cardiology" },
    { id: "r8", patient: "Sneha Iyer", type: "Lab Report", doctor: "Lab Tech Suresh", date: "Aug 3, 2026", dept: "Biochemistry" },
  ];

  const [search, setSearch] = useState("");
  const filtered = records.filter((r) =>
    r.patient.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Records"
        description="Centralized repository of all patient medical documents"
        icon={FolderOpen}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> Upload Record</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Records" value="48,290" icon={FolderOpen} color="primary" />
        <StatCard title="Prescriptions" value="12,480" icon={FileText} color="info" />
        <StatCard title="Lab Reports" value="8,920" icon={FileText} color="success" />
        <StatCard title="Radiology" value="3,640" icon={FileText} color="warning" />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search records by patient or type..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r) => (
              <div key={r.id} className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.type}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.patient}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.doctor} • {r.date}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Download className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
