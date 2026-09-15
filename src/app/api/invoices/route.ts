import { NextRequest, NextResponse } from "next/server";
import { fetchInvoices, createInvoice, updateInvoiceRow, deleteInvoiceRow } from "@/lib/supabase-data";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Invoice } from "@/lib/types";

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
      .from("invoices").select("bill_status").eq("id", body.id).maybeSingle();
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
