import { NextRequest, NextResponse } from "next/server";
import { fetchSurgeryCharges, fetchSurgeryChargesByAdmission, addSurgeryCharge, applyPackageToCase, ensureSurgeryAutoCharges, auditBilling } from "@/lib/ipd-surgery-data";

export async function GET(req: NextRequest) {
  try {
    const caseId = req.nextUrl.searchParams.get("caseId") ?? "";
    const admissionId = req.nextUrl.searchParams.get("admissionId") ?? "";
    // Admission view: every surgery/OT component for one single bill.
    if (admissionId) return NextResponse.json(await fetchSurgeryChargesByAdmission(admissionId));
    if (!caseId) return NextResponse.json({ error: "caseId or admissionId is required" }, { status: 400 });
    return NextResponse.json(await fetchSurgeryCharges(caseId));
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Body: { caseId, label, amount, ... } for a manual component,
// { caseId, packageId, applyPackage: true } to expand a package (double-apply guarded), or
// { caseId, autoPrice: true } to fill priced components from the operation rate card.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.caseId) return NextResponse.json({ error: "caseId is required" }, { status: 400 });
    if (body.autoPrice) {
      const created = await ensureSurgeryAutoCharges(body.caseId, body.createdBy || "Staff");
      await auditBilling({
        actor: body.createdBy || "Staff", action: "SURGERY_AUTO_PRICED",
        branch: body.branch || "", details: `${created.length} priced component(s) auto-added to surgery ${body.caseId} from the operation rate card.`,
      });
      return NextResponse.json(created, { status: 201 });
    }
    if (body.applyPackage) {
      if (!body.packageId) return NextResponse.json({ error: "packageId is required" }, { status: 400 });
      const created = await applyPackageToCase(body.caseId, body.packageId, body.createdBy || "Staff", body.branch || "");
      await auditBilling({
        actor: body.createdBy || "Staff", action: "SURGERY_PACKAGE_APPLIED",
        branch: body.branch || "", details: `Package applied to surgery ${body.caseId} (${created.length} components).`,
      });
      return NextResponse.json(created, { status: 201 });
    }
    if (!body.label) return NextResponse.json({ error: "label is required" }, { status: 400 });
    const created = await addSurgeryCharge(body);
    await auditBilling({
      actor: body.createdBy || "Staff", action: "SURGERY_CHARGE_ADDED",
      branch: created.branch, details: `Surgery charge ${created.label} ₹${created.amount} added to ${body.caseId}.`,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    const status = /already been applied/i.test(e.message ?? "") ? 409 : 500;
    return NextResponse.json({ error: e.message }, { status });
  }
}
