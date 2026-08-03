"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { doctors } from "@/lib/data";
import {
  Stethoscope, Star, Phone, Mail, Calendar, Users, Award,
  Clock, Video, FileText, Search,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { motion } from "framer-motion";

const availabilityColors = {
  Available: "bg-success/10 text-success border-success/20",
  Busy: "bg-warning/10 text-warning border-warning/20",
  "Off Duty": "bg-muted text-muted-foreground border-border",
  "On Leave": "bg-info/10 text-info border-info/20",
};

export function DoctorsModule() {
  const [search, setSearch] = useState("");
  const [specialty, setSpecialty] = useState("All");

  const specialties = ["All", ...Array.from(new Set(doctors.map((d) => d.department)))];

  const filtered = doctors.filter((d) => {
    const matchSearch = d.name.toLowerCase().includes(search.toLowerCase()) || d.specialization.toLowerCase().includes(search.toLowerCase());
    const matchSpec = specialty === "All" || d.department === specialty;
    return matchSearch && matchSpec;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description="Manage doctor profiles, schedules, and availability"
        icon={Stethoscope}
        action={<Button size="sm">Add Doctor</Button>}
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard title="Total Doctors" value={doctors.length.toString()} icon={Stethoscope} color="primary" />
        <StatCard title="Available Now" value={doctors.filter(d => d.availability === "Available").length.toString()} icon={Clock} color="success" />
        <StatCard title="On Leave" value={doctors.filter(d => d.availability === "On Leave").length.toString()} icon={Calendar} color="info" />
        <StatCard title="Today's Consultations" value={doctors.reduce((s, d) => s + d.todayAppointments, 0).toString()} icon={Users} color="warning" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search doctors..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex items-center gap-1.5 rounded-lg bg-muted p-1 overflow-x-auto">
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() => setSpecialty(s)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                specialty === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Doctor Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((doc, idx) => (
          <motion.div
            key={doc.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <Card className="overflow-hidden hover:shadow-lg transition-shadow group">
              <div className="h-20 bg-gradient-to-r from-primary/15 to-info/10" />
              <CardContent className="p-5 -mt-10">
                <div className="flex items-end justify-between mb-3">
                  <Avatar className="h-16 w-16 border-4 border-background shadow-md">
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">{doc.photo}</AvatarFallback>
                  </Avatar>
                  <Badge variant="outline" className={`mb-1 ${availabilityColors[doc.availability]}`}>
                    <span className="h-1.5 w-1.5 rounded-full bg-current mr-1" />
                    {doc.availability}
                  </Badge>
                </div>
                <div className="mb-3">
                  <h3 className="font-bold text-base">{doc.name}</h3>
                  <p className="text-sm text-primary font-medium">{doc.specialization}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{doc.department} • {doc.experience} yrs exp</p>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  <Star className="h-4 w-4 fill-warning text-warning" />
                  <span className="text-sm font-semibold">{doc.rating}</span>
                  <span className="text-xs text-muted-foreground">• {doc.patientsTreated.toLocaleString()} patients</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-4 text-center">
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-bold text-primary">{doc.todayAppointments}</p>
                    <p className="text-[10px] text-muted-foreground">Today's Appts</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 p-2">
                    <p className="text-lg font-bold text-success">₹{doc.consultationFee}</p>
                    <p className="text-[10px] text-muted-foreground">Consultation</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Book
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {doc.phone}</span>
                  <span className="flex items-center gap-1"><Award className="h-3 w-3" /> {doc.qualification.split(",")[0]}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
