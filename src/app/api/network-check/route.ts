import { NextRequest, NextResponse } from "next/server";
import { requesterIp, verifyBranchNetwork, getBranchNetwork } from "@/lib/supabase-data";

// Tells a device whether it is currently on the branch's clinic network.
// Used by the Attendance module before allowing presence punches.
export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const ip = requesterIp(req.headers);
    const net = await getBranchNetwork(branch);
    const check = await verifyBranchNetwork(ip, branch);
    return NextResponse.json({
      ip,
      enforced: net.enforced,
      savedIp: net.ipAddress,
      verified: check.verified,
      reason: check.reason,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
