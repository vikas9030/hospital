import { NextRequest, NextResponse } from "next/server";
import { fetchSurgeries, createSurgery, updateSurgery, ensureSurgeryAutoCharges, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? undefined;
    return NextResponse.json(await fetchSurgeries(branch, status, admissionId));
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
    // Auto-expand the operation price card into priced components, add-by-add.
    // Best-effort: booking never fails when no price card exists yet.
    let autoAdded = 0;
    try {
      autoAdded = (await ensureSurgeryAutoCharges(created.id, body.createdBy || "Staff")).length;
    } catch { /* no matching rate card — components can be added manually */ }
    await auditBilling({
      actor: body.createdBy || "Staff", action: "SURGERY_BOOKED", branch: created.branch,
      patientId: created.patientId, admissionId: created.admissionId,
      details: `Surgery ${created.caseNo} booked: ${created.surgeryName} (${created.kind}, ${created.plannedDate} ${created.plannedTime}) — surgeon ${created.surgeon || "TBD"}${autoAdded > 0 ? `, ${autoAdded} priced component(s) auto-added` : ""}.`,
    });
    return NextResponse.json({ ...created, autoAdded }, { status: 201 });
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
    // Doctor assigned later (or operation details added) → fill any missing
    // priced components from the rate card. Only fills gaps, never duplicates.
    let autoAdded = 0;
    if (body.surgeon !== undefined || body.assistantSurgeon !== undefined || body.anesthesiaType !== undefined || body.theatre !== undefined || body.status !== undefined) {
      try {
        autoAdded = (await ensureSurgeryAutoCharges(body.id, body.actorName || "Staff")).length;
      } catch { /* best-effort */ }
    }
    await auditBilling({
      actor: body.actorName || "Staff", action: `SURGERY_${String(body.status || "UPDATED").toUpperCase().replace(/[^A-Z]/g, "_")}`,
      branch: updated.branch, patientId: updated.patientId, admissionId: updated.admissionId,
      details: `Surgery ${updated.caseNo} updated${body.status ? ` → ${body.status}` : ""}${autoAdded > 0 ? `, ${autoAdded} priced component(s) auto-added` : ""}.`,
    });
    return NextResponse.json({ ...updated, autoAdded });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
