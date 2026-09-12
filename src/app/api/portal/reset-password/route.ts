import { NextRequest, NextResponse } from "next/server";
import { getPatientLoginByPatientId, updatePatientLogin, addAuditLogRow } from "@/lib/supabase-data";
import { verifyPortalToken, verifyPortalPassword, hashPortalPassword, MIN_PORTAL_PASSWORD } from "@/lib/portal-auth";

// Patient password change. First-login (must_change_password) requires no old
// password; afterwards the current password must be supplied.
export async function POST(req: NextRequest) {
  try {
    const { token, newPassword, currentPassword } = (await req.json()) as {
      token?: string; newPassword?: string; currentPassword?: string;
    };
    if (!token) return NextResponse.json({ error: "Session token is required." }, { status: 401 });
    const patientId = verifyPortalToken(token);
    if (!patientId) return NextResponse.json({ error: "Session expired. Please log in again." }, { status: 401 });
    if (!newPassword || newPassword.length < MIN_PORTAL_PASSWORD) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PORTAL_PASSWORD} characters.` },
        { status: 400 }
      );
    }
    const login = await getPatientLoginByPatientId(patientId);
    if (!login) return NextResponse.json({ error: "Portal access not found." }, { status: 404 });
    if (!login.mustChangePassword) {
      if (!currentPassword || !verifyPortalPassword(currentPassword, login.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });
      }
    }
    await updatePatientLogin(patientId, {
      passwordHash: hashPortalPassword(newPassword),
      mustChangePassword: false,
    });
    await addAuditLogRow({
      actor: login.phone,
      actorEmail: "",
      action: "PATIENT_PASSWORD_CHANGE",
      target: login.phone,
      branch: "",
      details: `Patient ${login.phone} changed their portal password.`,
    }).catch(() => {});
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
