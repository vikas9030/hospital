"use client";

import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import {
  ShieldCheck, KeyRound, Timer, Globe2, ScrollText, Lock, RefreshCw, Download, Trash2, Plus, X,
} from "lucide-react";
import {
  SEC_KEYS, isTwoFactorEnabled, isSessionTimeoutEnabled, sessionTimeoutMinutes,
  isIpWhitelistEnabled, isAuditEnabled, isEncryptionEnabled,
  parseAllowlist, ipAllowed, fetchClientIp, timeAgo,
} from "@/lib/security";
import { persistedBlobStatus, setEncryptionFlag, type BlobStatus } from "@/lib/secure-storage";

type SaveFn = (key: string, value: string) => Promise<{ ok: boolean; error?: string } | void> | void;

function Row({ icon: Icon, title, desc, checked, onToggle, children }: {
  icon: any; title: string; desc: string; checked: boolean; onToggle: (v: boolean) => void; children?: React.ReactNode;
}) {
  return (
    <div className="p-3 rounded-lg border space-y-2">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
        <Switch checked={checked} onCheckedChange={onToggle} aria-label={title} />
      </div>
      {children}
    </div>
  );
}

export function SecurityTab({ settings, onSave }: { settings: Record<string, string>; onSave: SaveFn }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const clearAuditLogs = useAppStore((s) => s.clearAuditLogs);
  const localLogs = useAppStore((s) => s.auditLogs);

  const [myIp, setMyIp] = useState<string | null>(null);
  const [newIp, setNewIp] = useState("");
  const [saving, setSaving] = useState(false);
  const [blob, setBlob] = useState<BlobStatus>(() => persistedBlobStatus());
  const [serverLogs, setServerLogs] = useState<any[]>([]);
  const [logQuery, setLogQuery] = useState("");
  const [logAction, setLogAction] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const minutesRef = useRef<HTMLInputElement>(null);

  const refreshIp = async () => setMyIp(await fetchClientIp());

  const auditSelf = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "security", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "security", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };

  const toggle = async (key: string, label: string, v: boolean, after?: () => void) => {
    const r: any = await Promise.resolve(onSave(key, String(v)));
    if (r && r.ok === false) {
      toast({ title: "Could not save", description: r.error, variant: "destructive" });
      return;
    }
    after?.();
    auditSelf("SECURITY_SETTING_CHANGED", `${currentUser.name} turned ${label} ${v ? "ON" : "OFF"}.`);
    toast({ title: `${label} ${v ? "enabled" : "disabled"}` });
  };

  const allowlist = parseAllowlist(settings[SEC_KEYS.ipAllowlist]);
  const ipOk = myIp ? ipAllowed(myIp, allowlist) : null;

  const saveAllowlist = async (list: string[]) => {
    setSaving(true);
    try {
      const r: any = await Promise.resolve(onSave(SEC_KEYS.ipAllowlist, JSON.stringify(list)));
      if (r && r.ok === false) throw new Error(r.error || "Failed to save.");
      auditSelf("SECURITY_IP_LIST_CHANGED", `${currentUser.name} updated the IP allowlist (${list.length} entr${list.length === 1 ? "y" : "ies"}).`);
      toast({ title: "Allowlist saved", description: `${list.length} IP${list.length === 1 ? "" : "s"} allowed.` });
      setNewIp("");
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const enableWhitelist = async (v: boolean) => {
    if (v && allowlist.length === 0) {
      // Anti-lockout: the machine enabling the lock is always allowed in.
      const ip = myIp ?? (await fetchClientIp());
      setMyIp(ip);
      if (ip && ip !== "unknown") {
        await saveAllowlist([ip]);
      }
    }
    await toggle(SEC_KEYS.ipWhitelist, "IP whitelisting", v);
  };

  const toggleEncryption = async (v: boolean) => {
    setEncryptionFlag(v);
    const r: any = await Promise.resolve(onSave(SEC_KEYS.dataEncryption, String(v)));
    if (r && r.ok === false) {
      setEncryptionFlag(!v);
      toast({ title: "Could not save", description: r.error, variant: "destructive" });
      return;
    }
    // Force the persisted blob to rewrite in the new format immediately.
    useAppStore.setState({});
    setBlob(persistedBlobStatus());
    auditSelf("SECURITY_SETTING_CHANGED", `${currentUser.name} turned Data Encryption ${v ? "ON (local data is AES-256-GCM encrypted)" : "OFF (local data is stored plain)"}.`);
    toast({ title: v ? "Encryption enabled" : "Encryption disabled", description: v ? "Local data at rest is now AES-256-GCM encrypted." : "Local data will be stored unencrypted." });
  };

  const saveMinutes = async () => {
    const n = parseInt(minutesRef.current?.value ?? "", 10);
    if (!Number.isFinite(n) || n < 5 || n > 480) {
      toast({ title: "Invalid value", description: "Enter 5–480 minutes.", variant: "destructive" });
      return;
    }
    const r: any = await Promise.resolve(onSave(SEC_KEYS.sessionMinutes, String(n)));
    if (r && r.ok === false) {
      toast({ title: "Could not save", description: r.error, variant: "destructive" });
      return;
    }
    auditSelf("SECURITY_SETTING_CHANGED", `${currentUser.name} set session timeout to ${n} minutes.`);
    toast({ title: "Session timeout saved", description: `Inactive sessions end after ${n} minutes.` });
  };

  const loadServerLogs = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/audit");
      if (!res.ok) throw new Error("Could not reach the audit API.");
      const data = await res.json();
      setServerLogs(Array.isArray(data) ? data : []);
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    } finally {
      setRefreshing(false);
    }
  };

  const merged = useMemo(() => {
    const byId = new Map<string, any>();
    for (const l of [...localLogs, ...serverLogs]) {
      const id = String(l.id ?? `${l.timestamp}-${l.action}-${l.actor}`);
      if (!byId.has(id)) byId.set(id, l);
    }
    return Array.from(byId.values()).sort((a, b) => String(b.timestamp || "").localeCompare(String(a.timestamp || "")));
  }, [localLogs, serverLogs]);

  const actions = useMemo(() => Array.from(new Set(merged.map((l) => String(l.action || "UNKNOWN")))).sort().slice(0, 100), [merged]);

  const filtered = merged.filter((l) => {
    if (logAction !== "all" && String(l.action) !== logAction) return false;
    const q = logQuery.trim().toLowerCase();
    if (!q) return true;
    return `${l.actor ?? ""} ${l.actorEmail ?? ""} ${l.action ?? ""} ${l.details ?? ""} ${l.target ?? ""} ${l.branch ?? ""}`.toLowerCase().includes(q);
  });

  const exportCsv = () => {
    const rows = [["Timestamp", "Actor", "Email", "Action", "Target", "Branch", "Details"]];
    for (const l of filtered.slice(0, 1000)) {
      rows.push([l.timestamp ?? "", l.actor ?? "", l.actorEmail ?? "", l.action ?? "", l.target ?? "", l.branch ?? "", (l.details ?? "").replace(/\s+/g, " ")]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "audit-log.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const auditOn = isAuditEnabled(settings);

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 [&>*]:min-w-0">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Security Settings</CardTitle>
          <CardDescription className="text-xs">Every switch enforces immediately — login, sessions, storage and logging.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row icon={KeyRound} title="Two-Factor Authentication" desc="Require a 6-digit code at login, delivered via your Email/SMS integration" checked={isTwoFactorEnabled(settings)} onToggle={(v) => toggle(SEC_KEYS.twoFactor, "Two-factor authentication", v)}>
            <p className="text-[11px] text-muted-foreground pl-11">Codes expire in 10 minutes (5 attempts). Without a delivery channel the code shows on-screen demo-style.</p>
          </Row>

          <Row icon={Timer} title="Session Timeout" desc={`Auto sign-out after inactivity (currently ${sessionTimeoutMinutes(settings)} min)`} checked={isSessionTimeoutEnabled(settings)} onToggle={(v) => toggle(SEC_KEYS.sessionTimeout, "Session timeout", v)}>
            <div className="flex items-center gap-2 pl-11">
              <Input ref={minutesRef} type="number" min={5} max={480} defaultValue={settings[SEC_KEYS.sessionMinutes] ?? "30"} className="h-8 w-24" />
              <span className="text-[11px] text-muted-foreground">minutes (5–480)</span>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={saveMinutes}>Save</Button>
            </div>
          </Row>

          <Row icon={Globe2} title="IP Whitelisting" desc="Block sign-ins from IPs outside the allowlist" checked={isIpWhitelistEnabled(settings)} onToggle={enableWhitelist}>
            <div className="pl-11 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">Your IP: <span className="font-mono font-semibold text-foreground">{myIp ?? "—"}</span></span>
                <Button size="sm" variant="ghost" className="h-6 text-[11px] px-2" onClick={refreshIp}>Detect</Button>
                {myIp && myIp !== "unknown" && (
                  <Badge variant="outline" className={ipOk ? "text-success border-success/30" : "text-destructive border-destructive/30"}>
                    {ipOk ? "Allowed" : "Blocked"}
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                <Input className="h-8 text-xs font-mono" placeholder="Add IP, e.g. 203.0.113.7 or 192.168.1.*" value={newIp} onChange={(e) => setNewIp(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newIp.trim()) saveAllowlist([...allowlist, newIp.trim()]); }} />
                <Button size="sm" variant="outline" className="h-8 shrink-0" disabled={saving || !newIp.trim()} onClick={() => saveAllowlist([...allowlist, newIp.trim()])}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                {myIp && myIp !== "unknown" && !allowlist.includes(myIp) && (
                  <Button size="sm" variant="secondary" className="h-8 shrink-0 text-xs" disabled={saving} onClick={() => saveAllowlist([...allowlist, myIp])}>Add my IP</Button>
                )}
              </div>
              {allowlist.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {allowlist.map((ip) => (
                    <span key={ip} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px]">
                      {ip}
                      <button className="text-muted-foreground hover:text-destructive" onClick={() => saveAllowlist(allowlist.filter((x) => x !== ip))} aria-label={`Remove ${ip}`}>
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">List is empty — enabling auto-adds your current IP so you don&apos;t lock yourself out.</p>
              )}
            </div>
          </Row>

          <Row icon={ScrollText} title="Audit Logging" desc="Record sign-ins, security changes and user actions" checked={auditOn} onToggle={(v) => toggle(SEC_KEYS.auditLogging, "Audit logging", v)}>
            {!auditOn && <p className="text-[11px] text-warning pl-11">Paused — new actions are not being recorded until re-enabled.</p>}
          </Row>

          <Row icon={Lock} title="Data Encryption" desc="AES-256-GCM encrypt this device's stored data" checked={isEncryptionEnabled(settings)} onToggle={toggleEncryption}>
            <div className="flex flex-wrap items-center gap-2 pl-11">
              <Badge variant="outline" className={blob === "encrypted" ? "text-success border-success/30" : blob === "plain" ? "text-warning border-warning/30" : "text-muted-foreground"}>
                On this device: {blob === "encrypted" ? "Encrypted" : blob === "plain" ? "Plain (will convert)" : blob === "empty" ? "No local data" : "Unreadable"}
              </Badge>
              <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => { useAppStore.setState({}); setBlob(persistedBlobStatus()); toast({ title: "Storage rewritten", description: `Now: ${persistedBlobStatus()}.` }); }}>
                Re-encrypt now
              </Button>
            </div>
          </Row>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><ScrollText className="h-4 w-4 text-primary" /> Audit Logs <span className="text-xs font-normal text-muted-foreground">({filtered.length})</span></CardTitle>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Refresh from server" onClick={loadServerLogs} disabled={refreshing}>
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              </Button>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Export CSV" onClick={exportCsv} disabled={filtered.length === 0}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="sm" variant="ghost" className={`h-7 text-[11px] ${confirmClear ? "text-destructive" : ""}`}
                title="Clear local log"
                onClick={() => {
                  if (!confirmClear) {
                    setConfirmClear(true);
                    setTimeout(() => setConfirmClear(false), 3000);
                    return;
                  }
                  clearAuditLogs();
                  setConfirmClear(false);
                  toast({ title: "Local audit log cleared", description: "Server-side entries are kept." });
                }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> {confirmClear ? "Confirm?" : "Clear"}
              </Button>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <Input className="h-8 text-xs" placeholder="Search actor, action, details…" value={logQuery} onChange={(e) => setLogQuery(e.target.value)} />
            <Select value={logAction} onValueChange={setLogAction}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="All actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All actions</SelectItem>
                {actions.map((a) => <SelectItem key={a} value={a}>{a.replace(/_/g, " ").slice(0, 32)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">
              {merged.length === 0 ? "No audit events yet — sign-ins and security changes will appear here." : "No events match this filter."}
              <br />
              <button className="text-primary hover:underline mt-1" onClick={loadServerLogs}>Load server history</button>
            </p>
          ) : (
            <div className="space-y-1.5 max-h-[560px] overflow-y-auto pr-1">
              {filtered.slice(0, 100).map((log: any, i: number) => (
                <div key={String(log.id ?? i)} className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/40 border-b last:border-0">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/10 text-info text-[10px] font-semibold">
                    {String(log.actor || "?").split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs"><span className="font-semibold">{log.actor || "System"}</span> <span className="text-muted-foreground">{String(log.action || "").replace(/_/g, " ")}</span></p>
                    {log.details && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{log.details}</p>}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{log.timestamp ? timeAgo(log.timestamp) : "—"}{log.branch ? ` • ${log.branch}` : ""}{log.target && log.target !== "security" ? ` • ${log.target}` : ""}</p>
                  </div>
                </div>
              ))}
              {filtered.length > 100 && <p className="text-[11px] text-muted-foreground text-center pt-1">Showing 100 of {filtered.length} — refine search or export CSV for all.</p>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
