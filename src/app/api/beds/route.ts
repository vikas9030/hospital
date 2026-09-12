import { NextRequest, NextResponse } from "next/server";
import { fetchBeds, createBed, updateBedRow, deleteBedRow } from "@/lib/supabase-data";
import type { Bed } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const data = await fetchBeds(branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Bed;
    if (!body.number || !body.ward || !body.branch) {
      return NextResponse.json({ error: "number, ward, and branch are required" }, { status: 400 });
    }
    const created = await createBed(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "A bed with this number already exists." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Bed> & { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await updateBedRow(body.id, body);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json(
      { error: /not found/i.test(e.message ?? "") ? e.message : e.message },
      { status: /not found/i.test(e.message ?? "") ? 404 : 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deleteBedRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
