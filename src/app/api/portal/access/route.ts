import { NextRequest, NextResponse } from "next/server";
import {
  upsertPatientLogin, getPatientLoginByPatientId, fetchPatients, fetchPatientLoginStatuses, addAuditLogRow,
} from "@/lib/supabase-data";
import { hashPortalPassword, DEFAULT_TEMP_PASSWORD } from "@/lib/portal-auth";

// Does this patient already have portal login? (Safe fields only, no hash.)
// Without patientId, returns every login status for the patient list.
export async function GET(req: NextRequest) {
  try {
    const patientId = req.nextUrl.searchParams.get("patientId") ?? "";
    if (!patientId) {
      const all = await fetchPatientLoginStatuses().catch(() => []);
      return NextResponse.json(all);
    }
    const existing = await getPatientLoginByPatientId(patientId).catch(() => null);
    if (!existing) return NextResponse.json({ exists: false });
    return NextResponse.json({ exists: true, phone: existing.phone, mustChangePassword: existing.mustChangePassword });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Admin / Receptionist: issue portal access or reset a patient's portal
// password (forgot-password method — no old password needed). Accepts an
// optional custom temporary password, otherwise the default is used.
// The patient is forced through the reset workflow on next login.
export async function POST(req: NextRequest) {
  try {
    const { patientId, phone, tempPassword, actorEmail, actorName, branch } = (await req.json()) as {
      patientId?: string; phone?: string; tempPassword?: string; actorEmail?: string; actorName?: string; branch?: string;
    };
    if (!patientId) return NextResponse.json({ error: "patientId is required" }, { status: 400 });

    const patients = await fetchPatients();
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) return NextResponse.json({ error: "Patient not found." }, { status: 404 });

    const loginPhone = (phone || patient.phone || "").trim();
    if (!loginPhone) {
      return NextResponse.json({ error: "Patient has no phone number. Add one to the patient record first." }, { status: 400 });
    }
    const chosen = (tempPassword || "").trim() || DEFAULT_TEMP_PASSWORD;
    if (chosen.length < 8) {
      return NextResponse.json({ error: "Temporary password must be at least 8 characters." }, { status: 400 });
    }
    const existing = await getPatientLoginByPatientId(patientId);
    await upsertPatientLogin({
      patientId,
      phone: loginPhone,
      passwordHash: hashPortalPassword(chosen),
      mustChangePassword: true,
    });
    await addAuditLogRow({
      actor: actorName || actorEmail || "Staff",
      actorEmail: actorEmail || "",
      action: existing ? "ADMIN_PORTAL_PASSWORD_RESET" : "ADMIN_PORTAL_ACCESS_ISSUED",
      target: loginPhone,
      branch: branch || patient.branch || "",
      details: `${existing ? "Reset" : "Issued"} portal access for ${patient.name} (${loginPhone}) to a temporary password.`,
    }).catch(() => {});
    return NextResponse.json({ success: true, phone: loginPhone, tempPassword: chosen });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "This phone number is already linked to another patient's portal." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}
