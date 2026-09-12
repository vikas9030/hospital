import { NextRequest, NextResponse } from "next/server";
import { fetchPatientTimeline } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId");
    if (!patientId) {
      return NextResponse.json({ error: "patientId is required" }, { status: 400 });
    }
    const data = await fetchPatientTimeline(patientId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
