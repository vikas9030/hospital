import { NextRequest, NextResponse } from "next/server";
import { fetchPackages, createPackage, auditBilling } from "@/lib/ipd-surgery-data";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const activeOnly = req.nextUrl.searchParams.get("active") === "true";
    return NextResponse.json(await fetchPackages(branch, activeOnly));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name || !body.branch) {
      return NextResponse.json({ error: "name and branch are required" }, { status: 400 });
    }
    if (body.actorRole !== "Admin") {
      return NextResponse.json({ error: "Only Admin can create surgery packages." }, { status: 403 });
    }
    const created = await createPackage(body);
    await auditBilling({
      actor: body.createdBy || "Admin", action: "SURGERY_PACKAGE_CREATED",
      branch: created.branch, details: `Package "${created.name}" created: base ₹${created.basePrice}.`,
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
      return NextResponse.json({ error: "Only Admin can modify surgery packages." }, { status: 403 });
    }
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const [k, c] of Object.entries({
      name: "name", surgeryType: "surgery_type", basePrice: "base_price",
      packageDiscount: "package_discount", tax: "tax",
      validityFrom: "validity_from", validityTo: "validity_to", active: "active",
    })) {
      if ((body as any)[k] !== undefined) patch[c as string] = (body as any)[k];
    }
    const { data, error } = await supabaseAdmin.from("surgery_packages").update(patch).eq("id", body.id).select().single();
    if (error) throw error;
    await auditBilling({
      actor: body.actorName || "Admin", action: "SURGERY_PACKAGE_CHANGED",
      branch: data.branch, details: `Package "${data.name}" modified.`,
    });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
