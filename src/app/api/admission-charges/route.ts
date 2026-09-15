import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissionCharges, addAdmissionCharge, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? "";
    if (!admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    return NextResponse.json(await fetchAdmissionCharges(admissionId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    const created = await addAdmissionCharge(body);
    await auditBilling({
      actor: body.createdBy || "Staff", action: "CHARGE_ADDED", branch: created.branch,
      patientId: created.patientId, admissionId: created.admissionId,
      details: `Charge ${created.category} — ${created.description} ₹${created.net} added to admission.`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
