"use client";

import { StatCard } from "@/components/shared/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Users, DollarSign, CalendarClock, BedDouble, LogOut, Activity,
  AlertTriangle, ShieldAlert, Pill, FlaskConical, ScanLine, TrendingUp,
  Heart, UserPlus, RefreshCw, LayoutDashboard, ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  RadialBarChart, RadialBar, LineChart, Line,
} from "recharts";
import {
  revenueTrendData, patientGrowthData, departmentPerformanceData,
  appointmentTrendData, insuranceClaimsData, pharmacySalesData,
  appointments, beds, doctors, leads,
} from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/app-store";

const CHART_COLORS = {
  primary: "oklch(0.55 0.22 259)",
  success: "oklch(0.62 0.19 155)",
  warning: "oklch(0.72 0.18 70)",
  destructive: "oklch(0.58 0.24 27)",
  info: "oklch(0.6 0.13 230)",
};

export function DashboardModule() {
  const { setActiveModule } = useAppStore();

  const bedOccupancy = beds.filter((b) => b.status === "Occupied").length;
  const bedTotal = beds.length;
  const occupancyRate = Math.round((bedOccupancy / bedTotal) * 100);

  const availableDoctors = doctors.filter((d) => d.availability === "Available").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Welcome back, Dr. Aditya! Here's what's happening at MediCore Main Campus today."
        icon={LayoutDashboard}
        action={
          <>
            <Button variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" className="gap-2">
              <TrendingUp className="h-3.5 w-3.5" /> Generate Report
            </Button>
          </>
        }
      />

      {/* Stat Widgets Row 1 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Today's Patients" value="248" icon={Users} trend={12} trendLabel="vs yesterday" color="primary" delay={0} />
        <StatCard title="Today's Revenue" value="₹4.82L" icon={DollarSign} trend={8} trendLabel="vs yesterday" color="success" delay={0.05} />
        <StatCard title="Appointments" value="62" icon={CalendarClock} trend={5} trendLabel="vs yesterday" color="info" delay={0.1} />
        <StatCard title="Admissions" value="14" icon={Activity} trend={-3} trendLabel="vs yesterday" color="warning" delay={0.15} />
        <StatCard title="Discharges" value="9" icon={LogOut} trend={2} trendLabel="vs yesterday" color="success" delay={0.2} />
        <StatCard title="Emergency" value="3" icon={AlertTriangle} trend={0} trendLabel="stable" color="destructive" delay={0.25} />
      </div>

      {/* Stat Widgets Row 2 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        <StatCard title="Doctor Availability" value={`${availableDoctors}/${doctors.length}`} icon={Heart} color="primary" subtitle="Available now" delay={0.3} />
        <StatCard title="Bed Occupancy" value={`${occupancyRate}%`} icon={BedDouble} color="warning" subtitle={`${bedOccupancy}/${bedTotal} occupied`} delay={0.35} />
        <StatCard title="Pending Bills" value="18" icon={ShieldAlert} color="destructive" subtitle="₹2.4L outstanding" delay={0.4} />
        <StatCard title="Insurance Claims" value="38" icon={ShieldAlert} color="warning" subtitle="Pending approval" delay={0.45} />
        <StatCard title="Pharmacy Sales" value="₹38K" icon={Pill} trend={15} trendLabel="today" color="success" delay={0.5} />
        <StatCard title="Lab Reports" value="12" icon={FlaskConical} color="info" subtitle="Pending" delay={0.55} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Revenue Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Revenue Trend</CardTitle>
              <CardDescription className="text-xs">Monthly revenue (OPD vs IPD)</CardDescription>
            </div>
            <Badge variant="outline" className="text-success border-success/20 bg-success/10">
              <ArrowUpRight className="h-3 w-3 mr-1" /> 18.2%
            </Badge>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueTrendData} margin={{ left: -20, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="opdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: "1px solid oklch(0.92 0.008 240)", fontSize: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.08)" }}
                  formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`}
                />
                <Area type="monotone" dataKey="revenue" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#revGrad)" name="Total Revenue" />
                <Area type="monotone" dataKey="opd" stroke={CHART_COLORS.success} strokeWidth={2} fill="url(#opdGrad)" name="OPD" />
                <Area type="monotone" dataKey="ipd" stroke={CHART_COLORS.warning} strokeWidth={2} fill="none" name="IPD" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* OPD vs IPD Donut */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">OPD vs IPD</CardTitle>
            <CardDescription className="text-xs">Patient distribution</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "OPD", value: 68, fill: CHART_COLORS.primary },
                    { name: "IPD", value: 32, fill: CHART_COLORS.success },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {[CHART_COLORS.primary, CHART_COLORS.success].map((c, i) => (
                    <Cell key={i} fill={c} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v}%`} contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.primary }} />
                <span className="text-xs text-muted-foreground">OPD <span className="font-semibold text-foreground">68%</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full" style={{ background: CHART_COLORS.success }} />
                <span className="text-xs text-muted-foreground">IPD <span className="font-semibold text-foreground">32%</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Patient Growth */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Patient Growth</CardTitle>
            <CardDescription className="text-xs">New patients per month</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={patientGrowthData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Line type="monotone" dataKey="new" stroke={CHART_COLORS.primary} strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} name="New Patients" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Department Performance */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Department Performance</CardTitle>
              <CardDescription className="text-xs">Patients treated by department</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("reports")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={departmentPerformanceData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="department" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="patients" radius={[6, 6, 0, 0]} name="Patients">
                  {departmentPerformanceData.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.primary, CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.info, CHART_COLORS.destructive, CHART_COLORS.primary][i % 6]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row 3 + Activity */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Appointment Trends */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Appointment Trends</CardTitle>
            <CardDescription className="text-xs">Weekly appointment statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={appointmentTrendData} margin={{ left: -20, right: 10, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Bar dataKey="booked" stackId="a" fill={CHART_COLORS.primary} radius={[0, 0, 0, 0]} name="Booked" />
                <Bar dataKey="completed" stackId="b" fill={CHART_COLORS.success} radius={[6, 6, 0, 0]} name="Completed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bed Occupancy Radial */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bed Occupancy</CardTitle>
            <CardDescription className="text-xs">{bedOccupancy} of {bedTotal} beds occupied</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="55%" outerRadius="90%" barSize={14} data={[{ name: "Occupied", value: occupancyRate, fill: CHART_COLORS.warning }]}>
                <RadialBar background={{ fill: "oklch(0.93 0.008 240)" }} dataKey="value" cornerRadius={10} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="mt-[-140px] mb-[100px] text-center">
              <p className="text-3xl font-bold">{occupancyRate}%</p>
              <p className="text-xs text-muted-foreground">Occupied</p>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2 text-center">
              <div>
                <p className="text-sm font-semibold text-success">{beds.filter(b => b.status === "Available").length}</p>
                <p className="text-[10px] text-muted-foreground">Available</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-warning">{beds.filter(b => b.status === "Reserved").length}</p>
                <p className="text-[10px] text-muted-foreground">Reserved</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-destructive">{beds.filter(b => b.status === "Maintenance").length}</p>
                <p className="text-[10px] text-muted-foreground">Maint.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Today's Appointments + Recent Activity + Leads */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Today's Appointments */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base">Today's Appointments</CardTitle>
              <CardDescription className="text-xs">Live queue & consultation status</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => setActiveModule("appointments")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[320px]">
              <div className="divide-y px-6">
                {appointments.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {apt.patientPhoto}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate">{apt.patientName}</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">{apt.token}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{apt.doctorName} • {apt.department}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-medium">{apt.time}</p>
                      <p className="text-[10px] text-muted-foreground">{apt.type}</p>
                    </div>
                    <StatusBadge status={apt.status} className="shrink-0" />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Recent Activity / Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Insights</CardTitle>
            <CardDescription className="text-xs">Key metrics today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Patient Satisfaction */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground">Patient Satisfaction</span>
                <span className="text-xs font-semibold">4.8 / 5.0</span>
              </div>
              <Progress value={96} className="h-1.5" />
            </div>
            {/* Radiology Queue */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><ScanLine className="h-3 w-3" /> Radiology Queue</span>
                <span className="text-xs font-semibold">5 pending</span>
              </div>
              <Progress value={35} className="h-1.5" />
            </div>
            {/* Pharmacy */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Pill className="h-3 w-3" /> Low Stock Items</span>
                <span className="text-xs font-semibold text-destructive">2 items</span>
              </div>
              <Progress value={20} className="h-1.5" />
            </div>
            {/* New Leads */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><UserPlus className="h-3 w-3" /> New Leads</p>
                  <p className="text-lg font-bold mt-0.5">{leads.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Est. Value</p>
                  <p className="text-sm font-semibold text-success">₹{(leads.reduce((s, l) => s + l.estimatedValue, 0) / 1000).toFixed(0)}K</p>
                </div>
              </div>
            </div>
            {/* Referral Patients */}
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><RefreshCw className="h-3 w-3" /> Referral Patients</p>
                  <p className="text-lg font-bold mt-0.5">24</p>
                </div>
                <Badge className="bg-success/10 text-success border-success/20">
                  <ArrowUpRight className="h-3 w-3 mr-1" /> +12%
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insurance + Pharmacy Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Insurance Claims Status</CardTitle>
            <CardDescription className="text-xs">Claims distribution by status</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={insuranceClaimsData} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="status" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]} name="Claims">
                  {insuranceClaimsData.map((_, i) => (
                    <Cell key={i} fill={[CHART_COLORS.success, CHART_COLORS.warning, CHART_COLORS.destructive, CHART_COLORS.info][i % 4]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pharmacy Sales vs Purchases</CardTitle>
            <CardDescription className="text-xs">Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={pharmacySalesData} margin={{ left: -10, right: 10, top: 10 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.success} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={CHART_COLORS.success} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="purchGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.info} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={CHART_COLORS.info} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Area type="monotone" dataKey="sales" stroke={CHART_COLORS.success} strokeWidth={2.5} fill="url(#salesGrad)" name="Sales" />
                <Area type="monotone" dataKey="purchases" stroke={CHART_COLORS.info} strokeWidth={2} fill="url(#purchGrad)" name="Purchases" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
