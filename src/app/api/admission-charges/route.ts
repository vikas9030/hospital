import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissionCharges, addAdmissionCharge, deleteAdmissionCharge, auditBilling } from "@/lib/ipd-surgery-data";

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

// Corrections: delete one UNBILLED charge (Admin only). Billed history is locked.
export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (body.actorRole !== "Admin") {
      return NextResponse.json({ error: "Only Admin can delete a charge." }, { status: 403 });
    }
    await deleteAdmissionCharge(body.id);
    await auditBilling({
      actor: body.actorName || "Admin", action: "CHARGE_DELETED", branch: body.branch || "",
      admissionId: body.admissionId, details: `Unbilled charge ${body.id} deleted (correction).`,
    });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    const status = /locked/i.test(e.message ?? "") ? 422 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
