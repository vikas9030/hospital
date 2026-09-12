import { NextRequest, NextResponse } from "next/server";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { fetchAppSettings, upsertAppSetting, deleteAppSetting, fetchUsers } from "@/lib/supabase-data";

// Two-factor login codes. State lives in app_settings under a key containing
// "secret" so GET /api/settings never exposes it to browsers; only the salted
// SHA-256 hash is stored, never the raw code.

const EXPIRY_MS = 10 * 60 * 1000;
const RESEND_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;

const keyOf = (email: string) =>
  `otp_secret_${createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 32)}`;

const maskEmail = (e: string) => {
  const [u, d] = e.split("@");
  if (!d) return "***";
  return `${u.slice(0, 1)}***@${d}`;
};
const maskPhone = (p: string) => `*****${p.replace(/\D/g, "").slice(-4)}`;

async function deliverEmail(to: string, code: string): Promise<boolean> {
  const s = await fetchAppSettings();
  if ((s.int_email_enabled ?? "false") !== "true") return false;
  if ((s.int_email_provider ?? "sendgrid").toLowerCase() !== "sendgrid") return false;
  const apiKey = (s.int_email_apiKey ?? "").trim();
  const from = (s.int_email_from ?? "").trim();
  if (!apiKey || !from) return false;
  const fromName = (s.int_email_fromName ?? "MediCore Hospital").trim() || "MediCore Hospital";
  const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject: "MediCore login code" }],
      from: { email: from, name: fromName },
      content: [{ type: "text/plain", value: `Your MediCore login code is ${code}. It expires in 10 minutes. Never share it.` }],
    }),
  });
  return res.ok;
}

async function deliverSms(to: string, code: string): Promise<boolean> {
  const s = await fetchAppSettings();
  if ((s.int_sms_enabled ?? "false") !== "true") return false;
  const text = `MediCore login code: ${code}. Valid 10 minutes.`;
  const provider = (s.int_sms_provider ?? "twilio").toLowerCase();
  const token = (s.int_sms_token ?? "").trim();
  if (provider === "msg91") {
    if (!token) return false;
    const sender = (s.int_sms_sender ?? "MEDICR").trim() || "MEDICR";
    const res = await fetch("https://control.msg91.com/api/v5/flow/sms", {
      method: "POST",
      headers: { authkey: token, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, mobiles: to, message: text }),
    });
    return res.ok;
  }
  const sid = (s.int_sms_sid ?? "").trim();
  const from = (s.int_sms_from ?? "").trim();
  if (!sid || !token || !from) return false;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: to.startsWith("+") ? to : `+${to}`, From: from, Body: text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return res.ok;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "", email = "", code = "" } = body as { action?: string; email?: string; code?: string };
    const addr = email.trim().toLowerCase();
    if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      return NextResponse.json({ error: "Valid email is required." }, { status: 400 });
    }
    const key = keyOf(addr);

    if (action === "request") {
      const settings = await fetchAppSettings();
      const existing = (() => {
        try {
          return settings[key] ? JSON.parse(settings[key]) : null;
        } catch {
          return null;
        }
      })();
      if (existing?.lastSent && Date.now() - existing.lastSent < RESEND_MS) {
        const wait = Math.ceil((RESEND_MS - (Date.now() - existing.lastSent)) / 1000);
        return NextResponse.json({ error: `Wait ${wait}s before requesting a new code.`, retryAfter: wait }, { status: 429 });
      }
      const otp = String(randomInt(100000, 1000000));
      const salt = randomBytes(16).toString("hex");
      const hash = createHash("sha256").update(`${salt}:${otp}`).digest("hex");
      await upsertAppSetting(key, JSON.stringify({ salt, hash, exp: Date.now() + EXPIRY_MS, attempts: 0, lastSent: Date.now() }));

      // Prefer email, fall back to the account's phone over SMS.
      let delivered: "email" | "sms" | "none" = "none";
      let destination = "";
      if (await deliverEmail(addr, otp)) {
        delivered = "email";
        destination = maskEmail(addr);
      } else {
        let phone = "";
        try {
          const users = await fetchUsers();
          phone = String((users as any[]).find((u) => String(u.email || "").toLowerCase() === addr)?.phone || "").trim();
        } catch {
          phone = "";
        }
        if (phone && (await deliverSms(phone, otp))) {
          delivered = "sms";
          destination = maskPhone(phone);
        }
      }
      if (delivered !== "none") return NextResponse.json({ ok: true, delivered, destination });
      // Demo fallback: no delivery channel is configured (correct password was
      // already verified client-side before this call), so hand the code back
      // to display on screen. Real deployments deliver it via Email/SMS.
      return NextResponse.json({
        ok: true,
        delivered: "none",
        devCode: otp,
        hint: "No Email/SMS delivery is configured — enable one in Settings → Integrations for true two-factor delivery.",
      });
    }

    if (action === "verify") {
      const settings = await fetchAppSettings();
      let saved: any = null;
      try {
        saved = settings[key] ? JSON.parse(settings[key]) : null;
      } catch {
        saved = null;
      }
      if (!saved) return NextResponse.json({ error: "No code was requested. Request a new one." }, { status: 400 });
      if (Date.now() > saved.exp) {
        await deleteAppSetting(key).catch(() => {});
        return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 400 });
      }
      if ((saved.attempts ?? 0) >= MAX_ATTEMPTS) {
        await deleteAppSetting(key).catch(() => {});
        return NextResponse.json({ error: "Too many attempts. Request a new code." }, { status: 429 });
      }
      const digest = createHash("sha256").update(`${saved.salt}:${code.trim()}`).digest("hex");
      if (digest !== saved.hash) {
        const attempts = (saved.attempts ?? 0) + 1;
        await upsertAppSetting(key, JSON.stringify({ ...saved, attempts })).catch(() => {});
        return NextResponse.json({ error: `Wrong code. ${MAX_ATTEMPTS - attempts} attempt${MAX_ATTEMPTS - attempts === 1 ? "" : "s"} left.` }, { status: 400 });
      }
      await deleteAppSetting(key).catch(() => {});
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "OTP request failed." }, { status: 500 });
  }
}
