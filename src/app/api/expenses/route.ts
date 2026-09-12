import { NextRequest, NextResponse } from "next/server";
import { fetchExpenses, createExpense, updateExpenseRow, deleteExpenseRow } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    return NextResponse.json(await fetchExpenses(branch));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.title || !body.date || !body.branch) {
      return NextResponse.json({ error: "title, date and branch are required" }, { status: 400 });
    }
    const saved = await createExpense({
      id: body.id || `exp${Date.now()}`,
      title: String(body.title),
      category: body.category ?? "Other",
      amount: Math.max(0, Number(body.amount ?? 0)),
      date: body.date,
      paymentMethod: body.paymentMethod ?? "Cash",
      vendor: body.vendor ?? "",
      notes: body.notes ?? "",
      recordedBy: body.recordedBy ?? "",
      branch: body.branch,
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
    const updated = await updateExpenseRow(body.id, {
      title: body.title,
      category: body.category,
      amount: body.amount !== undefined ? Math.max(0, Number(body.amount)) : undefined,
      date: body.date,
      paymentMethod: body.paymentMethod,
      vendor: body.vendor,
      notes: body.notes,
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
    await deleteExpenseRow(id);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
