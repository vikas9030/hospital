import { NextRequest, NextResponse } from "next/server";
import { getPatientLoginsByPhone, updatePatientLogin } from "@/lib/supabase-data";
import { verifyPortalPassword, signPortalToken } from "@/lib/portal-auth";

// Patient login with phone number + password.
export async function POST(req: NextRequest) {
  try {
    const { phone, password } = (await req.json()) as { phone?: string; password?: string };
    if (!phone || !password) {
      return NextResponse.json({ error: "Phone number and password are required." }, { status: 400 });
    }
    // Same phone can back several logins (family sharing, both branches):
    // accept whichever stored hash verifies.
    const candidates = await getPatientLoginsByPhone(phone.trim());
    const login = candidates.find((c) => verifyPortalPassword(password, c.passwordHash));
    if (!login) {
      return NextResponse.json({ error: "Invalid phone number or password." }, { status: 401 });
    }
    await updatePatientLogin(login.patientId, { lastLoginAt: new Date().toISOString() }).catch(() => {});
    return NextResponse.json({
      token: signPortalToken(login.patientId),
      patientId: login.patientId,
      phone: login.phone,
      mustChangePassword: login.mustChangePassword,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
