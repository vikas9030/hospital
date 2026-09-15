import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissions, createAdmission, updateAdmission, syncBedCharges, linkOpenSurgeriesToAdmission, auditBilling } from "@/lib/ipd-surgery-data";

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
    // Day-1 bed amount accrues immediately so the bill exists from joining.
    let accrual = "";
    try {
      const s = await syncBedCharges(created.id);
      accrual = ` Day-1 bed accrual ₹${s.amount.toLocaleString("en-IN")} (${s.days}d × ₹${s.rate}).`;
    } catch { /* bed rate may be zero — accrual skipped */ }
    // Day-care surgeries booked earlier auto-join this admission (Surgery +
    // IPD + bill stay one connected record, whichever module added first).
    let linked = 0;
    try {
      linked = await linkOpenSurgeriesToAdmission(created.id);
    } catch { /* best-effort */ }
    await auditBilling({
      actor: body.createdBy || "Staff", action: "ADMISSION_CREATED", branch: created.branch,
      patientId: created.patientId, admissionId: created.id,
      details: `Admission ${created.admissionNo} opened for ${created.patientName} (bed ${created.bedNumber || "—"}).${accrual}${linked > 0 ? ` ${linked} open surgery case(s) linked.` : ""}`,
    });
    return NextResponse.json({ ...created, linkedSurgeries: linked }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    // Leaving without a discharge date stamps today, so the stay math closes.
    if (body.status === "Discharged" && !body.dischargeAt) {
      body.dischargeAt = new Date().toISOString();
    }
    const updated = await updateAdmission(body.id, body);
    // Joining → leave dates, bed rate or status changed → rebuild the unbilled
    // auto bed rows so the bill amount follows automatically (extend = more days).
    let accrual = "";
    if (
      body.admissionAt !== undefined || body.expectedDischargeDate !== undefined ||
      body.dischargeAt !== undefined || body.bedRate !== undefined || body.status !== undefined
    ) {
      try {
        const s = await syncBedCharges(body.id);
        accrual = ` Bed accrual now ₹${s.amount.toLocaleString("en-IN")} (${s.days}d × ₹${s.rate}).`;
      } catch { /* best-effort */ }
    }
    await auditBilling({
      actor: body.actorName || "Staff", action: "ADMISSION_UPDATED", branch: updated.branch,
      patientId: updated.patientId, admissionId: updated.id,
      details: `Admission ${updated.admissionNo} updated (${body.status ? `status=${body.status}` : ""}${body.billingStatus ? ` billing=${body.billingStatus}` : ""}).${accrual}`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
