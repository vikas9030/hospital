import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting } from "@/lib/supabase-data";

// POST { action: "test", to, message }
// Supports Twilio (SID/AuthToken/From) and MSG91 (AuthKey/Sender). Without
// credentials returns simulated success so the UI stays fully functional.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test", to = "", message = "" } = body as { action?: string; to?: string; message?: string };
    if (action !== "test" && action !== "send") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    const dest = to.trim();
    if (!dest) return NextResponse.json({ error: "Enter a recipient phone number (e.g. 919876543210)." }, { status: 400 });
    const text = message.trim() || "MediCore test: SMS integration is working.";
    const s = await fetchAppSettings();
    const provider = (s.int_sms_provider ?? "twilio").toLowerCase();
    const sid = (s.int_sms_sid ?? "").trim();
    const token = (s.int_sms_token ?? "").trim();
    const from = (s.int_sms_from ?? "").trim();
    const sender = (s.int_sms_sender ?? "MEDICR").trim() || "MEDICR";

    if (provider === "msg91") {
      if (!token) {
        await upsertAppSetting("int_sms_lastTest", new Date().toISOString()).catch(() => {});
        return NextResponse.json({ ok: true, simulated: true, detail: "No MSG91 AuthKey saved — simulated send." });
      }
      const res = await fetch("https://control.msg91.com/api/v5/flow/sms", {
        method: "POST",
        headers: { authkey: token, "Content-Type": "application/json" },
        body: JSON.stringify({ sender, mobiles: dest, message: text }),
      });
      const data: any = await res.json().catch(() => ({}));
      if (!res.ok) return NextResponse.json({ error: data?.message || "MSG91 rejected the request." }, { status: 502 });
      await upsertAppSetting("int_sms_lastTest", new Date().toISOString()).catch(() => {});
      return NextResponse.json({ ok: true, provider: "msg91", response: data });
    }

    // Default: Twilio
    if (!sid || !token || !from) {
      await upsertAppSetting("int_sms_lastTest", new Date().toISOString()).catch(() => {});
      return NextResponse.json({ ok: true, simulated: true, detail: "No Twilio credentials saved — simulated send. Save SID + Auth Token + From number for real delivery." });
    }
    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const form = new URLSearchParams({ To: (dest.startsWith("+") ? dest : `+${dest}`), From: from, Body: text });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ error: data?.message || "Twilio rejected the request. Check SID / token / From number." }, { status: 502 });
    await upsertAppSetting("int_sms_lastTest", new Date().toISOString()).catch(() => {});
    return NextResponse.json({ ok: true, provider: "twilio", sid: data?.sid ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "SMS test failed." }, { status: 500 });
  }
}
