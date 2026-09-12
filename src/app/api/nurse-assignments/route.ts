import { NextRequest, NextResponse } from "next/server";
import { fetchNurseAssignments, upsertNurseAssignment } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    return NextResponse.json(await fetchNurseAssignments(branch));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nurseId || !body.branch) {
      return NextResponse.json({ error: "nurseId and branch are required" }, { status: 400 });
    }
    const saved = await upsertNurseAssignment({
      nurseId: body.nurseId,
      nurseName: body.nurseName ?? "",
      doctorIds: body.doctorIds ?? [],
      wards: body.wards ?? [],
      bedIds: body.bedIds ?? [],
      branch: body.branch,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
