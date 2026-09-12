import { createHash, createHmac, timingSafeEqual } from "node:crypto";

// Patient portal credential + session-token helpers (server-side only).
// Passwords are SHA-256 hashed; portal sessions are HMAC-signed tokens
// carrying the patient id (no dependency on staff auth).

export const DEFAULT_TEMP_PASSWORD = "12345678";
export const MIN_PORTAL_PASSWORD = 8;

function portalSecret(): string {
  return process.env.PORTAL_SECRET || "medicore-portal-dev-secret-change-me";
}

export function hashPortalPassword(password: string): string {
  return createHash("sha256").update(`medicore-portal::${password}`).digest("hex");
}

export function verifyPortalPassword(password: string, hash: string): boolean {
  try {
    const a = Buffer.from(hashPortalPassword(password));
    const b = Buffer.from(hash);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function signPortalToken(patientId: string): string {
  const sig = createHmac("sha256", portalSecret()).update(patientId).digest("hex");
  return Buffer.from(`${patientId}.${sig}`).toString("base64url");
}

export function verifyPortalToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const dot = decoded.lastIndexOf(".");
    if (dot <= 0) return null;
    const patientId = decoded.slice(0, dot);
    const sig = decoded.slice(dot + 1);
    const expected = createHmac("sha256", portalSecret()).update(patientId).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return patientId;
  } catch {
    return null;
  }
}
