import { NextRequest, NextResponse } from "next/server";
import { fetchInvoiceItems, replaceInvoiceItems } from "@/lib/supabase-data";
import type { InvoiceItem } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const invoiceId = req.nextUrl.searchParams.get("invoiceId");
    if (!invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    const data = await fetchInvoiceItems(invoiceId);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Replace all line items of an invoice (used by the admin bill-prep edit).
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { invoiceId?: string; items?: InvoiceItem[] };
    if (!body.invoiceId) {
      return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
    }
    const data = await replaceInvoiceItems(body.invoiceId, body.items ?? []);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
