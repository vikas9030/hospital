import { NextRequest, NextResponse } from "next/server";
import { fetchRateCards, createRateCard, updateRateCard, auditBilling } from "@/lib/ipd-surgery-data";

// Operation price master: per-operation default breakup (surgeon / assistant /
// anesthesia / OT / nursing). Booking auto-expands the matching card.
export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const activeOnly = req.nextUrl.searchParams.get("active") === "true";
    return NextResponse.json(await fetchRateCards(branch, activeOnly));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.operationName || !body.branch) {
      return NextResponse.json({ error: "operationName and branch are required" }, { status: 400 });
    }
    if (body.actorRole !== "Admin") {
      return NextResponse.json({ error: "Only Admin can create operation prices." }, { status: 403 });
    }
    const created = await createRateCard(body);
    await auditBilling({
      actor: body.createdBy || "Admin", action: "RATE_CARD_CREATED",
      branch: created.branch, details: `Operation price "${created.operationName}" saved.`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    if (body.actorRole !== "Admin") {
      return NextResponse.json({ error: "Only Admin can modify operation prices." }, { status: 403 });
    }
    const updated = await updateRateCard(body.id, body);
    await auditBilling({
      actor: body.actorName || "Admin", action: "RATE_CARD_CHANGED",
      branch: updated.branch, details: `Operation price "${updated.operationName}" modified.`,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
