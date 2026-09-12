import { NextRequest, NextResponse } from "next/server";
import { fetchAttendance, upsertAttendance, deleteAttendanceRow, requesterIp, verifyBranchNetwork } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams;
    return NextResponse.json(await fetchAttendance(
      q.get("branch") ?? undefined,
      q.get("from") ?? undefined,
      q.get("to") ?? undefined
    ));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.staffId || !body.date || !body.branch) {
      return NextResponse.json({ error: "staffId, date and branch are required" }, { status: 400 });
    }
    // WiFi gate: presence punches (Kiosk/Device) must come from the clinic
    // network when the branch has a static IP configured. Manager
    // corrections (Manual) stay exempt so back-dated fixes keep working.
    const mode = body.mode ?? "Manual";
    const deviceIp = requesterIp(req.headers);
    let networkVerified = false;
    if (mode === "Kiosk" || mode === "Device") {
      const check = await verifyBranchNetwork(deviceIp, body.branch);
      networkVerified = check.verified;
      if (!check.verified) {
        return NextResponse.json({ error: `${check.reason} Attendance needs clinic WiFi.` }, { status: 403 });
      }
    }
    const saved = await upsertAttendance({
      id: body.id || `att${Date.now()}`,
      staffId: body.staffId,
      staffName: body.staffName ?? "",
      date: body.date,
      checkIn: body.checkIn ?? "",
      checkOut: body.checkOut ?? "",
      status: body.status ?? "Present",
      mode,
      markedBy: body.markedBy ?? "",
      notes: body.notes ?? "",
      branch: body.branch,
      deviceIp,
      networkVerified,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id ?? req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteAttendanceRow(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
