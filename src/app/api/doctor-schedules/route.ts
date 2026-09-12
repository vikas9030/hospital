import { NextRequest, NextResponse } from "next/server";
import { fetchDoctorSchedules, upsertDoctorSchedule } from "@/lib/supabase-data";
import type { DoctorBranchSchedule } from "@/lib/types";

export async function GET() {
  try {
    const data = await fetchDoctorSchedules();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as DoctorBranchSchedule;
    if (!body.doctorEmail || !body.branch) {
      return NextResponse.json({ error: "doctorEmail and branch are required" }, { status: 400 });
    }
    const saved = await upsertDoctorSchedule(body);
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
