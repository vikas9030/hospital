import { NextRequest, NextResponse } from "next/server";
import { fetchAdmissionPayments, recordPayment, allocatePayment, auditBilling, getCompleteBill } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? "";
    if (!admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    return NextResponse.json(await fetchAdmissionPayments(admissionId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Server recomputes the outstanding balance — never trusts browser totals.
// Overpayment is rejected unless the payment is explicitly an Advance.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.patientId || !body.branch) {
      return NextResponse.json({ error: "patientId and branch are required" }, { status: 400 });
    }
    if (body.admissionId && (body.kind ?? "Payment") !== "Advance") {
      const bill = await getCompleteBill(body.admissionId);
      if (Number(body.amount) > bill.outstanding + 0.001) {
        return NextResponse.json(
          { error: `Payment ₹${body.amount} exceeds outstanding ₹${bill.outstanding}. Record the excess as an Advance.` },
          { status: 422 }
        );
      }
    }
    const created = await recordPayment(body);
    if (body.invoiceId && created.kind !== "Advance") {
      await allocatePayment(created.id, body.invoiceId, created.amount).catch(() => {});
    }
    await auditBilling({
      actor: body.receivedBy || "Staff", action: created.kind === "Advance" ? "ADVANCE_COLLECTED" : "PAYMENT_COLLECTED",
      branch: created.branch, patientId: created.patientId,
      admissionId: created.admissionId, invoiceId: created.invoiceId,
      details: `${created.kind} ₹${created.amount} via ${created.method} (${created.receiptNo}).`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
