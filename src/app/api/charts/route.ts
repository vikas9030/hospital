import { NextRequest, NextResponse } from "next/server";
import { fetchRevenueTrend, fetchPatientGrowth, fetchDepartmentPerformance } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branchId = req.nextUrl.searchParams.get("branchId") ?? undefined;
    const [revenue, patients, departments] = await Promise.all([
      fetchRevenueTrend(branchId),
      fetchPatientGrowth(branchId),
      fetchDepartmentPerformance(branchId),
    ]);
    return NextResponse.json({ revenueTrend: revenue, patientGrowth: patients, departmentPerformance: departments });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
