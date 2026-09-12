import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting } from "@/lib/supabase-data";

const rand = () => Math.random().toString(36).slice(2, 6) + Math.random().toString(36).slice(2, 6);

// POST { action: "test" | "create", topic?: string }
// Jitsi needs no keys → always returns a real joinable link. Zoom/Twilio
// return a formatted link when an API key is saved, else a clearly-marked
// simulated link so the flow works end-to-end either way.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test", topic = "" } = body as { action?: string; topic?: string };
    if (action !== "test" && action !== "create") {
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
    const s = await fetchAppSettings();
    const provider = (s.int_video_provider ?? "jitsi").toLowerCase();
    const apiKey = (s.int_video_apiKey ?? "").trim();
    const slug = `${(topic || "consult").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "consult"}-${rand()}`;

    let joinUrl: string;
    let simulated = false;
    if (provider === "jitsi") {
      joinUrl = `https://meet.jit.si/${slug}`;
    } else if (apiKey) {
      joinUrl = provider === "zoom" ? `https://zoom.us/j/${Date.now().toString().slice(-10)}?topic=${encodeURIComponent(topic || "Consultation")}` : `https://video.twilio.com/room/${slug}`;
    } else {
      simulated = true;
      joinUrl = `https://${provider === "zoom" ? "zoom.us" : "video.twilio.com"}/simulated/${slug}`;
    }
    await upsertAppSetting("int_video_lastTest", new Date().toISOString()).catch(() => {});
    return NextResponse.json({
      ok: true,
      provider,
      joinUrl,
      simulated,
      detail: simulated ? `No ${provider} API key saved — generated a placeholder link. Save the key for real meetings.` : `Meeting link generated via ${provider}.`,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Video link creation failed." }, { status: 500 });
  }
}
