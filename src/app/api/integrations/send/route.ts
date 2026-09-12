import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting } from "@/lib/supabase-data";

export type BulkChannel = "whatsapp" | "sms" | "email";

interface Recipient {
  to: string;
  name?: string;
}

const MAX_RECIPIENTS = 100;

function fillVars(template: string, name: string): string {
  return (template || "").replace(/\{name\}/gi, name || "there");
}

// ---- per-channel single sends (mirrors the single-test routes) ----
async function sendWhatsApp(s: Record<string, string>, to: string, text: string) {
  const phoneId = (s.int_whatsapp_phoneId ?? "").trim();
  const token = (s.int_whatsapp_token ?? "").trim();
  const template = (s.int_whatsapp_template ?? "hello_world").trim() || "hello_world";
  if (!phoneId || !token) return { ok: true, simulated: true as const };
  const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
  let res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "template", template: { name: template, language: { code: "en_US" } } }),
  });
  let data: any = await res.json().catch(() => ({}));
  if (!res.ok && /template|parameter|not exist/i.test(JSON.stringify(data))) {
    res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
    });
    data = await res.json().catch(() => ({}));
  }
  if (!res.ok) throw new Error(data?.error?.message || "Meta API rejected the request.");
  return { ok: true as const, messageId: data?.messages?.[0]?.id ?? null };
}

async function sendSms(s: Record<string, string>, to: string, text: string) {
  const provider = (s.int_sms_provider ?? "twilio").toLowerCase();
  const token = (s.int_sms_token ?? "").trim();
  if (provider === "msg91") {
    if (!token) return { ok: true, simulated: true as const };
    const sender = (s.int_sms_sender ?? "MEDICR").trim() || "MEDICR";
    const res = await fetch("https://control.msg91.com/api/v5/flow/sms", {
      method: "POST",
      headers: { authkey: token, "Content-Type": "application/json" },
      body: JSON.stringify({ sender, mobiles: to, message: text }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || "MSG91 rejected the request.");
    return { ok: true as const };
  }
  const sid = (s.int_sms_sid ?? "").trim();
  const from = (s.int_sms_from ?? "").trim();
  if (!sid || !token || !from) return { ok: true, simulated: true as const };
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const form = new URLSearchParams({ To: to.startsWith("+") ? to : `+${to}`, From: from, Body: text });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || "Twilio rejected the request.");
  return { ok: true as const, sid: data?.sid ?? null };
}

async function sendEmail(s: Record<string, string>, to: string, subject: string, text: string) {
  const provider = (s.int_email_provider ?? "sendgrid").toLowerCase();
  const apiKey = (s.int_email_apiKey ?? "").trim();
  const from = (s.int_email_from ?? "").trim();
  const fromName = (s.int_email_fromName ?? "MediCore Hospital").trim() || "MediCore Hospital";
  if (!from) throw new Error("Save a From email address first.");
  if (provider === "sendgrid" && apiKey) {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: from, name: fromName },
        content: [{ type: "text/plain", value: text }],
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`SendGrid rejected the request (${res.status}). ${t.slice(0, 160)}`);
    }
    return { ok: true as const };
  }
  return { ok: true, simulated: true as const };
}

// POST { channel, recipients: [{to,name?}], message, subject? }
// Fans out one message to many recipients. {name} in the message is
// personalised per recipient.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { channel = "", recipients = [], message = "", subject = "" } = body as {
      channel?: string; recipients?: Recipient[]; message?: string; subject?: string;
    };
    if (!["whatsapp", "sms", "email"].includes(channel)) {
      return NextResponse.json({ error: "channel must be whatsapp, sms or email." }, { status: 400 });
    }
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Add at least one recipient." }, { status: 400 });
    }
    if (recipients.length > MAX_RECIPIENTS) {
      return NextResponse.json({ error: `Limit ${MAX_RECIPIENTS} recipients per send. Split the list and send again.` }, { status: 400 });
    }
    if (!message.trim() && channel !== "email") {
      return NextResponse.json({ error: "Type a message first." }, { status: 400 });
    }
    const ch = channel as BulkChannel;
    const s = await fetchAppSettings();
    const enabled = (s[`int_${ch}_enabled`] ?? "false") === "true";
    if (!enabled) {
      return NextResponse.json({ error: `The ${ch} integration is switched Off. Enable it on its card first.` }, { status: 400 });
    }

    const results: { to: string; name?: string; ok: boolean; simulated?: boolean; error?: string }[] = [];
    // Small parallel batches so 100-recipient blasts don't take forever.
    const list = recipients.slice(0, MAX_RECIPIENTS);
    for (let i = 0; i < list.length; i += 10) {
      const batch = list.slice(i, i + 10);
      const settled = await Promise.all(
        batch.map(async (r) => {
          const to = String(r.to || "").trim();
          const name = String(r.name || "").trim();
          try {
            if (!to) throw new Error("Missing contact.");
            const text = fillVars(message, name);
            if (ch === "whatsapp") {
              if (!/^\+?\d{7,15}$/.test(to.replace(/[\s-]/g, ""))) throw new Error("Invalid phone number.");
              const out: any = await sendWhatsApp(s, to, text);
              return { to, name, ok: true, simulated: out.simulated };
            }
            if (ch === "sms") {
              if (!/^\+?\d{7,15}$/.test(to.replace(/[\s-]/g, ""))) throw new Error("Invalid phone number.");
              const out: any = await sendSms(s, to, text);
              return { to, name, ok: true, simulated: out.simulated };
            }
            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error("Invalid email address.");
            const out: any = await sendEmail(s, to, subject.trim() || "Message from MediCore", text);
            return { to, name, ok: true, simulated: out.simulated };
          } catch (e: any) {
            return { to, name, ok: false, error: e.message || "Send failed." };
          }
        })
      );
      results.push(...settled);
    }

    const sent = results.filter((r) => r.ok).length;
    const simulated = results.filter((r) => r.ok && r.simulated).length;
    await upsertAppSetting(`int_${ch}_lastTest`, new Date().toISOString()).catch(() => {});
    return NextResponse.json({ ok: true, total: results.length, sent, failed: results.length - sent, simulated, results });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Broadcast failed." }, { status: 500 });
  }
}
