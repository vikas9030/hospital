// Central helpers for Settings → Security. Setting keys intentionally match
// the historical `security_${slug}` keys already stored in app_settings.

const slug = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

export const SEC_KEYS = {
  twoFactor: `security_${slug("Two-Factor Authentication")}`,
  sessionTimeout: `security_${slug("Session Timeout")}`,
  ipWhitelist: `security_${slug("IP Whitelisting")}`,
  auditLogging: `security_${slug("Audit Logging")}`,
  dataEncryption: `security_${slug("Data Encryption")}`,
  sessionMinutes: "security_session_timeout_minutes",
  ipAllowlist: "security_ip_allowlist",
} as const;

export function isTwoFactorEnabled(s: Record<string, string>): boolean {
  const v = s[SEC_KEYS.twoFactor];
  return v === undefined ? true : v === "true";
}

export function isSessionTimeoutEnabled(s: Record<string, string>): boolean {
  const v = s[SEC_KEYS.sessionTimeout];
  return v === undefined ? true : v === "true";
}

export function sessionTimeoutMinutes(s: Record<string, string>): number {
  const n = parseInt(s[SEC_KEYS.sessionMinutes] ?? "30", 10);
  return Number.isFinite(n) ? Math.min(480, Math.max(5, n)) : 30;
}

export function isIpWhitelistEnabled(s: Record<string, string>): boolean {
  return (s[SEC_KEYS.ipWhitelist] ?? "false") === "true";
}

export function isAuditEnabled(s: Record<string, string>): boolean {
  const v = s[SEC_KEYS.auditLogging];
  return v === undefined ? true : v === "true";
}

export function isEncryptionEnabled(s: Record<string, string>): boolean {
  const v = s[SEC_KEYS.dataEncryption];
  return v === undefined ? true : v === "true";
}

export function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean) : [];
  } catch {
    return raw.split(/[\n,;]+/).map((x) => x.trim()).filter(Boolean);
  }
}

/** Exact match, plus trailing-wildcard prefixes like `192.168.1.*`. */
export function ipAllowed(ip: string, allowlist: string[]): boolean {
  const clean = (ip || "").trim().toLowerCase();
  if (!clean) return false;
  return allowlist.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.endsWith("*")) return clean.startsWith(r.slice(0, -1));
    return clean === r;
  });
}

export async function fetchClientIp(): Promise<string> {
  try {
    const res = await fetch("/api/client-ip", { cache: "no-store" });
    if (!res.ok) return "unknown";
    const body = await res.json().catch(() => ({}));
    return String(body.ip || "unknown");
  } catch {
    return "unknown";
  }
}

export function timeAgo(iso: string): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
