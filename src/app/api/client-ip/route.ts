import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd?.split(",")[0] ?? "").trim() ||
    (req.headers.get("x-real-ip") ?? "").trim() ||
    "unknown";
  return NextResponse.json({ ip });
}
