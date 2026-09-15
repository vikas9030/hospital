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

/** Normalize for comparison: trim, lowercase, strip ::ffff: prefix,
 *  brackets, port suffix, and %zone. Maps ::1 → 127.0.0.1. */
export function normalizeIp(ip: string): string {
  let clean = (ip || "").trim().toLowerCase();
  if (!clean || clean === "unknown") return "";
  // Strip brackets like [::1] or [1.2.3.4].
  if (clean.startsWith("[") && clean.includes("]")) {
    clean = clean.slice(1, clean.indexOf("]"));
  }
  // Strip %zone (e.g. fe80::1%eth0).
  const pct = clean.indexOf("%");
  if (pct !== -1) clean = clean.slice(0, pct);
  // Strip IPv4-mapped IPv6 prefix ::ffff:1.2.3.4 → 1.2.3.4
  if (clean.startsWith("::ffff:")) clean = clean.slice("::ffff:".length);
  // Bare ::1 loopback → 127.0.0.1 so localhost matches either form.
  if (clean === "::1") return "127.0.0.1";
  // Strip a trailing :port on plain IPv4 (1.2.3.4:5678). IPv6 keeps colons.
  const v4port = clean.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (v4port) clean = v4port[1];
  return clean.trim();
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const v = parseInt(p, 10);
    if (v < 0 || v > 255) return null;
    n = n * 256 + v;
  }
  return n >>> 0;
}

/** CIDR match for IPv4, e.g. `49.204.239.0/24` or `49.204.0.0/16`. */
function cidrMatch(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = parseInt(bitsRaw, 10);
  if (!Number.isFinite(bits) || bits < 0 || bits > 32) return false;
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base.trim());
  if (ipInt === null || baseInt === null) return false;
  if (bits === 0) return true;
  const mask = bits === 32 ? 0xffffffff : (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

/** Exact match, trailing-wildcard prefixes like `192.168.1.*`,
 *  and IPv4 CIDR ranges like `49.204.239.0/24`.
 *  Comparison is normalized (::ffff: stripped, ::1 ↔ 127.0.0.1).
 *  Localhost forms are treated as equivalent. */
export function ipAllowed(ip: string, allowlist: string[]): boolean {
  const clean = normalizeIp(ip);
  if (!clean) return false;
  const candidates =
    clean === "127.0.0.1" ? [clean, "::1"] : clean === "::1" ? ["::1", "127.0.0.1"] : [clean];
  return allowlist.some((rule) => {
    const r = rule.trim().toLowerCase();
    if (!r) return false;
    if (r.endsWith("*")) {
      const prefix = normalizeIp(r.slice(0, -1));
      return candidates.some((c) => c.startsWith(prefix));
    }
    if (r.includes("/")) {
      return cidrMatch(clean, r);
    }
    const norm = normalizeIp(r);
    return candidates.includes(norm) || clean === norm;
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
