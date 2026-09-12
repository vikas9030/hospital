import { NextRequest, NextResponse } from "next/server";
import { fetchUsers, createUser, updateUserRow, deleteUserRow } from "@/lib/supabase-data";
import type { UserAccountPayload } from "@/lib/supabase-data";

export async function GET() {
  try {
    const data = await fetchUsers();
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as UserAccountPayload;
    if (!body.name || !body.email || !body.password) {
      return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
    }
    const created = await createUser(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "A user account with this email already exists." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<{
      email: string; name: string; role: string; branch: string;
      branchId: string; password: string; mustChangePassword: boolean; newEmail: string; avatar: string;
    }>;
    if (!body.email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    const { email, ...updates } = body;
    const updated = await updateUserRow(email, updates);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };
    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }
    await deleteUserRow(email);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
