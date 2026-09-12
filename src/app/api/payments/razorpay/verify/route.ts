import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { fetchAppSettings, fetchInvoices, updateInvoiceRow, markRazorpayPaid } from "@/lib/supabase-data";
import { branchSetting } from "@/lib/utils";

// Verify the Razorpay payment signature, then apply the paid amount to the
// invoice (method UPI). Status auto-derives Paid/Partial server-side.
export async function POST(req: NextRequest) {
  try {
    const { invoiceId, razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = (await req.json()) as {
      invoiceId?: string; razorpay_order_id?: string; razorpay_payment_id?: string; razorpay_signature?: string; amount?: number;
    };
    if (!invoiceId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Incomplete payment response." }, { status: 400 });
    }
    const invoices = await fetchInvoices();
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });

    const settings = await fetchAppSettings();
    const secret = (branchSetting(settings, invoice.branch || "", "razorpayKeySecret") || (settings as Record<string, string>).razorpayKeySecret || "").replace(/\s+/g, "");
    if (!secret) return NextResponse.json({ error: "Payment keys are not configured." }, { status: 503 });

    const expected = createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expected !== razorpay_signature) {
      return NextResponse.json({ error: "Payment verification failed. Amount was NOT collected." }, { status: 403 });
    }

    const outstanding = Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0));
    const paid = Math.max(0, Math.min(amount && amount > 0 ? amount : outstanding, outstanding));
    const saved = await updateInvoiceRow(invoice.id, {
      paidAmount: (invoice.paidAmount || 0) + paid,
      paymentMethod: "UPI",
      paidDate: new Date().toISOString().split("T")[0],
    });
    await markRazorpayPaid(razorpay_order_id, razorpay_payment_id).catch(() => {});
    return NextResponse.json({ invoice: saved, collected: paid, paymentId: razorpay_payment_id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
