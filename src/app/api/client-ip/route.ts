import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const firstPublic = (v: string | null) => {
    if (!v) return "";
    for (const part of v.split(",")) {
      const p = part.trim();
      if (p && p.toLowerCase() !== "unknown") return p;
    }
    return "";
  };
  // Check proxy headers in priority order (Vercel, Netlify, CF, generic).
  const headerCandidates = [
    req.headers.get("x-forwarded-for"),
    req.headers.get("cf-connecting-ip"),
    req.headers.get("true-client-ip"),
    req.headers.get("fastly-client-ip"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-client-ip"),
  ];
  let ip = "";
  for (const h of headerCandidates) {
    ip = firstPublic(h);
    if (ip) break;
  }
  // Next.js / Node fallback when no proxy header is present (local dev).
  if (!ip) {
    const anyReq = req as unknown as { ip?: string };
    ip = (anyReq.ip || "").trim();
  }
  ip = ip || "unknown";
  // Normalize ::ffff:1.2.3.4 → 1.2.3.4 so it matches allowlist entries.
  if (ip.toLowerCase().startsWith("::ffff:")) ip = ip.slice("::ffff:".length);
  return NextResponse.json({ ip });
}
