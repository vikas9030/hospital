import { NextRequest, NextResponse } from "next/server";
import { fetchMedicineAlerts, syncMedicineAlerts, acknowledgeMedicineAlert } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? "active";
    return NextResponse.json(await fetchMedicineAlerts(branch, status));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Sync the backend alert set with the client-computed desired set
// (upserts actives, auto-resolves cleared ones). Fire-and-forget safe.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { alerts?: any[]; branch?: string };
    const data = await syncMedicineAlerts(body.alerts ?? [], body.branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await acknowledgeMedicineAlert(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
