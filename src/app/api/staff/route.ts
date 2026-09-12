import { NextRequest, NextResponse } from "next/server";
import { fetchStaff, createStaff, updateStaff, deleteStaffRow } from "@/lib/supabase-data";
import type { StaffMember } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const data = await fetchStaff(branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as StaffMember;
    if (!body.name || !body.role || !body.email) {
      return NextResponse.json({ error: "name, role, and email are required" }, { status: 400 });
    }
    const created = await createStaff(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "A staff member with this email or staff ID already exists." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<StaffMember> & { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await updateStaff(body.id, body);
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
    await deleteStaffRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

