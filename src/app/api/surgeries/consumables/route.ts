import { NextRequest, NextResponse } from "next/server";
import { fetchConsumables, recordConsumable, issueConsumable, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const caseId = req.nextUrl.searchParams.get("caseId") ?? "";
    if (!caseId) return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    return NextResponse.json(await fetchConsumables(caseId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Record usage (no stock movement) or confirm issue (action: "issue" → deducts stock once + posts charge).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.action === "issue") {
      if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
      const updated = await issueConsumable(body.id, body.actorName || "Staff");
      await auditBilling({
        actor: body.actorName || "Staff", action: "SURGERY_CONSUMABLE_ISSUED",
        branch: updated.branch, details: `${updated.item} × ${updated.quantity} issued for surgery ${updated.caseId}; pharmacy stock deducted.`,
      });
      return NextResponse.json(updated);
    }
    if (!body.caseId || !body.item) {
      return NextResponse.json({ error: "caseId and item are required" }, { status: 400 });
    }
    const created = await recordConsumable(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
