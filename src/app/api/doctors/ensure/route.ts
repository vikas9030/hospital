import { NextRequest, NextResponse } from "next/server";
import { ensureDoctor } from "@/lib/supabase-data";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      email?: string;
      name?: string;
      phone?: string;
      branch?: string;
      department?: string;
      consultationFee?: number;
      availableDays?: string[];
      availableFrom?: string;
      availableTo?: string;
      shift?: string;
      schedule?: { day: string; from: string; to: string; shift: string }[];
    };
    if (!body.email || !body.branch) {
      return NextResponse.json({ error: "email and branch are required" }, { status: 400 });
    }
    const doctor = await ensureDoctor({
      email: body.email,
      name: body.name,
      phone: body.phone,
      branch: body.branch,
      department: body.department,
      consultationFee: body.consultationFee,
      availableDays: body.availableDays,
      availableFrom: body.availableFrom,
      availableTo: body.availableTo,
      shift: body.shift,
      schedule: body.schedule,
    });
    return NextResponse.json(doctor, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
