import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getCompleteBill, fetchSurgeryChargesByAdmission, auditBilling } from "@/lib/ipd-surgery-data";
import { createInvoice } from "@/lib/supabase-data";

// Finalize the discharge bill: recompute server-side, roll every unbilled
// admission charge (beds, nursing, pharmacy, lab…) PLUS every unbilled
// surgery/OT charge component for this admission into ONE single Final
// invoice, mark both charge tables billed, lock the admission.
// Finalized invoices are read-only (see invoices PATCH guard).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { admissionId } = body as { admissionId?: string };
    if (!admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    const bill = await getCompleteBill(admissionId);
    if (bill.admission.status !== "Discharged" && !body.allowOpen) {
      return NextResponse.json({ error: "Discharge the patient (or confirm interim finalization) before finalizing." }, { status: 422 });
    }
    const unbilled = bill.charges.filter((c) => !c.billed);
    // Surgery/OT components live in their own table but belong to the same
    // admission — they join the same single bill (beds + surgery + OT together).
    const unbilledSurgery = (await fetchSurgeryChargesByAdmission(admissionId)).filter((c) => !c.billed);
    if (unbilled.length === 0 && unbilledSurgery.length === 0 && bill.invoices.some((i) => i.billStatus === "Finalized")) {
      return NextResponse.json({ error: "A final bill already exists and there are no new charges." }, { status: 409 });
    }
    const discountPercent = Number(body.discountPercent ?? 0);
    const actorRole = String(body.actorRole || "");
    const threshold = Number(body.discountThreshold ?? 20);
    if (discountPercent > threshold && actorRole !== "Admin") {
      return NextResponse.json(
        { error: `Discount ${discountPercent}% exceeds the ${threshold}% approval limit. Ask an Admin.` },
        { status: 403 }
      );
    }
    const surgerySubtotal = unbilledSurgery.reduce((s, c) => s + Number(c.amount || 0), 0);
    const subtotal = unbilled.reduce((s, c) => s + Number(c.net || 0), 0) + surgerySubtotal;
    const discount = Math.round((subtotal * Math.min(100, Math.max(0, discountPercent))) / 100);
    const base = Math.max(0, subtotal - discount);
    const taxes = Array.isArray(body.taxes) ? body.taxes : [];
    const tax = taxes.reduce((s: number, t: any) => s + Math.round((base * (Number(t.percent) || 0)) / 100), 0);
    const invoice = await createInvoice({
      id: `inv${Date.now()}`,
      invoiceNo: "",
      patientId: bill.admission.patientId,
      patientName: bill.admission.patientName,
      admissionId: bill.admission.id,
      billKind: body.kind || "Final",
      billStatus: "Finalized",
      date: new Date().toISOString().split("T")[0],
      dueDate: new Date().toISOString().split("T")[0],
      items: [
        ...unbilled.map((c) => ({
          description: `${c.category} — ${c.description}`,
          category: "IPD" as const,
          quantity: Number(c.quantity) || 1,
          rate: Number(c.rate) || 0,
          amount: Number(c.net),
          admissionId: c.admissionId,
          chargeId: c.id,
          discount: Number(c.discount) || 0,
          tax: Number(c.tax) || 0,
        })),
        ...unbilledSurgery.map((c) => ({
          description: `Surgery/OT — ${c.label}`,
          category: "IPD" as const,
          quantity: 1,
          rate: Number(c.amount) || 0,
          amount: Number(c.amount) || 0,
          admissionId: admissionId,
          chargeId: c.id,
          discount: 0,
          tax: 0,
        })),
      ],
      subtotal, tax, discount, discountPercent,
      taxes: taxes.map((t: any) => ({ name: String(t.name || "Tax"), percent: Number(t.percent) || 0, amount: 0 })),
      total: Math.max(0, subtotal - discount + tax),
      paidAmount: 0,
      status: "Pending",
      branch: bill.admission.branch,
      createdBy: body.actorName || "",
      discountReason: body.discountReason || "",
      discountApprovedBy: body.discountApprovedBy || "",
    } as any);
    const unbilledIds = unbilled.map((c) => c.id);
    const unbilledSurgeryIds = unbilledSurgery.map((c) => c.id);
    if (unbilledIds.length > 0) {
      await supabaseAdmin.from("admission_charges")
        .update({ billed: true, invoice_id: invoice.id, updated_at: new Date().toISOString() })
        .in("id", unbilledIds);
    }
    if (unbilledSurgeryIds.length > 0) {
      await supabaseAdmin.from("surgery_case_charges")
        .update({ billed: true, invoice_id: invoice.id, updated_at: new Date().toISOString() })
        .in("id", unbilledSurgeryIds);
    }
    await supabaseAdmin.from("admissions").update({
      billing_status: "Final Bill Generated", updated_at: new Date().toISOString(),
    }).eq("id", admissionId);
    await auditBilling({
      actor: body.actorName || "Staff", actorEmail: body.actorEmail || "",
      action: "FINAL_BILL_GENERATED", branch: bill.admission.branch,
      patientId: bill.admission.patientId, admissionId, invoiceId: invoice.id,
      details: `Final bill ${invoice.invoiceNo} generated: ₹${invoice.total} (${unbilled.length} ward + ${unbilledSurgery.length} surgery/OT charges, single bill).`,
    });
    return NextResponse.json({ invoice, bill: await getCompleteBill(admissionId) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
