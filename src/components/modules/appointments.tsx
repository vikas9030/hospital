"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { appointments, doctors } from "@/lib/data";
import {
  CalendarClock, Plus, Clock, Users, CheckCircle2, XCircle,
  Calendar as CalIcon, List, Grid3x3, Video, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { motion } from "framer-motion";
import { useState } from "react";

const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];

const typeColors = {
  "Walk-in": "bg-info/10 text-info border-info/20",
  "Online": "bg-primary/10 text-primary border-primary/20",
  "Emergency": "bg-destructive/10 text-destructive border-destructive/20",
  "Referral": "bg-warning/10 text-warning border-warning/20",
};

export function AppointmentsModule() {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Manage patient appointments, scheduling, and queues"
        icon={CalendarClock}
        action={
          <>
            <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
              <button onClick={() => setView("list")} className={`rounded-md p-1.5 ${view === "list" ? "bg-background shadow-sm" : ""}`}>
                <List className="h-4 w-4" />
              </button>
              <button onClick={() => setView("calendar")} className={`rounded-md p-1.5 ${view === "calendar" ? "bg-background shadow-sm" : ""}`}>
                <Grid3x3 className="h-4 w-4" />
              </button>
            </div>
            <Button size="sm" className="gap-2">
              <Plus className="h-3.5 w-3.5" /> New Appointment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Today's Total" value="62" icon={CalendarClock} color="primary" />
        <StatCard title="Completed" value="38" icon={CheckCircle2} color="success" />
        <StatCard title="Waiting" value="14" icon={Clock} color="warning" />
        <StatCard title="Cancelled" value="4" icon={XCircle} color="destructive" />
      </div>

      {view === "list" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Appointments — August 3, 2026</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px]">Token</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead className="hidden md:table-cell">Doctor</TableHead>
                    <TableHead className="hidden lg:table-cell">Department</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead className="hidden md:table-cell">Type</TableHead>
                    <TableHead className="hidden lg:table-cell">Wait</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((apt) => (
                    <TableRow key={apt.id} className="hover:bg-muted/40 cursor-pointer">
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] bg-primary/5">{apt.token}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{apt.patientPhoto}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{apt.patientName}</p>
                            <p className="text-xs text-muted-foreground hidden sm:block">{apt.reason}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm">{apt.doctorName}</TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{apt.department}</TableCell>
                      <TableCell className="text-sm font-medium">{apt.time}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className={`text-[10px] ${typeColors[apt.type]}`}>{apt.type}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs">
                        {apt.waitingTime > 0 ? `${apt.waitingTime} min` : "—"}
                      </TableCell>
                      <TableCell><StatusBadge status={apt.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">Appointment Calendar</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">‹</Button>
              <span className="text-sm font-medium">August 3, 2026</span>
              <Button variant="outline" size="sm">›</Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header row with doctors */}
              <div className="grid grid-cols-[80px_repeat(6,1fr)] gap-1 mb-2">
                <div className="text-xs font-medium text-muted-foreground p-2">Time</div>
                {doctors.slice(0, 6).map((doc) => (
                  <div key={doc.id} className="text-xs font-medium text-center p-2 rounded-md bg-muted/50">
                    <p className="font-semibold truncate">{doc.name.split(" ").slice(-2).join(" ")}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{doc.department}</p>
                  </div>
                ))}
              </div>
              {/* Time slots */}
              <div className="space-y-1">
                {timeSlots.map((time) => (
                  <div key={time} className="grid grid-cols-[80px_repeat(6,1fr)] gap-1">
                    <div className="text-xs text-muted-foreground p-2 font-mono">{time}</div>
                    {doctors.slice(0, 6).map((doc) => {
                      const apt = appointments.find((a) => a.doctorId === doc.id && a.time === time);
                      return (
                        <div
                          key={doc.id}
                          className={`min-h-[44px] rounded-md border p-1.5 transition-colors ${
                            apt
                              ? apt.type === "Emergency"
                                ? "bg-destructive/10 border-destructive/30"
                                : "bg-primary/5 border-primary/20"
                              : "border-dashed border-border hover:bg-muted/30 cursor-pointer"
                          }`}
                        >
                          {apt && (
                            <div className="h-full flex flex-col justify-center">
                              <p className="text-[11px] font-semibold truncate">{apt.patientName}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge variant="outline" className="text-[9px] h-3.5 px-1">{apt.token}</Badge>
                                {apt.type === "Emergency" && <AlertTriangle className="h-2.5 w-2.5 text-destructive" />}
                                {apt.type === "Online" && <Video className="h-2.5 w-2.5 text-primary" />}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Token / Queue Management */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Live Queue — Dr. Rajesh Kumar
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[300px]">
              <div className="px-4 pb-4 space-y-2">
                {appointments.filter(a => a.doctorId === "d1").map((apt, idx) => (
                  <div
                    key={apt.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      apt.status === "In Consultation" ? "bg-primary/5 border-primary/30" : "hover:bg-muted/40"
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full text-xs font-bold ${
                      apt.status === "Completed" ? "bg-success/10 text-success" :
                      apt.status === "In Consultation" ? "bg-primary text-primary-foreground" :
                      apt.status === "Checked-in" ? "bg-warning/10 text-warning" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {apt.token.split("-")[1]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{apt.patientName}</p>
                      <p className="text-xs text-muted-foreground">{apt.time} • {apt.reason}</p>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalIcon className="h-4 w-4 text-info" /> Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground">Avg Wait Time</p>
                <p className="text-xl font-bold text-primary mt-1">8 min</p>
              </div>
              <div className="rounded-lg bg-success/5 p-3">
                <p className="text-xs text-muted-foreground">Completion Rate</p>
                <p className="text-xl font-bold text-success mt-1">94%</p>
              </div>
              <div className="rounded-lg bg-warning/5 p-3">
                <p className="text-xs text-muted-foreground">No-show Rate</p>
                <p className="text-xl font-bold text-warning mt-1">6%</p>
              </div>
              <div className="rounded-lg bg-info/5 p-3">
                <p className="text-xs text-muted-foreground">Online Appts</p>
                <p className="text-xl font-bold text-info mt-1">18</p>
              </div>
            </div>
            <div className="pt-3 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">APPOINTMENT TYPES</p>
              <div className="space-y-2">
                {[
                  { type: "Walk-in", count: 28, color: "bg-info" },
                  { type: "Online", count: 18, color: "bg-primary" },
                  { type: "Referral", count: 12, color: "bg-warning" },
                  { type: "Emergency", count: 4, color: "bg-destructive" },
                ].map((t) => (
                  <div key={t.type} className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${t.color}`} />
                    <span className="text-xs flex-1">{t.type}</span>
                    <span className="text-xs font-semibold">{t.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
