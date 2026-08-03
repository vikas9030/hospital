"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { insuranceClaims, leads, campaigns } from "@/lib/data";
import {
  ShieldCheck, Plus, DollarSign, Clock, CheckCircle2, XCircle,
  TrendingUp, Users, Phone, Mail, MessageSquare, Globe, Facebook,
  Megaphone, Calendar, Target, ArrowRight, UserPlus, RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { motion } from "framer-motion";
import type { Lead } from "@/lib/types";

// ===== Insurance Module =====
export function InsuranceModule() {
  const totalClaimed = insuranceClaims.reduce((s, c) => s + c.claimAmount, 0);
  const totalApproved = insuranceClaims.reduce((s, c) => s + c.approvedAmount, 0);

  const providerData = [
    { name: "Star Health", value: 4, color: "oklch(0.55 0.22 259)" },
    { name: "HDFC ERGO", value: 1, color: "oklch(0.62 0.19 155)" },
    { name: "ICICI Lombard", value: 1, color: "oklch(0.72 0.18 70)" },
    { name: "Bajaj Allianz", value: 1, color: "oklch(0.6 0.13 230)" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance"
        description="Claims management, pre-authorization, and settlement tracking"
        icon={ShieldCheck}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Claim</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Claims" value={insuranceClaims.length.toString()} icon={ShieldCheck} color="primary" />
        <StatCard title="Approved Amount" value={`₹${(totalApproved / 1000).toFixed(0)}K`} icon={CheckCircle2} color="success" />
        <StatCard title="Pending" value={insuranceClaims.filter(c => c.status === "Pending" || c.status === "Pre-Auth").length.toString()} icon={Clock} color="warning" />
        <StatCard title="Rejection Rate" value="12%" icon={XCircle} color="destructive" subtitle="This month" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Claims by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={providerData} margin={{ left: -20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]} name="Claims">
                  {providerData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Claim Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: "Settled", value: 1, fill: "oklch(0.62 0.19 155)" },
                    { name: "Approved", value: 1, fill: "oklch(0.55 0.22 259)" },
                    { name: "Pending", value: 1, fill: "oklch(0.72 0.18 70)" },
                    { name: "Pre-Auth", value: 1, fill: "oklch(0.6 0.13 230)" },
                    { name: "Rejected", value: 1, fill: "oklch(0.58 0.24 27)" },
                  ]}
                  cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value"
                />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
              {["Settled", "Approved", "Pending", "Pre-Auth", "Rejected"].map((s, i) => (
                <div key={s} className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full" style={{ background: ["oklch(0.62 0.19 155)", "oklch(0.55 0.22 259)", "oklch(0.72 0.18 70)", "oklch(0.6 0.13 230)", "oklch(0.58 0.24 27)"][i] }} />
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Claims List</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Claim #</TableHead>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Provider</TableHead>
                  <TableHead className="hidden lg:table-cell">Treatment</TableHead>
                  <TableHead className="text-right">Claimed</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Approved</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {insuranceClaims.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs">{c.claimNo}</TableCell>
                    <TableCell className="text-sm font-medium">{c.patientName}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{c.provider}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{c.treatment}</TableCell>
                    <TableCell className="text-right text-sm font-medium">₹{c.claimAmount.toLocaleString("en-IN")}</TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm text-success">
                      {c.approvedAmount > 0 ? `₹${c.approvedAmount.toLocaleString("en-IN")}` : "—"}
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
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

// ===== CRM Module =====
const leadStages = ["New Lead", "Contacted", "Appointment", "Visit", "Treatment", "Follow-up", "Review", "Repeat Patient"];

const sourceIcons = {
  "Website": Globe,
  "Facebook": Facebook,
  "Google Ads": Target,
  "Walk-in": Users,
  "Referral": RefreshCw,
  "Phone Call": Phone,
  "WhatsApp": MessageSquare,
  "Email": Mail,
};

const sourceColors = {
  "Website": "bg-primary/10 text-primary",
  "Facebook": "bg-info/10 text-info",
  "Google Ads": "bg-warning/10 text-warning",
  "Walk-in": "bg-success/10 text-success",
  "Referral": "bg-primary/10 text-primary",
  "Phone Call": "bg-info/10 text-info",
  "WhatsApp": "bg-success/10 text-success",
  "Email": "bg-warning/10 text-warning",
};

export function CRMModule() {
  const totalValue = leads.reduce((s, l) => s + l.estimatedValue, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM — Lead Management"
        description="Track leads from acquisition to repeat patient conversion"
        icon={Users}
        action={<Button size="sm" className="gap-2"><UserPlus className="h-3.5 w-3.5" /> Add Lead</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Active Leads" value={leads.length.toString()} icon={Users} color="primary" />
        <StatCard title="Pipeline Value" value={`₹${(totalValue / 100000).toFixed(1)}L`} icon={DollarSign} color="success" />
        <StatCard title="Conversion Rate" value="28%" icon={TrendingUp} color="info" trend={4} trendLabel="this month" />
        <StatCard title="Avg Deal Size" value="₹14K" icon={Target} color="warning" />
      </div>

      {/* Pipeline Kanban */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex gap-3 min-w-[1000px]">
            {leadStages.map((stage) => {
              const stageLeads = leads.filter((l) => l.stage === stage);
              const stageValue = stageLeads.reduce((s, l) => s + l.estimatedValue, 0);
              return (
                <div key={stage} className="w-56 shrink-0">
                  <div className="flex items-center justify-between mb-2 px-2">
                    <div>
                      <p className="text-xs font-semibold">{stage}</p>
                      <p className="text-[10px] text-muted-foreground">{stageLeads.length} leads • ₹{(stageValue / 1000).toFixed(0)}K</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="space-y-2 min-h-[100px] p-1 rounded-lg bg-muted/30">
                    {stageLeads.map((lead) => {
                      const SourceIcon = sourceIcons[lead.source];
                      return (
                        <motion.div
                          key={lead.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="rounded-lg border bg-background p-3 hover:shadow-md transition-shadow cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{lead.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{lead.interest}</p>
                            </div>
                            <div className={`flex h-6 w-6 items-center justify-center rounded-md ${sourceColors[lead.source]}`}>
                              <SourceIcon className="h-3 w-3" />
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-[9px]">{lead.source}</Badge>
                            <span className="text-xs font-semibold text-success">₹{(lead.estimatedValue / 1000).toFixed(0)}K</span>
                          </div>
                          <div className="mt-2 pt-2 border-t flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>{lead.assignedTo}</span>
                            <span>{lead.lastContact}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Lead Sources Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Lead Sources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {(Object.keys(sourceIcons) as (keyof typeof sourceIcons)[]).map((source) => {
              const Icon = sourceIcons[source];
              const count = leads.filter(l => l.source === source).length;
              return (
                <div key={source} className="rounded-lg border p-3 text-center hover:shadow-md transition-shadow cursor-pointer">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl mb-2 ${sourceColors[source]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-bold">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{source}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Marketing Module =====
export function MarketingModule() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Campaigns across email, SMS, WhatsApp, and referral programs"
        icon={Megaphone}
        action={<Button size="sm" className="gap-2"><Plus className="h-3.5 w-3.5" /> New Campaign</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Active Campaigns" value={campaigns.filter(c => c.status === "Active").length.toString()} icon={Megaphone} color="primary" />
        <StatCard title="Total Reach" value="22.3K" icon={Users} color="info" subtitle="All campaigns" />
        <StatCard title="Conversions" value="805" icon={CheckCircle2} color="success" trend={18} trendLabel="this month" />
        <StatCard title="Conversion Rate" value="3.6%" icon={Target} color="warning" trend={0.4} trendLabel="vs last month" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campaign Performance</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-lg border overflow-hidden mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden md:table-cell">Start Date</TableHead>
                  <TableHead className="text-right">Audience</TableHead>
                  <TableHead className="hidden md:table-cell">Open Rate</TableHead>
                  <TableHead className="hidden lg:table-cell">Click Rate</TableHead>
                  <TableHead className="text-right">Conversions</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="text-sm font-medium">{c.name}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{c.type}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{c.startDate}</TableCell>
                    <TableCell className="text-right text-sm">{c.audience.toLocaleString()}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {c.sent > 0 ? (
                        <div className="w-24">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-medium">{Math.round((c.opened / c.sent) * 100)}%</span>
                          </div>
                          <Progress value={(c.opened / c.sent) * 100} className="h-1.5" />
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {c.sent > 0 ? `${Math.round((c.clicked / c.sent) * 100)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-success">{c.conversions}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Campaign Types Quick Access */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Email Campaigns", desc: "Newsletter & promotions", icon: Mail, color: "primary", count: 12 },
          { title: "SMS Campaigns", desc: "Appointment reminders", icon: MessageSquare, color: "info", count: 8 },
          { title: "WhatsApp", desc: "Birthday wishes & alerts", icon: MessageSquare, color: "success", count: 5 },
          { title: "Referral Program", desc: "Patient referral rewards", icon: RefreshCw, color: "warning", count: 3 },
        ].map((item) => {
          const Icon = item.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
          };
          return (
            <Card key={item.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorMap[item.color as keyof typeof colorMap]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[10px]">{item.count} active</Badge>
                </div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs gap-1">
                  Manage <ArrowRight className="h-3 w-3" />
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
