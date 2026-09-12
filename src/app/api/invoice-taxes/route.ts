import { NextRequest, NextResponse } from "next/server";
import { fetchInvoiceTaxes, replaceInvoiceTaxes } from "@/lib/supabase-data";
import type { InvoiceTaxLine } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    const data = await fetchInvoiceTaxes(invoiceId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Replace all tax lines of an invoice (used by the bill editor).
// Taxes can only be changed while the bill is unpaid — the UI locks the
// editor once paidAmount > 0 / status is Paid.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { invoiceId?: string; taxes?: InvoiceTaxLine[] };
    if (!body.invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    const data = await replaceInvoiceTaxes(body.invoiceId, body.taxes ?? []);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
