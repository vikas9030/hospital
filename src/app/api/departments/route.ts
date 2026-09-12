import { NextRequest, NextResponse } from "next/server";
import { fetchDepartments, createDepartment, updateDepartmentRow, deleteDepartmentRow } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    return NextResponse.json(await fetchDepartments(branch));
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
    const saved = await createDepartment({
      id: body.id || `dep${Date.now()}`,
      name: String(body.name).trim(),
      branch: body.branch,
      head: body.head ?? "",
      description: body.description ?? "",
      isActive: body.isActive ?? true,
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const updated = await updateDepartmentRow(body.id, {
      name: body.name,
      head: body.head,
      description: body.description,
      isActive: body.isActive,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const id = body.id ?? req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteDepartmentRow(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
