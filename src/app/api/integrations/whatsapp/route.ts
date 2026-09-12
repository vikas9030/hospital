import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting } from "@/lib/supabase-data";

// POST { action: "test", to: "<e.164 phone>", message?: string }
// Sends a real WhatsApp message via Meta Cloud API when credentials exist,
// otherwise returns a simulated success so the UI flow is fully testable.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test", to = "", message = "" } = body as { action?: string; to?: string; message?: string };
    const s = await fetchAppSettings();
    const phoneId = (s.int_whatsapp_phoneId ?? "").trim();
    const token = (s.int_whatsapp_token ?? "").trim();
    const template = (s.int_whatsapp_template ?? "hello_world").trim() || "hello_world";

    if (action === "test" || action === "send") {
      const dest = to.trim();
      if (!dest) return NextResponse.json({ error: "Enter a recipient phone number in international format (e.g. 919876543210)." }, { status: 400 });
      const text = message.trim() || "MediCore test: WhatsApp integration is working.";
      if (!phoneId || !token) {
        await upsertAppSetting("int_whatsapp_lastTest", new Date().toISOString()).catch(() => {});
        return NextResponse.json({ ok: true, simulated: true, detail: "No Cloud API credentials saved — simulated send. Save Phone Number ID + Access Token for real delivery." });
      }
      // Try template first (required for unsolicited messages), fall back to text.
      const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
      let res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messaging_product: "whatsapp", to: dest, type: "template", template: { name: template, language: { code: "en_US" } } }),
      });
      let data: any = await res.json().catch(() => ({}));
      if (!res.ok && /template|parameter|not exist/i.test(JSON.stringify(data))) {
        res = await fetch(url, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ messaging_product: "whatsapp", to: dest, type: "text", text: { body: text } }),
        });
        data = await res.json().catch(() => ({}));
      }
      if (!res.ok) {
        const msg = data?.error?.message || "Meta API rejected the request. Check Phone Number ID / token.";
        return NextResponse.json({ error: msg }, { status: 502 });
      }
      await upsertAppSetting("int_whatsapp_lastTest", new Date().toISOString()).catch(() => {});
      return NextResponse.json({ ok: true, messageId: data?.messages?.[0]?.id ?? null });
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "WhatsApp test failed." }, { status: 500 });
  }
}
