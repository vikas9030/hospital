import { NextRequest, NextResponse } from "next/server";
import {
  fetchAppointmentRequests, createAppointmentRequest, updateAppointmentRequest,
  createAppointment, createInvoice, createNotification, fetchDoctors,
} from "@/lib/supabase-data";
import type { AppointmentRequest } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId") ?? undefined;
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const data = await fetchAppointmentRequests(patientId, branch, status);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AppointmentRequest & { notify?: boolean };
    if (!body.patientId || !body.patientName || !body.doctorName || !body.date || !body.time || !body.branch) {
      return NextResponse.json({ error: "patient, doctor, date, time and branch are required" }, { status: 400 });
    }
    const created = await createAppointmentRequest({
      ...body,
      id: body.id || `ar${Date.now()}`,
      status: "Requested",
    });
    // Notify front-desk staff of the incoming request.
    if (body.notify !== false) {
      await createNotification({
        id: `nt${Date.now()}`,
        userId: "",
        type: "appointment",
        title: "New visit request",
        message: `${created.patientName} requested ${created.doctorName} on ${created.date} at ${created.time}.`,
        time: new Date().toISOString(),
        read: false,
        priority: "medium",
        branch: created.branch,
      } as any).catch(() => {});
    }
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as { id?: string; status?: AppointmentRequest["status"]; actorRole?: string };
    if (!body.id || !body.status) {
      return NextResponse.json({ error: "id and status are required" }, { status: 400 });
    }
    // Only Receptionist and Admin may accept/reject patient visit requests.
    // (GET stays open so the patient portal can read its own requests.)
    if (body.actorRole !== "Admin" && body.actorRole !== "Receptionist") {
      return NextResponse.json({ error: "Only Receptionist or Admin can act on visit requests." }, { status: 403 });
    }
    if (body.status !== "Accepted") {
      const updated = await updateAppointmentRequest(body.id, body.status);
      return NextResponse.json({ appointment: null, request: updated });
    }
    // Accept: flip the request, book the appointment (server token), raise
    // the pending OP bill payable at the hospital.
    const pending = await updateAppointmentRequest(body.id, "Accepted");
    const doctors = await fetchDoctors(pending.branch).catch(() => fetchDoctors());
    const doctor = doctors.find((d) => d.id === pending.doctorId) || doctors.find((d) => d.name === pending.doctorName);
    const fee = pending.fee > 0 ? pending.fee : doctor?.consultationFee ?? 0;
    const appointment = await createAppointment({
      id: `a${Date.now()}`,
      token: "",
      patientId: pending.patientId,
      patientName: pending.patientName,
      patientPhoto: pending.patientName.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
      doctorId: doctor?.id || pending.doctorId,
      doctorName: pending.doctorName,
      department: pending.department || doctor?.department || "",
      date: pending.date,
      time: pending.time,
      type: "Walk-in",
      status: "Scheduled",
      reason: pending.reason || "Patient request",
      waitingTime: 0,
      branch: pending.branch,
    } as any);
    let invoice: any = null;
    if (fee > 0) {
      invoice = await createInvoice({
        id: `inv${Date.now()}`,
        invoiceNo: "",
        patientId: pending.patientId,
        patientName: pending.patientName,
        date: pending.date,
        dueDate: pending.date,
        items: [{
          description: `OPD Consultation — ${pending.doctorName}${pending.department ? ` (${pending.department})` : ""}`,
          category: "OPD",
          quantity: 1,
          rate: fee,
          amount: fee,
        }],
        subtotal: fee,
        tax: 0,
        discount: 0,
        total: fee,
        paidAmount: 0,
        status: "Pending",
        paymentMethod: "",
        branch: pending.branch,
        paidDate: "",
      } as any);
    }
    await createNotification({
      id: `nt${Date.now()}x`,
      userId: "",
      type: "appointment",
      title: "Visit request accepted",
      message: `${pending.patientName} booked with ${pending.doctorName} — token ${appointment.token}.`,
      time: new Date().toISOString(),
      read: false,
      priority: "low",
      branch: pending.branch,
    } as any).catch(() => {});
    return NextResponse.json({ appointment, invoice, request: pending });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
