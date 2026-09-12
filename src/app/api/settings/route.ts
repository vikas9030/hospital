import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, upsertAppSetting, deleteAppSetting } from "@/lib/supabase-data";

const SECRET_KEY_PATTERN = /secret|password|privatekey|private_key|apikey|api_key|authtoken|auth_token/i;

export async function GET() {
  try {
    const data = await fetchAppSettings();
    // Never expose secrets (Razorpay key secret, etc.) to browsers.
    const safe: Record<string, string> = {};
    for (const [k, v] of Object.entries(data)) {
      if (!SECRET_KEY_PATTERN.test(k)) safe[k] = v;
    }
    return NextResponse.json(safe);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { key?: string; value?: string };
    if (!body.key || body.value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }
    await upsertAppSetting(body.key, String(body.value));
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { key } = (await req.json()) as { key?: string };
    if (!key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    await deleteAppSetting(key);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
