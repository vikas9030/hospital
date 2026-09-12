import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting } from "@/lib/supabase-data";

// POST { action: "test", to, subject?, message? }
// Uses SendGrid Web API when provider=sendgrid + apiKey exist; otherwise
// simulated success. SMTP/SES providers store config and simulate (no extra
// SMTP dependency bundled) while still exercising the full UI flow.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test", to = "", subject = "", message = "" } = body as {
      action?: string; to?: string; subject?: string; message?: string;
    };
    if (action !== "test" && action !== "send") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    const dest = to.trim();
    if (!dest || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dest)) {
      return NextResponse.json({ error: "Enter a valid recipient email address." }, { status: 400 });
    }
    const s = await fetchAppSettings();
    const provider = (s.int_email_provider ?? "sendgrid").toLowerCase();
    const apiKey = (s.int_email_apiKey ?? "").trim();
    const from = (s.int_email_from ?? "").trim();
    const fromName = (s.int_email_fromName ?? "MediCore Hospital").trim() || "MediCore Hospital";
    const subj = subject.trim() || "MediCore — Email integration test";
    const text = message.trim() || "This is a test email from MediCore. Your email integration is working.";

    if (!from) {
      return NextResponse.json({ error: "Save a From email address first." }, { status: 400 });
    }
    if (provider === "sendgrid" && apiKey) {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: dest }], subject: subj }],
          from: { email: from, name: fromName },
          content: [{ type: "text/plain", value: text }],
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        return NextResponse.json({ error: `SendGrid rejected the request (${res.status}). ${t.slice(0, 200)}` }, { status: 502 });
      }
      await upsertAppSetting("int_email_lastTest", new Date().toISOString()).catch(() => {});
      return NextResponse.json({ ok: true, provider: "sendgrid" });
    }
    // SMTP / SES / unconfigured → simulated but recorded.
    await upsertAppSetting("int_email_lastTest", new Date().toISOString()).catch(() => {});
    return NextResponse.json({
      ok: true,
      simulated: true,
      detail:
        provider === "sendgrid"
          ? "No SendGrid API key saved — simulated send. Save the key for real delivery."
          : `Provider "${provider}" config saved — simulated send (connect your SMTP relay to deliver for real).`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Email test failed." }, { status: 500 });
  }
}
