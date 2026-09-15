import { NextRequest, NextResponse } from "next/server";
import { fetchSurgeries, createSurgery, updateSurgery, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    return NextResponse.json(await fetchSurgeries(branch, status));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.patientId || !body.branch || !body.surgeryName) {
      return NextResponse.json({ error: "patientId, branch and surgeryName are required" }, { status: 400 });
    }
    const created = await createSurgery(body);
    await auditBilling({
      actor: body.createdBy || "Staff", action: "SURGERY_BOOKED", branch: created.branch,
      patientId: created.patientId, admissionId: created.admissionId,
      details: `Surgery ${created.caseNo} booked: ${created.surgeryName} (${created.kind}, ${created.plannedDate} ${created.plannedTime}) — surgeon ${created.surgeon || "TBD"}.`,
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
    if (body.status === "Cancelled" && body.actorRole !== "Admin" && body.actorRole !== "Doctor") {
      return NextResponse.json({ error: "Only Admin or Doctor can cancel a surgery." }, { status: 403 });
    }
    const updated = await updateSurgery(body.id, body);
    await auditBilling({
      actor: body.actorName || "Staff", action: `SURGERY_${String(body.status || "UPDATED").toUpperCase().replace(/[^A-Z]/g, "_")}`,
      branch: updated.branch, patientId: updated.patientId, admissionId: updated.admissionId,
      details: `Surgery ${updated.caseNo} updated${body.status ? ` → ${body.status}` : ""}.`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
