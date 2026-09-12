import { NextRequest, NextResponse } from "next/server";
import { fetchNurseFirstAid, createNurseFirstAid, updateNurseFirstAidRow } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    return NextResponse.json(await fetchNurseFirstAid(branch));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const name = body.patientName || body.customName;
    if (!name || !body.branch) {
      return NextResponse.json({ error: "patient name and branch are required" }, { status: 400 });
    }
    const saved = await createNurseFirstAid({
      id: body.id || `fa${Date.now()}`,
      patientId: body.patientId ?? "",
      patientName: body.patientName ?? body.customName ?? "",
      customName: body.customName ?? "",
      nurseId: body.nurseId ?? "",
      nurse: body.nurse ?? "",
      at: body.at || new Date().toISOString(),
      kind: body.kind ?? "Other",
      bedId: body.bedId ?? "",
      bedNumber: body.bedNumber ?? "",
      notes: body.notes ?? "",
      amount: Number(body.amount ?? 0),
      paidAmount: Number(body.paidAmount ?? 0),
      invoiceId: body.invoiceId ?? "",
      branch: body.branch,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const updated = await updateNurseFirstAidRow(body.id, {
      paidAmount: body.paidAmount,
      invoiceId: body.invoiceId,
      notes: body.notes,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
