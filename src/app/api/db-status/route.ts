import { NextResponse } from "next/server";
import { getDatabaseStatus } from "@/lib/supabase-data";

export async function GET() {
  try {
    const status = await getDatabaseStatus();
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
