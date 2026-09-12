import { NextRequest, NextResponse } from "next/server";
import {
  fetchPatients, fetchAppointments, fetchPrescriptions, fetchLabTests,
  fetchRadiologyOrders, fetchInvoices, fetchMedicalRecords, getPatientLoginByPatientId,
  fetchAppointmentRequests, fetchDoctors, fetchDoctorSchedules, fetchAppSettings, fetchStaff,
} from "@/lib/supabase-data";
import { verifyPortalToken } from "@/lib/portal-auth";

// Everything the patient portal needs, scoped strictly to the token's patient.
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token") ?? "";
    const patientId = verifyPortalToken(token);
    if (!patientId) return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });

    // Each section loads independently — one unavailable table (e.g. a
    // pending migration) can never block the whole login again.
    const settle = async <T>(op: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await op();
      } catch {
        return fallback;
      }
    };
    const [patients, appointments, prescriptions, labTests, radiologyOrders, invoices, medicalRecords, login, requests, doctors, schedules, settings, staffMembers] =
      await Promise.all([
        fetchPatients(),
        settle(() => fetchAppointments(), []),
        settle(() => fetchPrescriptions(patientId), []),
        settle(() => fetchLabTests(), []),
        settle(() => fetchRadiologyOrders(), []),
        settle(() => fetchInvoices(), []),
        settle(() => fetchMedicalRecords(), []),
        settle(() => getPatientLoginByPatientId(patientId), null),
        settle(() => fetchAppointmentRequests(patientId), []),
        settle(() => fetchDoctors(), []),
        settle(() => fetchDoctorSchedules(), []),
        settle(() => fetchAppSettings(), {} as Record<string, string>),
        settle(() => fetchStaff(), []),
      ]);

    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return NextResponse.json({ error: "Patient record not found." }, { status: 404 });

    // Merge duplicate doctor rows (staff-sync rows + canonical rows, possibly
    // across branches) by normalized name, preferring real emails, set fees,
    // departments and the union of available days. Staff records backfill any
    // fee/schedule still missing, so the portal never shows a bare "Free"
    // card when the fee exists elsewhere in the backend.
    const normName = (n: string) => n.trim().toLowerCase().replace(/^dr\.?\s+/, "");
    const normEmail = (e: string) => (e || "").trim().toLowerCase();
    const normBranch = (b: string) => (b || "").trim().toLowerCase();
    const groups = new Map<string, any[]>();
    for (const d of doctors as any[]) {
      const key = normName(d.name || "");
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }
    const pick = (vals: any[]) => vals.find((v) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0));
    const inBranch = (rows: any[]) => {
      const same = rows.filter((x) => !patient.branch || !x.branch || normBranch(x.branch) === normBranch(patient.branch));
      return same.length > 0 ? same : rows;
    };
    const mergedDoctors = [...groups.values()].map((g) => {
      const rows = inBranch(g);
      const primary =
        rows.find((x) => x.email && !String(x.email).endsWith("@medicore.local")) || rows[0];
      const days = [...new Set([
        ...g.flatMap((x) => x.availableDays ?? []),
        ...g.flatMap((x) => (x.schedule ?? []).map((s: any) => s.day)),
      ])];
      const schedules = g.flatMap((x) => x.schedule ?? []);
      const schedule = schedules.length > 0 ? schedules : primary.schedule ?? [];
      const fees = g.map((x) => x.consultationFee ?? 0).filter((f: number) => f > 0);
      const merged: any = {
        ...primary,
        department: pick([primary.department, ...g.map((x) => x.department)]) ?? primary.department,
        specialization: pick([primary.specialization, ...g.map((x) => x.specialization)]) ?? primary.specialization,
        qualification: pick([primary.qualification, ...g.map((x) => x.qualification)]) ?? primary.qualification,
        phone: pick([primary.phone, ...g.map((x) => x.phone)]) ?? primary.phone,
        consultationFee: primary.consultationFee > 0 ? primary.consultationFee : fees.length > 0 ? Math.max(...fees) : 0,
        availableDays: days.length > 0 ? days : primary.availableDays ?? [],
        schedule,
      };
      // Staff-record backfill: fee / days / department stored on the staff row.
      if (merged.consultationFee <= 0 || (merged.availableDays ?? []).length === 0 || !merged.department) {
        const staff = (staffMembers as any[]).find(
          (s) =>
            (s.email && normEmail(s.email) === normEmail(merged.email)) ||
            normName(s.name || "") === normName(merged.name || "")
        );
        if (staff) {
          if (merged.consultationFee <= 0 && (staff.consultationFee ?? 0) > 0) merged.consultationFee = staff.consultationFee;
          if ((merged.availableDays ?? []).length === 0 && Array.isArray(staff.availableDays) && staff.availableDays.length > 0) merged.availableDays = staff.availableDays;
          if (!merged.department && staff.department) {
            merged.department = staff.department;
            if (!merged.specialization) merged.specialization = staff.department;
          }
        }
      }
      return merged;
    });

    const mine = <T extends { patientId?: string }>(list: T[]) => list.filter((r) => r.patientId === patientId);
    return NextResponse.json({
      patient,
      mustChangePassword: login?.mustChangePassword ?? false,
      appointments: mine(appointments),
      prescriptions,
      labTests: mine(labTests),
      radiologyOrders: mine(radiologyOrders),
      invoices: mine(invoices),
      medicalRecords: mine(medicalRecords),
      requests,
      doctors: mergedDoctors,
      schedules,
      clinic: {
        name: (settings as Record<string, string>).invoiceHospitalName || "MediCore Hospital",
        opExpiryDays: parseInt((settings as Record<string, string>).opExpiryDays ?? "30") || 0,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
