"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { MessageSquare, Mail, CreditCard, Calendar, Phone, Copy, CheckCircle2, XCircle, Download, Video } from "lucide-react";
import { integrationStatus, logIntegrationAudit, type IntegrationId } from "@/lib/integrations";
import { BroadcastComposer } from "@/components/modules/integration-broadcast";

type SaveFn = (key: string, value: string) => Promise<{ ok: boolean; error?: string } | void> | void;

const SECRET_PLACEHOLDER = "Saved on server — enter a new value to replace";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function fmtTime(iso?: string) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

export function IntegrationsTab({ settings, onSave, onGotoPayments }: { settings: Record<string, string>; onSave: SaveFn; onGotoPayments?: () => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [open, setOpen] = useState<IntegrationId | null>(null);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [videoLink, setVideoLink] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const [activity, setActivity] = useState<any[]>([]);

  // Drafts per dialog — initialised when a dialog opens.
  const [wa, setWa] = useState({ phoneId: "", token: "", template: "" });
  const [waTest, setWaTest] = useState({ to: "", message: "" });
  const [sms, setSms] = useState({ provider: "twilio", sid: "", token: "", from: "", sender: "" });
  const [smsTest, setSmsTest] = useState({ to: "", message: "" });
  const [em, setEm] = useState({ provider: "sendgrid", apiKey: "", from: "", fromName: "" });
  const [emTest, setEmTest] = useState({ to: "", subject: "", message: "" });
  const [gc, setGc] = useState({ calendarId: "", clientId: "" });
  const [vd, setVd] = useState({ provider: "jitsi", apiKey: "" });
  const [vdTopic, setVdTopic] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/api/audit");
        if (!res.ok) return;
        const all = await res.json();
        if (live) setActivity((Array.isArray(all) ? all : []).filter((r: any) => String(r.action || "").startsWith("INTEGRATION")).slice(0, 8));
      } catch {
        // Activity is optional.
      }
    })();
    return () => { live = false; };
  }, []);

  const openDialog = (id: IntegrationId) => {
    if (id === "whatsapp") {
      setWa({ phoneId: settings.int_whatsapp_phoneId ?? "", token: "", template: settings.int_whatsapp_template ?? "hello_world" });
      setTestResult(null);
    }
    if (id === "sms") {
      setSms({
        provider: settings.int_sms_provider ?? "twilio",
        sid: settings.int_sms_sid ?? "",
        token: "",
        from: settings.int_sms_from ?? "",
        sender: settings.int_sms_sender ?? "MEDICR",
      });
      setTestResult(null);
    }
    if (id === "email") {
      setEm({
        provider: settings.int_email_provider ?? "sendgrid",
        apiKey: "",
        from: settings.int_email_from ?? "",
        fromName: settings.int_email_fromName ?? "MediCore Hospital",
      });
      setTestResult(null);
    }
    if (id === "gcal") {
      setGc({ calendarId: settings.int_gcal_calendarId ?? "", clientId: settings.int_gcal_clientId ?? "" });
      setTestResult(null);
    }
    if (id === "video") {
      setVd({ provider: settings.int_video_provider ?? "jitsi", apiKey: "" });
      setVideoLink(null);
      setTestResult(null);
    }
    setOpen(id);
  };

  const audit = (action: string, details: string) =>
    logIntegrationAudit({ actor: currentUser.name, actorEmail: currentUser.email, action, branch: currentUser.branch, details });

  const saveKeys = async (pairs: [string, string][], okMsg: string) => {
    setSaving(true);
    try {
      const results = await Promise.all(pairs.map(([k, v]) => Promise.resolve(onSave(k, v))));
      const failed: any = results.find((r: any) => r && r.ok === false);
      if (failed) throw new Error(failed.error || "Failed to save.");
      toast({ title: "Saved", description: okMsg });
      return true;
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (id: IntegrationId, v: boolean) => {
    if (id === "payment") {
      await Promise.resolve(onSave("razorpayMode", v ? (settings.razorpayMode && settings.razorpayMode !== "disabled" ? settings.razorpayMode : "test") : "disabled"));
      toast({ title: v ? "Payments enabled" : "Payments disabled", description: v ? "Online checkout uses Settings → General → Online Payments keys." : "UPI checkout is turned off." });
      audit("INTEGRATION_PAYMENT_TOGGLE", `Payment gateway ${v ? "enabled" : "disabled"} by ${currentUser.name}.`);
      return;
    }
    await Promise.resolve(onSave(`int_${id}_enabled`, String(v)));
    toast({ title: v ? "Integration enabled" : "Integration disabled" });
  };

  const disconnect = async (id: IntegrationId) => {
    if (id === "payment") {
      await Promise.resolve(onSave("razorpayMode", "disabled"));
      toast({ title: "Payment gateway disconnected", description: "Mode set to Disabled. Keys are kept for later." });
      audit("INTEGRATION_PAYMENT_DISCONNECT", `Payment gateway disabled by ${currentUser.name}.`);
      return;
    }
    const keys: Record<IntegrationId, string[]> = {
      whatsapp: ["int_whatsapp_enabled", "int_whatsapp_phoneId", "int_whatsapp_token", "int_whatsapp_template"],
      sms: ["int_sms_enabled", "int_sms_sid", "int_sms_token", "int_sms_from", "int_sms_sender"],
      email: ["int_email_enabled", "int_email_apiKey", "int_email_from", "int_email_fromName"],
      payment: [],
      gcal: ["int_gcal_enabled", "int_gcal_calendarId", "int_gcal_clientId"],
      video: ["int_video_enabled", "int_video_apiKey"],
    };
    const pairs: [string, string][] = keys[id].map((k) => [k, k.endsWith("_enabled") ? "false" : ""]);
    await saveKeys(pairs, "Integration disconnected and credentials cleared.");
    audit(`INTEGRATION_${id.toUpperCase()}_DISCONNECT`, `${id} disconnected by ${currentUser.name}.`);
  };

  const runTest = async (url: string, payload: Record<string, unknown>, lastTestKey: string) => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Test failed.");
      const detail = body.simulated ? `Delivered (simulated). ${body.detail ?? ""}` : body.detail || body.messageId || body.sid ? `Delivered. ${body.detail ?? body.messageId ?? body.sid ?? ""}` : "Delivered successfully.";
      setTestResult(detail);
      await Promise.resolve(onSave(lastTestKey, new Date().toISOString()));
      toast({ title: "Test successful", description: detail });
      return body;
    } catch (e: any) {
      setTestResult(`Failed: ${e.message}`);
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setTesting(false);
    }
  };

  const syncCalendar = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/gcal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "sync", branch: currentUser.branch }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Sync failed.");
      await Promise.resolve(onSave("int_gcal_lastSync", new Date().toISOString()));
      audit("INTEGRATION_GCAL_SYNC", `${body.count ?? 0} appointments exported by ${currentUser.name}.`);
      if (body.ics) {
        const blob = new Blob([body.ics], { type: "text/calendar" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "medicore-appointments.ics";
        a.click();
        URL.revokeObjectURL(a.href);
      }
      toast({ title: "Calendar synced", description: `${body.count ?? 0} upcoming appointments exported as .ics — import it into Google Calendar.` });
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  const createVideo = async () => {
    const body = await runTest("/api/integrations/video", { action: "create", topic: vdTopic || "Consultation" }, "int_video_lastTest");
    if (body?.joinUrl) {
      setVideoLink(body.joinUrl);
      audit("INTEGRATION_VIDEO_CREATE", `Video link created (${body.provider}) by ${currentUser.name}.`);
    }
  };

  const st = (id: IntegrationId) => integrationStatus(id, settings);

  const cards: { id: IntegrationId; icon: any; testLabel?: string; extraAction?: React.ReactNode }[] = [
    { id: "whatsapp", icon: MessageSquare, testLabel: "Send test" },
    { id: "sms", icon: MessageSquare, testLabel: "Send test SMS" },
    { id: "email", icon: Mail, testLabel: "Send test email" },
    { id: "payment", icon: CreditCard },
    { id: "gcal", icon: Calendar },
    { id: "video", icon: Video },
  ];

  const names: Record<IntegrationId, { name: string; desc: string }> = {
    whatsapp: { name: "WhatsApp Business", desc: "Meta Cloud API appointment & report alerts" },
    sms: { name: "SMS Gateway", desc: "Twilio / MSG91 OTP & reminders" },
    email: { name: "Email SMTP", desc: "SendGrid / SMTP receipts & reports" },
    payment: { name: "Payment Gateway", desc: "Razorpay UPI online checkout" },
    gcal: { name: "Google Calendar", desc: "Export + sync appointments" },
    video: { name: "Video Consultation", desc: "Jitsi / Zoom visit links" },
  };

  return (
    <div className="space-y-4">
      <BroadcastComposer settings={settings} />
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const s = st(c.id);
          const Icon = c.icon;
          const lastKey = c.id === "gcal" ? settings.int_gcal_lastSync : (settings as any)[`int_${c.id}_lastTest`];
          const last = fmtTime(lastKey);
          return (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge
                    variant="outline"
                    className={s.state === "Connected" ? "text-success border-success/20 bg-success/10" : s.state === "Disabled" ? "text-warning border-warning/20 bg-warning/10" : "text-muted-foreground"}
                  >
                    {s.state}
                  </Badge>
                </div>
                <p className="text-sm font-semibold">{names[c.id].name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{names[c.id].desc}</p>
                {c.id === "payment" && (
                  <p className="text-[11px] text-muted-foreground mt-1">Mode: <span className="font-semibold text-foreground">{settings.razorpayMode ?? "disabled"}</span>{settings.razorpayKeyId ? " • key saved" : " • no key"}</p>
                )}
                {c.id !== "payment" && last && <p className="text-[11px] text-muted-foreground mt-1">Last tested: {last}</p>}
                {c.id === "gcal" && fmtTime(settings.int_gcal_lastSync) && <p className="text-[11px] text-muted-foreground mt-0.5">Last sync: {fmtTime(settings.int_gcal_lastSync)}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <Switch checked={s.enabled} onCheckedChange={(v) => toggleEnabled(c.id, v)} aria-label={`Enable ${names[c.id].name}`} />
                  <span className="text-[11px] text-muted-foreground">{s.enabled ? "Enabled" : "Off"}</span>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => (c.id === "payment" && onGotoPayments ? onGotoPayments() : openDialog(c.id))}>
                    {s.configured || c.id === "payment" ? "Configure" : "Connect"}
                  </Button>
                  {s.configured && c.id !== "payment" && (
                    <Button variant="ghost" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={() => disconnect(c.id)}>
                      Disconnect
                    </Button>
                  )}
                </div>
                {c.id === "gcal" && s.enabled && (
                  <Button variant="secondary" size="sm" className="w-full mt-2 text-xs" disabled={testing} onClick={syncCalendar}>
                    <Download className="h-3.5 w-3.5 mr-1.5" /> {testing ? "Syncing…" : "Sync now (.ics)"}
                  </Button>
                )}
                {c.id === "video" && s.enabled && (
                  <Button variant="secondary" size="sm" className="w-full mt-2 text-xs" onClick={() => openDialog("video")}>
                    <Video className="h-3.5 w-3.5 mr-1.5" /> Generate meeting link
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activity.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-semibold mb-2">Recent integration activity</p>
            <div className="space-y-1.5">
              {activity.map((r: any) => (
                <p key={r.id} className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{String(r.action).replace(/_/g, " ")}</span> — {r.details} <span className="opacity-70">({r.timestamp ? new Date(r.timestamp).toLocaleString("en-IN") : ""})</span>
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===== WhatsApp dialog ===== */}
      <Dialog open={open === "whatsapp"} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>WhatsApp Business</DialogTitle><DialogDescription>Meta Cloud API. Get Phone Number ID + token from Meta Developers → WhatsApp → API Setup. Without keys, tests run simulated.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Phone Number ID"><Input className="h-9 font-mono text-xs" placeholder="e.g. 123456789012345" value={wa.phoneId} onChange={(e) => setWa({ ...wa, phoneId: e.target.value.trim() })} /></Field>
            <Field label="Access Token (server-only, hidden after save)" hint={SECRET_PLACEHOLDER}>
              <div className="flex gap-1.5">
                <Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} placeholder="EAA…" value={wa.token} onChange={(e) => setWa({ ...wa, token: e.target.value.trim() })} />
                <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setShowSecrets((s) => !s)}>{showSecrets ? "Hide" : "Show"}</Button>
              </div>
            </Field>
            <Field label="Template name" hint="Approved utility template, e.g. hello_world"><Input className="h-9" value={wa.template} onChange={(e) => setWa({ ...wa, template: e.target.value.trim() })} /></Field>
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Send a test message</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input className="h-9" placeholder="Recipient: 919876543210" value={waTest.to} onChange={(e) => setWaTest({ ...waTest, to: e.target.value })} />
                <Input className="h-9" placeholder="Message (optional)" value={waTest.message} onChange={(e) => setWaTest({ ...waTest, message: e.target.value })} />
              </div>
              <Button size="sm" variant="secondary" disabled={testing} onClick={() => runTest("/api/integrations/whatsapp", { action: "test", to: waTest.to, message: waTest.message }, "int_whatsapp_lastTest")}>{testing ? "Sending…" : "Send test"}</Button>
            </div>
            {testResult && <p className={`text-xs rounded-lg border p-2 ${testResult.startsWith("Failed") ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5"}`}>{testResult}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={saving} onClick={async () => {
              const pairs: [string, string][] = [["int_whatsapp_enabled", "true"], ["int_whatsapp_phoneId", wa.phoneId.trim()], ["int_whatsapp_template", wa.template.trim() || "hello_world"]];
              if (wa.token.trim()) pairs.push(["int_whatsapp_token", wa.token.trim()]);
              const ok = await saveKeys(pairs, "WhatsApp connected and enabled.");
              if (ok) { audit("INTEGRATION_WHATSAPP_SAVE", `WhatsApp configured by ${currentUser.name}.`); setOpen(null); }
            }}>{saving ? "Saving…" : "Save & Enable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== SMS dialog ===== */}
      <Dialog open={open === "sms"} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>SMS Gateway</DialogTitle><DialogDescription>Twilio or MSG91. Without keys, tests run simulated.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Provider">
              <Select value={sms.provider} onValueChange={(v) => setSms({ ...sms, provider: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="twilio">Twilio</SelectItem><SelectItem value="msg91">MSG91</SelectItem></SelectContent>
              </Select>
            </Field>
            {sms.provider === "twilio" ? (
              <>
                <Field label="Account SID"><Input className="h-9 font-mono text-xs" value={sms.sid} onChange={(e) => setSms({ ...sms, sid: e.target.value.trim() })} placeholder="AC…" /></Field>
                <Field label="Auth Token (server-only)" hint={SECRET_PLACEHOLDER}><Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} value={sms.token} onChange={(e) => setSms({ ...sms, token: e.target.value.trim() })} placeholder="Enter to set/update" /></Field>
                <Field label="From number" hint="Twilio number, e.g. +14155552671"><Input className="h-9 font-mono text-xs" value={sms.from} onChange={(e) => setSms({ ...sms, from: e.target.value.trim() })} /></Field>
              </>
            ) : (
              <>
                <Field label="MSG91 AuthKey (server-only)" hint={SECRET_PLACEHOLDER}><Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} value={sms.token} onChange={(e) => setSms({ ...sms, token: e.target.value.trim() })} placeholder="Enter to set/update" /></Field>
                <Field label="Sender ID" hint="6-char approved sender, e.g. MEDICR"><Input className="h-9" value={sms.sender} onChange={(e) => setSms({ ...sms, sender: e.target.value.trim() })} /></Field>
              </>
            )}
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Send a test SMS</p>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input className="h-9" placeholder="Recipient: 919876543210" value={smsTest.to} onChange={(e) => setSmsTest({ ...smsTest, to: e.target.value })} />
                <Input className="h-9" placeholder="Message (optional)" value={smsTest.message} onChange={(e) => setSmsTest({ ...smsTest, message: e.target.value })} />
              </div>
              <Button size="sm" variant="secondary" disabled={testing} onClick={() => runTest("/api/integrations/sms", { action: "test", to: smsTest.to, message: smsTest.message }, "int_sms_lastTest")}>{testing ? "Sending…" : "Send test SMS"}</Button>
            </div>
            {testResult && <p className={`text-xs rounded-lg border p-2 ${testResult.startsWith("Failed") ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5"}`}>{testResult}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={saving} onClick={async () => {
              const pairs: [string, string][] = [["int_sms_enabled", "true"], ["int_sms_provider", sms.provider], ["int_sms_sid", sms.sid.trim()], ["int_sms_from", sms.from.trim()], ["int_sms_sender", sms.sender.trim() || "MEDICR"]];
              if (sms.token.trim()) pairs.push(["int_sms_token", sms.token.trim()]);
              const ok = await saveKeys(pairs, `${sms.provider === "msg91" ? "MSG91" : "Twilio"} SMS connected and enabled.`);
              if (ok) { audit("INTEGRATION_SMS_SAVE", `SMS (${sms.provider}) configured by ${currentUser.name}.`); setOpen(null); }
            }}>{saving ? "Saving…" : "Save & Enable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Email dialog ===== */}
      <Dialog open={open === "email"} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Email (SMTP / SendGrid)</DialogTitle><DialogDescription>SendGrid delivers for real with an API key. SMTP/SES configs are stored and simulated.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Provider">
              <Select value={em.provider} onValueChange={(v) => setEm({ ...em, provider: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="sendgrid">SendGrid</SelectItem><SelectItem value="smtp">Generic SMTP</SelectItem><SelectItem value="ses">AWS SES</SelectItem></SelectContent>
              </Select>
            </Field>
            <Field label={em.provider === "sendgrid" ? "SendGrid API Key (server-only)" : "SMTP / SES credential (server-only)"} hint={SECRET_PLACEHOLDER}>
              <Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} value={em.apiKey} onChange={(e) => setEm({ ...em, apiKey: e.target.value.trim() })} placeholder="Enter to set/update" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-2">
              <Field label="From email"><Input className="h-9" value={em.from} onChange={(e) => setEm({ ...em, from: e.target.value.trim() })} placeholder="noreply@hospital.com" /></Field>
              <Field label="From name"><Input className="h-9" value={em.fromName} onChange={(e) => setEm({ ...em, fromName: e.target.value })} /></Field>
            </div>
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Send a test email</p>
              <Input className="h-9" placeholder="Recipient email" value={emTest.to} onChange={(e) => setEmTest({ ...emTest, to: e.target.value })} />
              <Input className="h-9" placeholder="Subject (optional)" value={emTest.subject} onChange={(e) => setEmTest({ ...emTest, subject: e.target.value })} />
              <Textarea rows={2} placeholder="Message (optional)" value={emTest.message} onChange={(e) => setEmTest({ ...emTest, message: e.target.value })} />
              <Button size="sm" variant="secondary" disabled={testing} onClick={() => runTest("/api/integrations/email", { action: "test", to: emTest.to, subject: emTest.subject, message: emTest.message }, "int_email_lastTest")}>{testing ? "Sending…" : "Send test email"}</Button>
            </div>
            {testResult && <p className={`text-xs rounded-lg border p-2 ${testResult.startsWith("Failed") ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5"}`}>{testResult}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={saving} onClick={async () => {
              if (!em.from.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em.from.trim())) { toast({ title: "Invalid From email", description: "Enter a valid sender address.", variant: "destructive" }); return; }
              const pairs: [string, string][] = [["int_email_enabled", "true"], ["int_email_provider", em.provider], ["int_email_from", em.from.trim()], ["int_email_fromName", em.fromName.trim() || "MediCore Hospital"]];
              if (em.apiKey.trim()) pairs.push(["int_email_apiKey", em.apiKey.trim()]);
              const ok = await saveKeys(pairs, "Email integration connected and enabled.");
              if (ok) { audit("INTEGRATION_EMAIL_SAVE", `Email (${em.provider}) configured by ${currentUser.name}.`); setOpen(null); }
            }}>{saving ? "Saving…" : "Save & Enable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Google Calendar dialog ===== */}
      <Dialog open={open === "gcal"} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Google Calendar</DialogTitle><DialogDescription>Label exports with your calendar, then Sync now downloads upcoming appointments as .ics for one-click import.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Calendar ID" hint="Usually your Gmail address; find it in Google Calendar → Settings"><Input className="h-9" value={gc.calendarId} onChange={(e) => setGc({ ...gc, calendarId: e.target.value.trim() })} placeholder="clinic@gmail.com" /></Field>
            <Field label="Client ID (optional)" hint="Google Cloud OAuth client — stored for future auto-push"><Input className="h-9 font-mono text-xs" value={gc.clientId} onChange={(e) => setGc({ ...gc, clientId: e.target.value.trim() })} placeholder="…apps.googleusercontent.com" /></Field>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={testing} onClick={async () => { await runTest("/api/integrations/gcal", { action: "test" }, "int_gcal_lastTest"); }}>{testing ? "Testing…" : "Test connection"}</Button>
              <Button size="sm" variant="outline" disabled={testing} onClick={syncCalendar}><Download className="h-3.5 w-3.5 mr-1.5" /> Sync now</Button>
            </div>
            {testResult && <p className={`text-xs rounded-lg border p-2 ${testResult.startsWith("Failed") ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-success/40 bg-success/5"}`}>{testResult}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={saving} onClick={async () => {
              const ok = await saveKeys([["int_gcal_enabled", "true"], ["int_gcal_calendarId", gc.calendarId.trim()], ["int_gcal_clientId", gc.clientId.trim()]], "Google Calendar connected and enabled.");
              if (ok) { audit("INTEGRATION_GCAL_SAVE", `Calendar target ${gc.calendarId || "(none)"} saved by ${currentUser.name}.`); setOpen(null); }
            }}>{saving ? "Saving…" : "Save & Enable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Video dialog ===== */}
      <Dialog open={open === "video"} onOpenChange={(v) => { if (!v) setOpen(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Video Consultation</DialogTitle><DialogDescription>Jitsi works instantly with no keys. Zoom/Twilio need an API key for real meetings.</DialogDescription></DialogHeader>
          <div className="space-y-3">
            <Field label="Provider">
              <Select value={vd.provider} onValueChange={(v) => setVd({ ...vd, provider: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="jitsi">Jitsi (free, no key)</SelectItem><SelectItem value="zoom">Zoom</SelectItem><SelectItem value="twilio">Twilio Video</SelectItem></SelectContent>
              </Select>
            </Field>
            {vd.provider !== "jitsi" && (
              <Field label={`${vd.provider === "zoom" ? "Zoom" : "Twilio"} API key / token (server-only)`} hint={SECRET_PLACEHOLDER}>
                <Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} value={vd.apiKey} onChange={(e) => setVd({ ...vd, apiKey: e.target.value.trim() })} placeholder="Enter to set/update" />
              </Field>
            )}
            <Field label="Meeting topic"><Input className="h-9" value={vdTopic} onChange={(e) => setVdTopic(e.target.value)} placeholder="e.g. Follow-up — Ravi Kumar" /></Field>
            <Button size="sm" variant="secondary" disabled={testing} onClick={createVideo}>{testing ? "Creating…" : "Generate meeting link"}</Button>
            {videoLink && (
              <div className="rounded-lg border border-success/40 bg-success/5 p-2.5 flex items-center gap-2">
                <p className="text-xs font-mono break-all flex-1">{videoLink}</p>
                <Button size="sm" variant="outline" className="h-7 shrink-0" onClick={() => { navigator.clipboard?.writeText(videoLink); toast({ title: "Link copied" }); }}><Copy className="h-3 w-3 mr-1" /> Copy</Button>
              </div>
            )}
            {testResult && !videoLink && <p className="text-xs text-muted-foreground">{testResult}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(null)}>Close</Button>
            <Button size="sm" disabled={saving} onClick={async () => {
              const pairs: [string, string][] = [["int_video_enabled", "true"], ["int_video_provider", vd.provider]];
              if (vd.apiKey.trim()) pairs.push(["int_video_apiKey", vd.apiKey.trim()]);
              const ok = await saveKeys(pairs, `${vd.provider} video enabled.`);
              if (ok) { audit("INTEGRATION_VIDEO_SAVE", `Video provider ${vd.provider} saved by ${currentUser.name}.`); setOpen(null); }
            }}>{saving ? "Saving…" : "Save & Enable"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function IntegrationStatusDot({ id, settings }: { id: IntegrationId; settings: Record<string, string> }) {
  const s = integrationStatus(id, settings);
  return s.state === "Connected" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}
