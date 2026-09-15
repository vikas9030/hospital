import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissionRefunds, requestRefund, setRefundStatus, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? "";
    if (!admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    return NextResponse.json(await fetchAdmissionRefunds(admissionId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Request a refund (creates a reversal record — original payment is kept).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.patientId || !body.branch) {
      return NextResponse.json({ error: "patientId and branch are required" }, { status: 400 });
    }
    const created = await requestRefund(body);
    await auditBilling({
      actor: body.actorName || "Staff", action: "REFUND_REQUESTED", branch: created.branch,
      patientId: created.patientId, admissionId: created.admissionId,
      details: `Refund ${created.refundNo} requested: ₹${created.amount} — ${created.reason}`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Approve / reject / process. Approvals require Admin (or Accountant for small amounts).
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id || !body.status) return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    const role = String(body.actorRole || "");
    if ((body.status === "Approved" || body.status === "Processed") && role !== "Admin" && role !== "Accountant") {
      return NextResponse.json({ error: "Only Admin or Accountant can approve/process refunds." }, { status: 403 });
    }
    const updated = await setRefundStatus(body.id, body.status, body.actorName || role || "Staff");
    await auditBilling({
      actor: body.actorName || role || "Staff", action: `REFUND_${String(body.status).toUpperCase()}`,
      branch: updated.branch, patientId: updated.patientId, admissionId: updated.admissionId,
      details: `Refund ${updated.refundNo} ${body.status}: ₹${updated.amount}.`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
