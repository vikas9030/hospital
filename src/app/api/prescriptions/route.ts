import { NextRequest, NextResponse } from "next/server";
import { fetchPrescriptions, createPrescription, updatePrescriptionStatus } from "@/lib/supabase-data";
import type { Prescription } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId") ?? undefined;
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const data = await fetchPrescriptions(patientId, branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Prescription;
    if (!body.patientId || !body.patientName) {
      return NextResponse.json({ error: "patientId and patientName are required" }, { status: 400 });
    }
    const created = await createPrescription({
      ...body,
      id: body.id || `rx${Date.now()}`,
      date: body.date || new Date().toISOString().split("T")[0],
      status: body.status || "Issued",
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; status?: Prescription["status"] };
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }
    const updated = await updatePrescriptionStatus(body.id, body.status);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
