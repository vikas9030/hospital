import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissions, createAdmission, updateAdmission, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    return NextResponse.json(await fetchAdmissions(branch, status));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.patientId || !body.branch) {
      return NextResponse.json({ error: "patientId and branch are required" }, { status: 400 });
    }
    const created = await createAdmission(body);
    await auditBilling({
      actor: body.createdBy || "Staff", action: "ADMISSION_CREATED", branch: created.branch,
      patientId: created.patientId, admissionId: created.id,
      details: `Admission ${created.admissionNo} opened for ${created.patientName} (bed ${created.bedNumber || "—"}).`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const updated = await updateAdmission(body.id, body);
    await auditBilling({
      actor: body.actorName || "Staff", action: "ADMISSION_UPDATED", branch: updated.branch,
      patientId: updated.patientId, admissionId: updated.id,
      details: `Admission ${updated.admissionNo} updated (${body.status ? `status=${body.status}` : ""}${body.billingStatus ? ` billing=${body.billingStatus}` : ""}).`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
