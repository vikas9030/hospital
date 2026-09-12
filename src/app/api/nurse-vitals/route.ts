import { NextRequest, NextResponse } from "next/server";
import { fetchNurseVitals, createNurseVitals } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const patientId = req.nextUrl.searchParams.get("patientId") ?? undefined;
    return NextResponse.json(await fetchNurseVitals(branch, patientId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.patientName || !body.branch) {
      return NextResponse.json({ error: "patientName and branch are required" }, { status: 400 });
    }
    const saved = await createNurseVitals({
      id: body.id || `v${Date.now()}`,
      patientId: body.patientId ?? "",
      patientName: body.patientName,
      nurseId: body.nurseId ?? "",
      nurse: body.nurse ?? "",
      at: body.at || new Date().toISOString(),
      bpSys: body.bpSys ?? "",
      bpDia: body.bpDia ?? "",
      pulse: body.pulse ?? "",
      temp: body.temp ?? "",
      spo2: body.spo2 ?? "",
      sugar: body.sugar ?? "",
      condition: body.condition ?? "Stable",
      notes: body.notes ?? "",
      branch: body.branch,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
