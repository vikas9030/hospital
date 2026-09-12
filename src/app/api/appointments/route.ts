import { NextRequest, NextResponse } from "next/server";
import { fetchAppointments, fetchAppointmentById, createAppointment, updateAppointmentStatus, deleteAppointmentRow } from "@/lib/supabase-data";
import type { Appointment } from "@/lib/types";

// Cancel/delete permission: Admin → everything; Receptionist → everything;
// Doctor (or doctor-like role) → only visits where they are the doctor.
// (GET/POST stay open for booking flows; the UI gates those by module access.)
function canManageSchedule(
  actorRole: string | undefined,
  actorName: string | undefined,
  apt: { doctorName?: string; doctorId?: string } | null
): boolean {
  if (!actorRole) return false;
  if (actorRole === "Admin" || actorRole === "Receptionist") return true;
  if (actorRole === "Doctor" || /doctor/i.test(actorRole)) {
    if (!actorName || !apt?.doctorName) return false;
    const norm = (s: string) => s.trim().toLowerCase().replace(/^dr\.?\s+/, "");
    return norm(actorName) === norm(apt.doctorName);
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const date = req.nextUrl.searchParams.get("date") ?? undefined;
    const data = await fetchAppointments(branch, date);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Appointment;
    if (!body.patientId || !body.date || !body.time || !body.branch) {
      return NextResponse.json({ error: "patientId, date, time, and branch are required" }, { status: 400 });
    }
    if (!body.doctorId) {
      return NextResponse.json({ error: "Please select a doctor for the appointment." }, { status: 400 });
    }
    const created = await createAppointment(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { error: /foreign key/i.test(e.message ?? "") ? "Selected patient or doctor no longer exists." : e.message },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; status?: string; token?: string; date?: string; time?: string; doctorId?: string; doctorName?: string; department?: string; reason?: string; clinicalNotes?: string; problems?: string; cancelledBy?: string; cancelReason?: string; actorRole?: string; actorName?: string };
    if (!body.id || (body.status === undefined && body.token === undefined && body.date === undefined && body.time === undefined && body.doctorId === undefined && body.doctorName === undefined && body.department === undefined && body.reason === undefined && body.clinicalNotes === undefined && body.problems === undefined)) {
      return NextResponse.json({ error: "id and at least one field to update are required" }, { status: 400 });
    }
    // Cancelling (or any status change) is restricted: Admin/Receptionist can
    // act on any visit; doctors only on their own patients' visits.
    if (body.status !== undefined) {
      const existing = await fetchAppointmentById(body.id).catch(() => null);
      if (!canManageSchedule(body.actorRole, body.actorName, existing)) {
        return NextResponse.json({ error: "Only Receptionist, Admin, or the assigned doctor can change this visit." }, { status: 403 });
      }
    }
    const updated = await updateAppointmentStatus(body.id, {
      status: body.status,
      token: body.token,
      date: body.date,
      time: body.time,
      doctorId: body.doctorId,
      doctorName: body.doctorName,
      department: body.department,
      reason: body.reason,
      clinicalNotes: body.clinicalNotes,
      problems: body.problems,
      cancelledBy: body.cancelledBy,
      cancelReason: body.cancelReason,
    });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, actorRole, actorName } = (await req.json()) as { id?: string; actorRole?: string; actorName?: string };
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    // Hard delete (duplicate cleanup) uses the same permission rule.
    const existing = await fetchAppointmentById(id).catch(() => null);
    if (!canManageSchedule(actorRole, actorName, existing)) {
      return NextResponse.json({ error: "Only Receptionist, Admin, or the assigned doctor can delete this visit." }, { status: 403 });
    }
    await deleteAppointmentRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
