import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, fetchInvoices, logRazorpayPayment } from "@/lib/supabase-data";
import { branchSetting } from "@/lib/utils";

export interface RazorpayConfig {
  mode: string;
  keyId: string;
  secret: string;
}

const stripWs = (v: string) => (v || "").replace(/\s+/g, "");

export async function resolveRazorpayConfig(branch: string): Promise<RazorpayConfig | null> {
  const settings = await fetchAppSettings();
  const mode = branchSetting(settings, branch, "razorpayMode") || settings.razorpayMode || "disabled";
  if (mode === "disabled") return null;
  const keyId = stripWs(branchSetting(settings, branch, "razorpayKeyId") || settings.razorpayKeyId || "");
  const secret = stripWs(branchSetting(settings, branch, "razorpayKeySecret") || (settings as Record<string, string>).razorpayKeySecret || "");
  if (!keyId || !secret) return null;
  return { mode, keyId, secret };
}

// Create a Razorpay order for an invoice's outstanding amount.
export async function POST(req: NextRequest) {
  try {
    const { invoiceId, amount } = (await req.json()) as { invoiceId?: string; amount?: number };
    if (!invoiceId) return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    const invoices = await fetchInvoices();
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
    const outstanding = Math.max(0, (invoice.total || 0) - (invoice.paidAmount || 0));
    const payAmount = Math.max(0, Math.min(amount && amount > 0 ? amount : outstanding, outstanding));
    if (payAmount <= 0) return NextResponse.json({ error: "Nothing outstanding on this invoice." }, { status: 400 });

    const cfg = await resolveRazorpayConfig(invoice.branch || "");
    if (!cfg) {
      return NextResponse.json(
        { error: "Online payments are not configured. Ask the admin to add Razorpay keys in Settings → Online Payments." },
        { status: 503 }
      );
    }
    const auth = Buffer.from(`${cfg.keyId}:${cfg.secret}`).toString("base64");
    const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(payAmount * 100),
        currency: "INR",
        receipt: invoice.invoiceNo || invoice.id,
        notes: { invoiceId: invoice.id, patient: invoice.patientName, branch: invoice.branch || "" },
      }),
    });
    const rzpBody = await rzpRes.json().catch(() => ({}));
    if (!rzpRes.ok) {
      const desc = rzpBody?.error?.description || "";
      if (rzpRes.status === 401 || /authentication failed/i.test(desc)) {
        console.warn(`[razorpay] 401 for key ${cfg.keyId.slice(0, 13)}… in ${cfg.mode} mode — secret mismatch or wrong key.`);
        throw new Error(
          "Razorpay rejected the Key ID/Secret (Authentication failed). The secret is shown only once when created — if it was not copied then, regenerate keys in the Razorpay Dashboard and paste both fresh, then Test Connection."
        );
      }
      throw new Error(desc || "Razorpay order creation failed. Check keys and mode.");
    }
    await logRazorpayPayment({
      invoiceId: invoice.id, invoiceNo: invoice.invoiceNo, patientName: invoice.patientName,
      amount: payAmount, orderId: rzpBody.id, status: "created", mode: cfg.mode, branch: invoice.branch || "",
    }).catch(() => {});
    return NextResponse.json({
      keyId: cfg.keyId,
      orderId: rzpBody.id,
      amount: payAmount,
      currency: "INR",
      invoiceNo: invoice.invoiceNo,
      patientName: invoice.patientName,
      testMode: cfg.mode === "test",
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
