import { NextRequest, NextResponse } from "next/server";
import { fetchInvoices, createInvoice, updateInvoiceRow, deleteInvoiceRow } from "@/lib/supabase-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recordPayment, allocatePayment } from "@/lib/ipd-surgery-data";
import type { Invoice } from "@/lib/types";

// Every rupee collected against a bill drops a receipt into the payments
// table (idempotent per invoice+amount), so OPD/discharge collections show
// in Billing → Money Collected history exactly like IPD payments do.
// Best-effort: the invoice itself stays the source of truth and never fails
// because of receipting.
async function recordInvoiceReceipt(inv: {
  id: string; invoiceNo: string; patientId: string; patientName: string;
  admissionId?: string | null; branch: string; method: string; receivedBy: string;
}, amount: number): Promise<void> {
  const rounded = Math.round(Number(amount || 0) * 100) / 100;
  if (!(rounded > 0) || !inv.patientId || !inv.branch) return;
  try {
    const created = await recordPayment({
      patientId: inv.patientId, patientName: inv.patientName,
      admissionId: inv.admissionId || undefined, invoiceId: inv.id,
      amount: rounded, method: inv.method || "Cash", kind: "Payment",
      notes: `Collected against ${inv.invoiceNo}`,
      idempotencyKey: `invpay-${inv.id}-${rounded}`,
      receivedBy: inv.receivedBy || "Staff", branch: inv.branch,
    } as any);
    await allocatePayment(created.id, inv.id, created.amount).catch(() => {});
  } catch { /* receipting never blocks billing */ }
}

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const data = await fetchInvoices(branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Invoice & { actorRole?: string; discountThreshold?: number };
    if (!body.patientName || !body.branch) {
      return NextResponse.json({ error: "patientName and branch are required" }, { status: 400 });
    }
    // High-value discount approval: above threshold requires Admin.
    const threshold = Number(body.discountThreshold ?? 20);
    if (Number(body.discountPercent ?? 0) > threshold && body.actorRole !== "Admin") {
      return NextResponse.json(
        { error: `Discount ${body.discountPercent}% exceeds the ${threshold}% approval limit. Ask an Admin.` },
        { status: 403 }
      );
    }
    const created = await createInvoice(body);
    // Paid at creation (OPD fee at registration, discharge paid in full) →
    // receipt immediately so billing history shows the money.
    if (Number((created as any).paidAmount ?? 0) > 0) {
      await recordInvoiceReceipt({
        id: (created as any).id, invoiceNo: (created as any).invoiceNo ?? "",
        patientId: (created as any).patientId ?? "", patientName: (created as any).patientName ?? "",
        admissionId: (created as any).admissionId ?? null, branch: (created as any).branch ?? "",
        method: (created as any).paymentMethod || "Cash",
        receivedBy: (body as any).createdBy || (body as any).receivedBy || "Staff",
      }, Number((created as any).paidAmount));
    }
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    // Finalized bills are read-only — Admin authorization required for corrections.
    const { data: current } = await supabaseAdmin
      .from("invoices").select("bill_status, paid_amount, patient_id, patient_name, admission_id, branch, payment_method, invoice_no").eq("id", body.id).maybeSingle();
    if ((current as any)?.bill_status === "Finalized" && body.actorRole !== "Admin") {
      return NextResponse.json(
        { error: "This is a finalized bill. Ask an Admin to authorize corrections." },
        { status: 403 }
      );
    }
    if (body.billStatus === "Cancelled" && body.actorRole !== "Admin" && body.actorRole !== "Accountant") {
      return NextResponse.json({ error: "Only Admin or Accountant can cancel a bill." }, { status: 403 });
    }
    const updated = await updateInvoiceRow(body.id, body);
    // Collect dialog topped up paidAmount (OPD / Patient Bill flows) → receipt
    // the delta so Money Collected history matches the bill exactly.
    const before = Number((current as any)?.paid_amount ?? 0);
    const after = body.paidAmount !== undefined ? Number(body.paidAmount) : before;
    if (after > before + 0.001) {
      await recordInvoiceReceipt({
        id: body.id, invoiceNo: (current as any)?.invoice_no ?? "",
        patientId: (current as any)?.patient_id ?? "", patientName: (current as any)?.patient_name ?? "",
        admissionId: (current as any)?.admission_id ?? null, branch: (current as any)?.branch ?? "",
        method: body.paymentMethod || (current as any)?.payment_method || "Cash",
        receivedBy: body.receivedBy || body.actorName || "Staff",
      }, after - before);
    }
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteInvoiceRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
