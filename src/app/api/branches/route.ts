import { NextRequest, NextResponse } from "next/server";
import { fetchBranches, getOrCreateBranch, updateBranchRow, deleteBranchRow } from "@/lib/supabase-data";
import type { Branch } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const data = await fetchBranches();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Branch;
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const { branch, created } = await getOrCreateBranch(body);
    return NextResponse.json(branch, { status: created ? 201 : 200 });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "A branch with this name already exists." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const updated = await updateBranchRow(body.id, body);
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
    await deleteBranchRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
