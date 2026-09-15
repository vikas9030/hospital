import { NextRequest, NextResponse } from "next/server";
import { getCompleteBill } from "@/lib/ipd-surgery-data";

// Consolidated admission bill — gross, discounts, taxes, advances, payments,
// refunds, net payable, outstanding + running ledger. All totals server-computed.
export async function GET(req: NextRequest) {
  try {
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? "";
    if (!admissionId) return NextResponse.json({ error: "admissionId is required" }, { status: 400 });
    return NextResponse.json(await getCompleteBill(admissionId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
