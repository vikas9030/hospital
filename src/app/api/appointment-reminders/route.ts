import { NextRequest, NextResponse } from "next/server";
import { fetchAppointmentReminders, createAppointmentReminder } from "@/lib/supabase-data";

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    return NextResponse.json(await fetchAppointmentReminders(branch));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.id || !body.appointmentId) {
      return NextResponse.json({ error: "id and appointmentId are required" }, { status: 400 });
    }
    const saved = await createAppointmentReminder({
      id: body.id,
      appointmentId: body.appointmentId,
      patientId: body.patientId ?? "",
      patientName: body.patientName ?? "",
      patientPhone: body.patientPhone ?? "",
      doctorName: body.doctorName ?? "",
      department: body.department ?? "",
      appointmentDate: body.appointmentDate ?? "",
      appointmentTime: body.appointmentTime ?? "",
      minutesBefore: body.minutesBefore ?? 30,
      sentAt: body.sentAt ?? new Date().toISOString(),
      method: body.method ?? "push",
      status: body.status ?? "sent",
      branch: body.branch ?? "",
    });
    return NextResponse.json(saved, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
