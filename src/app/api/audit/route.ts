import { NextRequest, NextResponse } from "next/server";
import { addAuditLogRow, fetchAuditLogs } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const action = req.nextUrl.searchParams.get("action") ?? undefined;
    const data = await fetchAuditLogs(branch, action);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.action || !body.actor) {
      return NextResponse.json({ error: "action and actor are required" }, { status: 400 });
    }
    await addAuditLogRow(body);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
