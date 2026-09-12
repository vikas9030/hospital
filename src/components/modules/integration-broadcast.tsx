"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { Send, Phone, Megaphone, CheckCircle2, XCircle } from "lucide-react";
import { integrationStatus, logIntegrationAudit } from "@/lib/integrations";

type Channel = "whatsapp" | "sms" | "email";
type Audience = "patient-one" | "patient-all" | "doctor-one" | "doctor-all" | "staff-one" | "staff-all" | "custom";

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "patient-one", label: "Individual patient" },
  { value: "patient-all", label: "All patients" },
  { value: "doctor-one", label: "Individual doctor" },
  { value: "doctor-all", label: "All doctors" },
  { value: "staff-one", label: "Individual staff member" },
  { value: "staff-all", label: "All staff" },
  { value: "custom", label: "Custom numbers / emails" },
];

interface Resolved {
  to: string;
  name: string;
  valid: boolean;
}

export function BroadcastComposer({ settings }: { settings: Record<string, string> }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const { patients, doctors, staffMembers } = useBranchData();

  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [audience, setAudience] = useState<Audience>("patient-one");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [customText, setCustomText] = useState("");
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState("");
  const [sending, setSending] = useState(false);
  const [report, setReport] = useState<{ sent: number; failed: number; simulated: number; total: number; results: { to: string; name?: string; ok: boolean; simulated?: boolean; error?: string }[] } | null>(null);

  const isPhone = channel !== "email";
  const contactOf = (p: { phone?: string; email?: string }) => (isPhone ? (p.phone ?? "") : (p.email ?? "")).trim();

  const oneList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const pool =
      audience === "patient-one"
        ? patients.map((p) => ({ id: p.id, name: p.name, contact: contactOf(p), extra: p.phone }))
        : audience === "doctor-one"
          ? doctors.map((d) => ({ id: d.id, name: d.name, contact: contactOf(d), extra: (d as any).department ?? (d as any).specialization ?? "" }))
          : audience === "staff-one"
            ? staffMembers.map((m: any) => ({ id: m.id, name: m.name, contact: contactOf(m), extra: m.role ?? "" }))
            : [];
    const filtered = q ? pool.filter((x) => `${x.name} ${x.contact} ${x.extra}`.toLowerCase().includes(q)) : pool;
    return filtered.slice(0, 60);
  }, [audience, search, patients, doctors, staffMembers, channel]);

  const resolved: Resolved[] = useMemo(() => {
    const push = (name: string, contact: string): Resolved => {
      const c = (contact || "").trim();
      const valid = isPhone ? /^\+?\d{7,15}$/.test(c.replace(/[\s-]/g, "")) : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c);
      return { to: c, name, valid };
    };
    if (audience === "patient-one" || audience === "doctor-one" || audience === "staff-one") {
      const pool: any[] =
        audience === "patient-one" ? patients : audience === "doctor-one" ? doctors : staffMembers;
      const found = pool.find((x: any) => x.id === selectedId);
      if (!found) return [];
      return [push(found.name, contactOf(found))];
    }
    if (audience === "patient-all") return patients.map((p) => push(p.name, contactOf(p)));
    if (audience === "doctor-all") return doctors.map((d: any) => push(d.name, contactOf(d)));
    if (audience === "staff-all") return (staffMembers as any[]).map((m: any) => push(m.name, contactOf(m)));
    // custom: split on comma / newline / space
    return customText
      .split(/[\n,;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => push("", t));
  }, [audience, selectedId, patients, doctors, staffMembers, customText, channel, isPhone]);

  const mailable = resolved.filter((r) => r.valid);
  const skipped = resolved.length - mailable.length;

  const chStatus = integrationStatus(channel, settings);
  const channelOff = !chStatus.enabled;

  const handleSend = async () => {
    setReport(null);
    if (mailable.length === 0) {
      toast({ title: "No valid recipients", description: isPhone ? "Selected audience has no valid phone numbers." : "Selected audience has no valid email addresses.", variant: "destructive" });
      return;
    }
    if (!message.trim()) {
      toast({ title: "Message is empty", description: "Type the message to send.", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/integrations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channel,
          recipients: mailable.slice(0, 100).map((r) => ({ to: r.to, name: r.name })),
          message: message.trim(),
          subject: subject.trim(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Broadcast failed.");
      setReport(body);
      await logIntegrationAudit({
        actor: currentUser.name,
        actorEmail: currentUser.email,
        action: `INTEGRATION_${channel.toUpperCase()}_BROADCAST`,
        branch: currentUser.branch,
        details: `${currentUser.name} sent ${channel} to ${body.sent}/${body.total} (${audience}).${body.simulated ? ` ${body.simulated} simulated (no provider keys).` : ""}`,
      });
      toast({
        title: `Sent ${body.sent}/${body.total}`,
        description: body.simulated ? `${body.simulated} delivered as simulated (save provider keys for real delivery).` : "Broadcast complete — see the report below.",
      });
    } catch (e: any) {
      toast({ title: "Broadcast failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" /> Send & Call Center
        </CardTitle>
        <CardDescription className="text-xs">
          Send a message right from here — pick a channel, pick <strong>one person or everyone</strong> (patients / doctors / staff), type once with <span className="font-mono">{"{name}"}</span> for personalisation, and hit Send. Phone lists also get one-tap <strong>Call</strong> buttons.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs font-medium">Channel</Label>
            <Select value={channel} onValueChange={(v) => { setChannel(v as Channel); setReport(null); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp {integrationStatus("whatsapp", settings).enabled ? "" : "(off)"}</SelectItem>
                <SelectItem value="sms">SMS {integrationStatus("sms", settings).enabled ? "" : "(off)"}</SelectItem>
                <SelectItem value="email">Email {integrationStatus("email", settings).enabled ? "" : "(off)"}</SelectItem>
              </SelectContent>
            </Select>
            {channelOff && (
              <p className="text-[11px] text-warning">This channel is switched Off — enable it on its card below before sending.</p>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Send to</Label>
            <Select value={audience} onValueChange={(v) => { setAudience(v as Audience); setSelectedId(""); setReport(null); }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {(audience === "patient-one" || audience === "doctor-one" || audience === "staff-one") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium">Search</Label>
              <Input className="h-9" placeholder="Type name, number or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium">Pick person ({oneList.length} shown)</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>
                  {oneList.map((x) => (
                    <SelectItem key={x.id} value={x.id}>{x.name}{x.contact ? ` — ${x.contact}` : " — no contact"}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {audience === "custom" && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">{isPhone ? "Custom numbers (comma or new line separated)" : "Custom emails (comma or new line separated)"}</Label>
            <Textarea rows={2} placeholder={isPhone ? "919876543210, 919123456780" : "a@x.com, b@y.com"} value={customText} onChange={(e) => setCustomText(e.target.value)} />
          </div>
        )}

        {channel === "email" && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Subject</Label>
            <Input className="h-9" placeholder="e.g. Health camp on Sunday" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Message <span className="text-muted-foreground font-normal">(use {"{name}"} — becomes each person&apos;s name)</span></Label>
            <span className="text-[11px] text-muted-foreground">{message.length} chars</span>
          </div>
          <Textarea rows={3} placeholder={isPhone ? "Hi {name}, your appointment is tomorrow at 10 AM — MediCore" : "Dear {name}, …"} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" disabled={sending || channelOff || mailable.length === 0} onClick={handleSend}>
            <Send className="h-3.5 w-3.5 mr-1.5" /> {sending ? "Sending…" : `Send ${channel === "email" ? "email" : channel === "sms" ? "SMS" : "WhatsApp"} to ${mailable.length} recipient${mailable.length === 1 ? "" : "s"}`}
          </Button>
          <Badge variant="outline" className="text-[11px]">
            {mailable.length} valid{skipped > 0 ? ` • ${skipped} skipped (no ${isPhone ? "number" : "email"})` : ""}
          </Badge>
        </div>

        {mailable.length > 0 && mailable.length <= 12 && (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Name</TableHead>
                  <TableHead>{isPhone ? "Phone" : "Email"}</TableHead>
                  {isPhone && <TableHead className="w-[90px] text-right">Call</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {mailable.map((r, i) => (
                  <TableRow key={`${r.to}-${i}`}>
                    <TableCell className="text-xs font-medium">{r.name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.to}</TableCell>
                    {isPhone && (
                      <TableCell className="text-right">
                        <a href={`tel:${r.to.replace(/[\s-]/g, "")}`}>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]"><Phone className="h-3 w-3 mr-1" /> Call</Button>
                        </a>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {mailable.length > 12 && (
          <p className="text-[11px] text-muted-foreground">
            {mailable.length} recipients ready{isPhone ? " — call anyone individually from Patients / Doctors / Staff lists" : ""} (preview shows for up to 12).
          </p>
        )}

        {report && (
          <div className="rounded-lg border p-3 space-y-2 bg-background">
            <p className="text-xs font-semibold flex items-center gap-2">
              {report.failed === 0 ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-warning" />}
              Result: {report.sent}/{report.total} delivered{report.simulated ? ` (${report.simulated} simulated — save provider keys for real delivery)` : ""}
            </p>
            {report.results.filter((r) => !r.ok).slice(0, 10).map((r, i) => (
              <p key={i} className="text-[11px] text-destructive">{r.to} — {r.error}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
