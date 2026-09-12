import { NextRequest, NextResponse } from "next/server";
import { fetchPatients, createPatient, updatePatientRow, deletePatientRow } from "@/lib/supabase-data";
import { normalizePhone } from "@/lib/utils";
import type { Patient } from "@/lib/types";

async function phoneClash(phone: string | undefined, excludeId?: string): Promise<Patient | null> {
  const needle = normalizePhone(phone);
  if (!needle) return null;
  const all = await fetchPatients();
  return all.find((p) => p.id !== excludeId && normalizePhone(p.phone) === needle) ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const branch = req.nextUrl.searchParams.get("branch") ?? undefined;
    const data = await fetchPatients(branch);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Patient;
    if (!body.name || !body.phone || !body.branch) {
      return NextResponse.json({ error: "name, phone, and branch are required" }, { status: 400 });
    }
    // Every patient keeps an individual phone number — no duplicates.
    const clash = await phoneClash(body.phone).catch(() => null);
    if (clash) {
      return NextResponse.json(
        { error: `This phone number already belongs to ${clash.name} (${clash.uhid}). Each patient needs their own number.` },
        { status: 409 }
      );
    }
    const created = await createPatient(body);
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const duplicate = /duplicate key|unique/i.test(e.message ?? "");
    return NextResponse.json(
      { error: duplicate ? "A patient with this UHID already exists." : e.message },
      { status: duplicate ? 409 : 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<Patient> & { id?: string };
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (body.phone) {
      const clash = await phoneClash(body.phone, body.id).catch(() => null);
      if (clash) {
        return NextResponse.json(
          { error: `This phone number already belongs to ${clash.name} (${clash.uhid}). Each patient needs their own number.` },
          { status: 409 }
        );
      }
    }
    const updated = await updatePatientRow(body.id, body);
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = (await req.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    await deletePatientRow(id);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
