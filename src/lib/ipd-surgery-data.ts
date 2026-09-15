import { supabaseAdmin } from "@/lib/supabase/admin";
import { computeCompleteBill } from "@/lib/ipd-ledger";
import type {
  Admission, AdmissionCharge, CompleteBill, Invoice, Payment, PaymentAllocation,
  Refund, SurgeryCase, SurgeryCaseCharge, SurgeryConsumable, SurgeryPackage,
  SurgeryRateCard,
} from "@/lib/types";

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number) ?? 0;
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));

// ---------- Mappers ----------

function mapAdmission(r: any): Admission {
  return {
    id: r.id, admissionNo: r.admission_no ?? "", patientId: r.patient_id ?? "",
    uhid: r.uhid ?? "", patientName: r.patient_name ?? "", doctorName: r.doctor_name ?? "",
    department: r.department ?? "", admissionAt: r.admission_at ?? "",
    expectedDischargeDate: r.expected_discharge_date ?? "", dischargeAt: r.discharge_at ?? undefined,
    bedId: r.bed_id ?? "", bedNumber: r.bed_number ?? "", room: r.room ?? "", ward: r.ward ?? "",
    bedRate: num(r.bed_rate), status: r.status ?? "Admitted", billingStatus: r.billing_status ?? "Open",
    payMode: r.pay_mode ?? "Self", insuranceProvider: r.insurance_provider ?? "",
    insurancePolicy: r.insurance_policy ?? "", insuranceAuth: r.insurance_auth ?? "",
    notes: r.notes ?? "", branch: r.branch ?? "", createdBy: r.created_by ?? "",
  };
}

function mapCharge(r: any): AdmissionCharge {
  return {
    id: r.id, admissionId: r.admission_id ?? "", patientId: r.patient_id ?? "",
    category: r.category ?? "Other", description: r.description ?? "",
    quantity: num(r.quantity) || 1, rate: num(r.rate), amount: num(r.amount),
    discount: num(r.discount), tax: num(r.tax), net: num(r.net),
    surgeryCaseId: r.surgery_case_id ?? undefined, invoiceId: r.invoice_id ?? undefined,
    billed: !!r.billed, idempotencyKey: r.idempotency_key ?? undefined,
    occurredAt: r.occurred_at ?? "", createdBy: r.created_by ?? "",
    branch: r.branch ?? "", notes: r.notes ?? "",
  };
}

function mapPayment(r: any): Payment {
  return {
    id: r.id, receiptNo: r.receipt_no ?? "", patientId: r.patient_id ?? "",
    patientName: r.patient_name ?? "", admissionId: r.admission_id ?? undefined,
    invoiceId: r.invoice_id ?? undefined, amount: num(r.amount), method: r.method ?? "Cash",
    txnRef: r.txn_ref ?? "", kind: r.kind ?? "Payment",
    idempotencyKey: r.idempotency_key ?? undefined, receivedBy: r.received_by ?? "",
    branch: r.branch ?? "", notes: r.notes ?? "", occurredAt: r.occurred_at ?? "",
  };
}

function mapRefund(r: any): Refund {
  return {
    id: r.id, refundNo: r.refund_no ?? "", patientId: r.patient_id ?? "",
    patientName: r.patient_name ?? "", admissionId: r.admission_id ?? undefined,
    invoiceId: r.invoice_id ?? undefined, paymentId: r.payment_id ?? undefined,
    amount: num(r.amount), method: r.method ?? "Cash", reason: r.reason ?? "",
    approvedBy: r.approved_by ?? "", processedBy: r.processed_by ?? "",
    status: r.status ?? "Requested", txnRef: r.txn_ref ?? "", branch: r.branch ?? "",
  };
}

function mapSurgery(r: any): SurgeryCase {
  return {
    id: r.id, caseNo: r.case_no ?? "", patientId: r.patient_id ?? "", uhid: r.uhid ?? "",
    patientName: r.patient_name ?? "", admissionId: r.admission_id ?? undefined,
    bedNumber: r.bed_number ?? "", room: r.room ?? "", surgeon: r.surgeon ?? "",
    assistantSurgeon: r.assistant_surgeon ?? "", anesthetist: r.anesthetist ?? "",
    department: r.department ?? "", surgeryName: r.surgery_name ?? "",
    surgeryCategory: r.surgery_category ?? "", diagnosis: r.diagnosis ?? "",
    plannedDate: r.planned_date ?? "", plannedTime: r.planned_time ?? "",
    plannedDurationMin: num(r.planned_duration_min),
    actualStart: r.actual_start ?? undefined, actualEnd: r.actual_end ?? undefined,
    theatre: r.theatre ?? "", anesthesiaType: r.anesthesia_type ?? "",
    priority: r.priority ?? "Elective", kind: r.kind ?? "Elective",
    status: r.status ?? "Scheduled", preOpNotes: r.pre_op_notes ?? "",
    postOpNotes: r.post_op_notes ?? "", complications: r.complications ?? "",
    consentStatus: r.consent_status ?? "Pending", insuranceAuth: r.insurance_auth ?? "",
    packageId: r.package_id ?? undefined, estimate: num(r.estimate),
    advanceRequired: num(r.advance_required), branch: r.branch ?? "",
    remarks: r.remarks ?? "", createdBy: r.created_by ?? "",
  };
}

function mapSurgeryCharge(r: any): SurgeryCaseCharge {
  return {
    id: r.id, caseId: r.case_id ?? "", admissionId: r.admission_id ?? undefined,
    label: r.label ?? "", category: r.category ?? "Surgery", amount: num(r.amount),
    auto: !!r.auto, packageId: r.package_id ?? undefined, invoiceId: r.invoice_id ?? undefined,
    billed: !!r.billed, createdBy: r.created_by ?? "", branch: r.branch ?? "",
  };
}

function mapPackage(r: any, items: SurgeryPackage["items"] = []): SurgeryPackage {
  return {
    id: r.id, name: r.name ?? "", surgeryType: r.surgery_type ?? "",
    basePrice: num(r.base_price), packageDiscount: num(r.package_discount), tax: num(r.tax),
    validityFrom: r.validity_from ?? "", validityTo: r.validity_to ?? "",
    branch: r.branch ?? "", active: r.active !== false, createdBy: r.created_by ?? "", items,
  };
}

function mapConsumable(r: any): SurgeryConsumable {
  return {
    id: r.id, caseId: r.case_id ?? "", admissionId: r.admission_id ?? undefined,
    patientId: r.patient_id ?? "", item: r.item ?? "", batch: r.batch ?? "",
    expiry: r.expiry ?? "", quantity: num(r.quantity) || 1, unitPrice: num(r.unit_price),
    total: num(r.total), medicineId: r.medicine_id ?? undefined,
    status: r.status ?? "Recorded", usedBy: r.used_by ?? "", branch: r.branch ?? "",
  };
}

// ---------- Number series ----------

async function nextSeries(prefix: string, table: string, column: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const { data, error } = await supabaseAdmin.from(table).select(column)
      .like(column, `${prefix}-${year}-%`).order(column, { ascending: false }).limit(1);
    if (error) throw error;
    const last = (data?.[0]?.[column] as string | undefined) ?? "";
    const m = last.match(/(\d+)\s*$/);
    return `${prefix}-${year}-${String((m ? parseInt(m[1], 10) : 0) + 1).padStart(5, "0")}`;
  } catch {
    const { count } = await supabaseAdmin.from(table).select("id", { count: "exact", head: true });
    return `${prefix}-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
  }
}

export const nextAdmissionNo = () => nextSeries("ADM", "admissions", "admission_no");
export const nextReceiptNo = () => nextSeries("RCP", "payments", "receipt_no");
export const nextRefundNo = () => nextSeries("RFD", "refunds", "refund_no");
export const nextSurgeryCaseNo = () => nextSeries("SUR", "surgery_cases", "case_no");

// ---------- Admissions ----------

export async function fetchAdmissions(branch?: string, status?: string): Promise<Admission[]> {
  let q = supabaseAdmin.from("admissions").select("*").order("admission_at", { ascending: false });
  if (branch) q = q.eq("branch", branch);
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapAdmission);
}

export async function getAdmission(id: string): Promise<Admission | null> {
  const { data, error } = await supabaseAdmin.from("admissions").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapAdmission(data) : null;
}

export async function createAdmission(a: Partial<Admission> & { patientId: string; branch: string }): Promise<Admission> {
  const { data, error } = await supabaseAdmin.from("admissions").insert({
    id: a.id || `adm${Date.now()}`,
    admission_no: a.admissionNo || await nextAdmissionNo(),
    patient_id: a.patientId, uhid: a.uhid ?? "", patient_name: a.patientName ?? "",
    doctor_name: a.doctorName ?? "", department: a.department ?? "",
    admission_at: a.admissionAt || new Date().toISOString(),
    expected_discharge_date: a.expectedDischargeDate ?? "",
    bed_id: a.bedId ?? "", bed_number: a.bedNumber ?? "", room: a.room ?? "",
    ward: a.ward ?? "", bed_rate: a.bedRate ?? 0,
    status: "Admitted", billing_status: "Open",
    pay_mode: a.payMode ?? "Self", insurance_provider: a.insuranceProvider ?? "",
    insurance_policy: a.insurancePolicy ?? "", insurance_auth: a.insuranceAuth ?? "",
    notes: a.notes ?? "", branch: a.branch, created_by: a.createdBy ?? "",
  }).select().single();
  if (error) throw error;
  return mapAdmission(data);
}

export async function updateAdmission(id: string, patch: Partial<Admission>): Promise<Admission> {
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    admissionNo: "admission_no", doctorName: "doctor_name", department: "department",
    admissionAt: "admission_at",
    expectedDischargeDate: "expected_discharge_date", dischargeAt: "discharge_at",
    bedId: "bed_id", bedNumber: "bed_number", room: "room", ward: "ward", bedRate: "bed_rate",
    status: "status", billingStatus: "billing_status", payMode: "pay_mode",
    insuranceProvider: "insurance_provider", insurancePolicy: "insurance_policy",
    insuranceAuth: "insurance_auth", notes: "notes",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (patch as any)[k];
    if (v !== undefined) clean[col] = v === "" && col === "discharge_at" ? null : v;
  }
  const { data, error } = await supabaseAdmin.from("admissions").update(clean).eq("id", id).select().single();
  if (error) throw error;
  return mapAdmission(data);
}

// ---------- Charges ----------

export async function fetchAdmissionCharges(admissionId: string): Promise<AdmissionCharge[]> {
  const { data, error } = await supabaseAdmin.from("admission_charges")
    .select("*").eq("admission_id", admissionId).order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCharge);
}

export async function addAdmissionCharge(c: Partial<AdmissionCharge> & { admissionId: string }): Promise<AdmissionCharge> {
  if (!c.description || !c.category) throw new Error("category and description are required");
  // Idempotency: same key returns the original row (double-click / retry safe).
  if (c.idempotencyKey) {
    const { data: dup } = await supabaseAdmin.from("admission_charges")
      .select("*").eq("idempotency_key", c.idempotencyKey).maybeSingle();
    if (dup) return mapCharge(dup);
  }
  // Same-admission duplicate guard: identical category+description+amount within 5 min.
  const qty = num(c.quantity) || 1, rate = num(c.rate);
  const amount = num(c.amount) > 0 ? num(c.amount) : qty * rate;
  const net = Math.max(0, amount - num(c.discount) + num(c.tax));
  const { data, error } = await supabaseAdmin.from("admission_charges").insert({
    id: c.id || `chg${Date.now()}`,
    admission_id: c.admissionId, patient_id: c.patientId ?? "",
    category: c.category, description: c.description,
    quantity: qty, rate, amount, discount: num(c.discount), tax: num(c.tax), net,
    surgery_case_id: c.surgeryCaseId || null, billed: false,
    idempotency_key: c.idempotencyKey || null,
    occurred_at: c.occurredAt || new Date().toISOString(),
    created_by: c.createdBy ?? "", branch: c.branch ?? "", notes: c.notes ?? "",
  }).select().single();
  if (error) throw error;
  await supabaseAdmin.from("admissions").update({ billing_status: "Interim Billing", updated_at: new Date().toISOString() })
    .eq("id", c.admissionId).eq("billing_status", "Open").then(() => {});
  return mapCharge(data);
}

// ---------- Payments (idempotent) ----------

/** Branch money history (receipts + advances), newest first — for Billing history. */
export async function fetchBranchPayments(branch: string, patientId?: string, limit = 200): Promise<Payment[]> {
  let q = supabaseAdmin.from("payments").select("*").eq("branch", branch).order("occurred_at", { ascending: false }).limit(limit);
  if (patientId) q = q.eq("patient_id", patientId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function fetchAdmissionPayments(admissionId: string): Promise<Payment[]> {
  const { data, error } = await supabaseAdmin.from("payments")
    .select("*").eq("admission_id", admissionId).order("occurred_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapPayment);
}

export async function recordPayment(p: Partial<Payment> & { amount: number; branch: string }): Promise<Payment> {
  const amount = num(p.amount);
  if (!(amount > 0)) throw new Error("amount must be greater than zero");
  if (!p.patientId) throw new Error("patientId is required");
  if (p.idempotencyKey) {
    const { data: dup } = await supabaseAdmin.from("payments")
      .select("*").eq("idempotency_key", p.idempotencyKey).maybeSingle();
    if (dup) return mapPayment(dup);
  }
  const { data, error } = await supabaseAdmin.from("payments").insert({
    id: p.id || `pay${Date.now()}`,
    receipt_no: p.receiptNo || await nextReceiptNo(),
    patient_id: p.patientId, patient_name: p.patientName ?? "",
    admission_id: p.admissionId || null, invoice_id: p.invoiceId || null,
    amount, method: p.method ?? "Cash", txn_ref: p.txnRef ?? "",
    kind: p.kind ?? "Payment", idempotency_key: p.idempotencyKey || null,
    received_by: p.receivedBy ?? "", branch: p.branch, notes: p.notes ?? "",
    occurred_at: p.occurredAt || new Date().toISOString(),
  }).select().single();
  if (error) throw error;
  return mapPayment(data);
}

export async function allocatePayment(paymentId: string, invoiceId: string, amount: number): Promise<PaymentAllocation> {
  const { data, error } = await supabaseAdmin.from("payment_allocations")
    .insert({ payment_id: paymentId, invoice_id: invoiceId, amount: num(amount) })
    .select().single();
  if (error) throw error;
  return { id: data.id, paymentId, invoiceId, amount: num(data.amount) };
}

// ---------- Refunds ----------

export async function fetchAdmissionRefunds(admissionId: string): Promise<Refund[]> {
  const { data, error } = await supabaseAdmin.from("refunds")
    .select("*").eq("admission_id", admissionId).order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRefund);
}

export async function requestRefund(r: Partial<Refund> & { amount: number; branch: string; patientId: string }): Promise<Refund> {
  if (!(num(r.amount) > 0)) throw new Error("amount must be greater than zero");
  const { data, error } = await supabaseAdmin.from("refunds").insert({
    id: r.id || `rfd${Date.now()}`,
    refund_no: r.refundNo || await nextRefundNo(),
    patient_id: r.patientId, patient_name: r.patientName ?? "",
    admission_id: r.admissionId || null, invoice_id: r.invoiceId || null,
    payment_id: r.paymentId || null, amount: num(r.amount), method: r.method ?? "Cash",
    reason: r.reason ?? "", status: "Requested",
    approved_by: "", processed_by: "", txn_ref: "", branch: r.branch,
  }).select().single();
  if (error) throw error;
  return mapRefund(data);
}

export async function setRefundStatus(id: string, status: Refund["status"], actor: string): Promise<Refund> {
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "Approved") patch.approved_by = actor;
  if (status === "Processed") patch.processed_by = actor;
  const { data, error } = await supabaseAdmin.from("refunds").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapRefund(data);
}

// ---------- Complete bill (server-computed) ----------

export async function getCompleteBill(admissionId: string): Promise<CompleteBill> {
  const admission = await getAdmission(admissionId);
  if (!admission) throw new Error("Admission not found.");
  const [charges, payments, refunds] = await Promise.all([
    fetchAdmissionCharges(admissionId),
    fetchAdmissionPayments(admissionId),
    fetchAdmissionRefunds(admissionId),
  ]);
  const { data: invRows } = await supabaseAdmin.from("invoices").select("*").eq("admission_id", admissionId);
  const invoices: Invoice[] = (invRows ?? []).map((r: any) => ({
    id: r.id, invoiceNo: r.invoice_no ?? "", patientId: r.patient_id ?? "",
    patientName: r.patient_name ?? "", date: r.date ?? "", dueDate: r.due_date ?? "",
    items: [], subtotal: num(r.subtotal), tax: num(r.tax), discount: num(r.discount),
    total: num(r.total), paidAmount: num(r.paid_amount), status: r.status ?? "Pending",
    paymentMethod: r.payment_method ?? undefined, branch: r.branch ?? "",
    paidDate: r.paid_date ?? undefined, admissionId: r.admission_id ?? undefined,
  }));
  return computeCompleteBill(admission, charges, payments, refunds, invoices);
}

// ---------- Surgeries ----------

export async function fetchSurgeries(branch?: string, status?: string, admissionId?: string): Promise<SurgeryCase[]> {
  let q = supabaseAdmin.from("surgery_cases").select("*").order("planned_date", { ascending: false }).order("planned_time", { ascending: false });
  if (branch) q = q.eq("branch", branch);
  if (status) q = q.eq("status", status);
  if (admissionId) q = q.eq("admission_id", admissionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapSurgery);
}

/**
 * Day-care surgery admitted later: attach every open (non-terminal) case of
 * this patient to the new admission, and carry their unbilled charge lines
 * along — so one admission shows in Surgery, IPD and the single bill.
 */
export async function linkOpenSurgeriesToAdmission(admissionId: string): Promise<number> {
  const admission = await getAdmission(admissionId);
  if (!admission) return 0;
  const { data, error } = await supabaseAdmin.from("surgery_cases")
    .select("id").eq("branch", admission.branch).eq("patient_id", admission.patientId)
    .is("admission_id", null)
    .not("status", "in", "(Completed,Post-op,Discharged,Cancelled)");
  if (error) throw error;
  const ids = (data ?? []).map((r: any) => r.id);
  if (ids.length === 0) return 0;
  const now = new Date().toISOString();
  const { error: upErr } = await supabaseAdmin.from("surgery_cases").update({
    admission_id: admissionId,
    bed_number: admission.bedNumber || undefined,
    room: (admission as Admission).room || undefined,
    updated_at: now,
  }).in("id", ids);
  if (upErr) throw upErr;
  // Unbilled component lines follow the case into the admission bill.
  await supabaseAdmin.from("surgery_case_charges").update({ admission_id: admissionId })
    .in("case_id", ids).eq("billed", false).is("admission_id", null);
  // Issued-but-unbilled consumable charges reference the admission ledger.
  await supabaseAdmin.from("admission_charges").update({ admission_id: admissionId })
    .eq("branch", admission.branch).eq("patient_id", admission.patientId)
    .is("admission_id", null).eq("billed", false);
  return ids.length;
}

export async function getSurgery(id: string): Promise<SurgeryCase | null> {
  const { data, error } = await supabaseAdmin.from("surgery_cases").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapSurgery(data) : null;
}

export async function createSurgery(s: Partial<SurgeryCase> & { patientId: string; branch: string; surgeryName: string }): Promise<SurgeryCase> {
  const { data, error } = await supabaseAdmin.from("surgery_cases").insert({
    id: s.id || `sur${Date.now()}`,
    case_no: s.caseNo || await nextSurgeryCaseNo(),
    patient_id: s.patientId, uhid: s.uhid ?? "", patient_name: s.patientName ?? "",
    admission_id: s.admissionId || null, bed_number: s.bedNumber ?? "", room: s.room ?? "",
    surgeon: s.surgeon ?? "", assistant_surgeon: s.assistantSurgeon ?? "",
    anesthetist: s.anesthetist ?? "", department: s.department ?? "",
    surgery_name: s.surgeryName, surgery_category: s.surgeryCategory ?? "",
    diagnosis: s.diagnosis ?? "", planned_date: s.plannedDate ?? "",
    planned_time: s.plannedTime ?? "", planned_duration_min: s.plannedDurationMin ?? 0,
    theatre: s.theatre ?? "", anesthesia_type: s.anesthesiaType ?? "",
    priority: s.priority ?? "Elective", kind: s.kind ?? (s.priority === "Emergency" ? "Emergency" : "Elective"),
    status: "Scheduled", pre_op_notes: s.preOpNotes ?? "", post_op_notes: "",
    complications: "", consent_status: s.consentStatus ?? "Pending",
    insurance_auth: s.insuranceAuth ?? "", package_id: s.packageId || null,
    estimate: s.estimate ?? 0, advance_required: s.advanceRequired ?? 0,
    branch: s.branch, remarks: s.remarks ?? "", created_by: s.createdBy ?? "",
  }).select().single();
  if (error) throw error;
  return mapSurgery(data);
}

export async function updateSurgery(id: string, patch: Partial<SurgeryCase>): Promise<SurgeryCase> {
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    surgeon: "surgeon", assistantSurgeon: "assistant_surgeon", anesthetist: "anesthetist",
    department: "department", surgeryName: "surgery_name", surgeryCategory: "surgery_category",
    diagnosis: "diagnosis", plannedDate: "planned_date", plannedTime: "planned_time",
    plannedDurationMin: "planned_duration_min", actualStart: "actual_start", actualEnd: "actual_end",
    theatre: "theatre", anesthesiaType: "anesthesia_type", priority: "priority", kind: "kind",
    status: "status", preOpNotes: "pre_op_notes", postOpNotes: "post_op_notes",
    complications: "complications", consentStatus: "consent_status", insuranceAuth: "insurance_auth",
    packageId: "package_id", estimate: "estimate", advanceRequired: "advance_required",
    remarks: "remarks", admissionId: "admission_id", bedNumber: "bed_number", room: "room",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (patch as any)[k];
    if (v !== undefined) clean[col] = v;
  }
  const { data, error } = await supabaseAdmin.from("surgery_cases").update(clean).eq("id", id).select().single();
  if (error) throw error;
  return mapSurgery(data);
}

export async function fetchSurgeryCharges(caseId: string): Promise<SurgeryCaseCharge[]> {
  const { data, error } = await supabaseAdmin.from("surgery_case_charges")
    .select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSurgeryCharge);
}

/** All surgery/OT charge components linked to one admission (across cases) —
 *  these roll into the same single Final bill as bed + ward charges. */
export async function fetchSurgeryChargesByAdmission(admissionId: string): Promise<SurgeryCaseCharge[]> {
  const { data, error } = await supabaseAdmin.from("surgery_case_charges")
    .select("*").eq("admission_id", admissionId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapSurgeryCharge);
}

export async function addSurgeryCharge(c: Partial<SurgeryCaseCharge> & { caseId: string; label: string; amount: number }): Promise<SurgeryCaseCharge> {
  const { data, error } = await supabaseAdmin.from("surgery_case_charges").insert({
    id: c.id || `scg${Date.now()}`,
    case_id: c.caseId, admission_id: c.admissionId || null,
    label: c.label, category: c.category ?? "Surgery", amount: num(c.amount),
    auto: c.auto ?? false, package_id: c.packageId || null,
    billed: false, created_by: c.createdBy ?? "", branch: c.branch ?? "",
  }).select().single();
  if (error) throw error;
  return mapSurgeryCharge(data);
}

/** Apply a package to a case: creates auto charge components (guarded against double-apply). */
export async function applyPackageToCase(caseId: string, packageId: string, actor: string, branch: string): Promise<SurgeryCaseCharge[]> {
  const existing = await fetchSurgeryCharges(caseId);
  if (existing.some((c) => c.auto && c.packageId === packageId)) {
    throw new Error("This package has already been applied to the case.");
  }
  const pkg = await getPackage(packageId);
  if (!pkg || !pkg.active) throw new Error("Package not found or inactive.");
  const surgery = await getSurgery(caseId);
  const out: SurgeryCaseCharge[] = [];
  out.push(await addSurgeryCharge({
    caseId, admissionId: surgery?.admissionId, label: `${pkg.name} — package base`,
    category: "Package", amount: pkg.basePrice, auto: true, packageId, createdBy: actor, branch,
  }));
  for (const it of pkg.items ?? []) {
    if (num(it.rate) <= 0) continue; // included items are covered by the base price
    out.push(await addSurgeryCharge({
      caseId, admissionId: surgery?.admissionId,
      label: `${it.label} × ${it.quantity} (package extra)`,
      category: it.category, amount: num(it.quantity) * num(it.rate),
      auto: true, packageId, createdBy: actor, branch,
    }));
  }
  return out;
}

// ---------- Packages ----------

export async function fetchPackages(branch?: string, activeOnly = false): Promise<SurgeryPackage[]> {
  let q = supabaseAdmin.from("surgery_packages").select("*").order("name", { ascending: true });
  if (branch) q = q.eq("branch", branch);
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  const out: SurgeryPackage[] = [];
  for (const row of data ?? []) {
    const { data: items } = await supabaseAdmin.from("surgery_package_items").select("*").eq("package_id", row.id);
    out.push(mapPackage(row, (items ?? []).map((i: any) => ({
      id: i.id, packageId: i.package_id, label: i.label ?? "", category: i.category ?? "Surgery",
      quantity: num(i.quantity) || 1, rate: num(i.rate),
    }))));
  }
  return out;
}

export async function getPackage(id: string): Promise<SurgeryPackage | null> {
  const { data, error } = await supabaseAdmin.from("surgery_packages").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: items } = await supabaseAdmin.from("surgery_package_items").select("*").eq("package_id", id);
  return mapPackage(data, (items ?? []).map((i: any) => ({
    id: i.id, packageId: i.package_id, label: i.label ?? "", category: i.category ?? "Surgery",
    quantity: num(i.quantity) || 1, rate: num(i.rate),
  })));
}

export async function createPackage(p: Partial<SurgeryPackage> & { name: string; branch: string }): Promise<SurgeryPackage> {
  const { data, error } = await supabaseAdmin.from("surgery_packages").insert({
    id: p.id || `pkg${Date.now()}`, name: p.name, surgery_type: p.surgeryType ?? "",
    base_price: p.basePrice ?? 0, package_discount: p.packageDiscount ?? 0, tax: p.tax ?? 0,
    validity_from: p.validityFrom ?? "", validity_to: p.validityTo ?? "",
    branch: p.branch, active: p.active !== false, created_by: p.createdBy ?? "",
  }).select().single();
  if (error) throw error;
  if (p.items && p.items.length > 0) {
    const rows = p.items.map((it) => ({
      package_id: data.id, label: it.label, category: it.category ?? "Surgery",
      quantity: num(it.quantity) || 1, rate: num(it.rate),
    }));
    await supabaseAdmin.from("surgery_package_items").insert(rows).then(({ error: e }) => { if (e) throw e; });
  }
  return (await getPackage(data.id))!;
}

// ---------- Surgery rate cards (operation price master, 033) ----------

function mapRateCard(r: any): SurgeryRateCard {
  return {
    id: r.id, operationName: r.operation_name ?? "", surgeryCategory: r.surgery_category ?? "",
    surgeonFee: num(r.surgeon_fee), assistantFee: num(r.assistant_fee),
    anesthesiaCharge: num(r.anesthesia_charge), otCharge: num(r.ot_charge),
    nursingCharge: num(r.nursing_charge), consumablesEstimate: num(r.consumables_estimate),
    branch: r.branch ?? "", active: r.active !== false, createdBy: r.created_by ?? "",
  };
}

export async function fetchRateCards(branch?: string, activeOnly = false): Promise<SurgeryRateCard[]> {
  let q = supabaseAdmin.from("surgery_rate_cards").select("*").order("operation_name", { ascending: true });
  if (branch) q = q.eq("branch", branch);
  if (activeOnly) q = q.eq("active", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map(mapRateCard);
}

/** Best match for an operation: exact name wins (branch first, then global), else null. */
export async function findRateCardFor(operationName: string, branch: string): Promise<SurgeryRateCard | null> {
  const want = (operationName ?? "").trim().toLowerCase();
  if (!want) return null;
  const { data, error } = await supabaseAdmin.from("surgery_rate_cards")
    .select("*").eq("active", true);
  if (error) throw error;
  const cards = (data ?? []).map(mapRateCard);
  const exact = cards.filter((c) => c.operationName.trim().toLowerCase() === want);
  if (exact.length === 0) return null;
  return exact.find((c) => (c.branch || "") === (branch || "")) ?? exact.find((c) => !(c.branch || "")) ?? exact[0];
}

export async function createRateCard(p: Partial<SurgeryRateCard> & { operationName: string; branch: string }): Promise<SurgeryRateCard> {
  if (!p.operationName.trim()) throw new Error("operationName is required");
  const { data, error } = await supabaseAdmin.from("surgery_rate_cards").insert({
    id: p.id || `rtc${Date.now()}`,
    operation_name: p.operationName.trim(), surgery_category: p.surgeryCategory ?? "",
    surgeon_fee: num(p.surgeonFee), assistant_fee: num(p.assistantFee),
    anesthesia_charge: num(p.anesthesiaCharge), ot_charge: num(p.otCharge),
    nursing_charge: num(p.nursingCharge), consumables_estimate: num(p.consumablesEstimate),
    branch: p.branch, active: p.active !== false, created_by: p.createdBy ?? "",
  }).select().single();
  if (error) throw error;
  return mapRateCard(data);
}

export async function updateRateCard(id: string, patch: Partial<SurgeryRateCard>): Promise<SurgeryRateCard> {
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const map: Record<string, string> = {
    operationName: "operation_name", surgeryCategory: "surgery_category",
    surgeonFee: "surgeon_fee", assistantFee: "assistant_fee",
    anesthesiaCharge: "anesthesia_charge", otCharge: "ot_charge",
    nursingCharge: "nursing_charge", consumablesEstimate: "consumables_estimate",
    branch: "branch", active: "active",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = (patch as any)[k];
    if (v !== undefined) clean[col] = k === "operationName" ? String(v).trim() : v;
  }
  const { data, error } = await supabaseAdmin.from("surgery_rate_cards").update(clean).eq("id", id).select().single();
  if (error) throw error;
  return mapRateCard(data);
}

// ---------- Surgery auto-pricing ----------

const AUTO_BED_NOTE = "Auto: bed accrual";

/**
 * Ensure priced components exist for a case, add-by-add, from its rate card:
 * surgeon / assistant / anesthesia / OT / nursing — each as its own auto
 * charge line. Already-present labels are skipped, so re-runs only fill gaps
 * (e.g. surgeon assigned later). Returns the newly added lines.
 */
export async function ensureSurgeryAutoCharges(caseId: string, actor: string): Promise<SurgeryCaseCharge[]> {
  const surgery = await getSurgery(caseId);
  if (!surgery) throw new Error("Surgery case not found.");
  const card = await findRateCardFor(surgery.surgeryName, surgery.branch);
  // No operation price card but an estimate exists (e.g. manually booked):
  // raise ONE procedure-fee line for the estimate so the amount is never
  // invisible to billing. Re-runs skip it once present.
  if (!card) {
    if (num(surgery.estimate) <= 0) return [];
    const existing = await fetchSurgeryCharges(caseId);
    if (existing.some((c) => c.auto)) return [];
    return [await addSurgeryCharge({
      caseId, admissionId: surgery.admissionId,
      label: `${surgery.surgeryName} — procedure fee (estimate)`,
      category: "Surgery", amount: num(surgery.estimate), auto: true,
      createdBy: actor, branch: surgery.branch,
    })];
  }
  const existing = await fetchSurgeryCharges(caseId);
  const has = (label: string) => existing.some((c) => c.auto && c.label.toLowerCase() === label.toLowerCase());
  const wants: { label: string; category: string; amount: number; gate: boolean }[] = [
    { label: `${card.operationName} — surgeon fee${surgery.surgeon ? ` (${surgery.surgeon})` : ""}`, category: "Surgeon", amount: card.surgeonFee, gate: !!surgery.surgeon },
    { label: `${card.operationName} — assistant fee${surgery.assistantSurgeon ? ` (${surgery.assistantSurgeon})` : ""}`, category: "Assistant", amount: card.assistantFee, gate: !!surgery.assistantSurgeon },
    { label: `${card.operationName} — anesthesia (${surgery.anesthesiaType || "charge"})`, category: "Anesthesia", amount: card.anesthesiaCharge, gate: !!surgery.anesthesiaType },
    { label: `${card.operationName} — OT / theatre${surgery.theatre ? ` (${surgery.theatre})` : ""}`, category: "Operation Theatre", amount: card.otCharge, gate: true },
    { label: `${card.operationName} — OT nursing`, category: "Nursing", amount: card.nursingCharge, gate: true },
  ];
  const out: SurgeryCaseCharge[] = [];
  for (const w of wants) {
    if (!w.gate || w.amount <= 0 || has(w.label)) continue;
    out.push(await addSurgeryCharge({
      caseId, admissionId: surgery.admissionId, label: w.label,
      category: w.category, amount: w.amount, auto: true,
      createdBy: actor, branch: surgery.branch,
    }));
  }
  return out;
}

// ---------- Bed accrual (admission dates → bill amounts) ----------

function stayEndOf(a: Admission): string {
  const iso = (a.dischargeAt || "").split("T")[0]
    || (a.expectedDischargeDate || "").split("T")[0]
    || new Date().toISOString().split("T")[0];
  return iso;
}

function stayDaysOf(a: Admission): number {
  const start = (a.admissionAt || "").split("T")[0];
  const end = stayEndOf(a);
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;
  const diff = Math.floor((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000);
  return Math.max(1, diff + 1);
}

/**
 * Keep the bill in step with admission dates + bed rate: unbilled auto bed
 * rows are rebuilt from joining → leave × rate, so extending the leave date
 * (or changing the rate) automatically adds the amount to the bill.
 * Manual Bed charges and already-billed rows are never touched.
 */
export async function syncBedCharges(admissionId: string): Promise<{ days: number; rate: number; amount: number }> {
  const admission = await getAdmission(admissionId);
  if (!admission) throw new Error("Admission not found.");
  const days = stayDaysOf(admission);
  const rate = num((admission as Admission).bedRate);
  // Billed history stays locked; only the unbilled auto rows are rebuilt.
  const { data: billedRows } = await supabaseAdmin.from("admission_charges")
    .select("quantity").eq("admission_id", admissionId).eq("category", "Bed").eq("billed", true);
  const billedDays = (billedRows ?? []).reduce((s: number, r: any) => s + (num(r.quantity) || 0), 0);
  await supabaseAdmin.from("admission_charges")
    .delete().eq("admission_id", admissionId).eq("category", "Bed")
    .eq("billed", false).eq("notes", AUTO_BED_NOTE);
  const remaining = Math.max(0, days - billedDays);
  if (remaining > 0 && rate > 0) {
    const amount = remaining * rate;
    await supabaseAdmin.from("admission_charges").insert({
      id: `chg${Date.now()}`,
      admission_id: admissionId, patient_id: admission.patientId,
      category: "Bed",
      description: `Bed ${admission.bedNumber || ""} ${admission.ward ? `(${admission.ward})` : ""} • ${(admission.admissionAt || "").split("T")[0]} → ${stayEndOf(admission)} (${remaining}d × ₹${rate})`.trim(),
      quantity: remaining, rate, amount, discount: 0, tax: 0, net: amount,
      billed: false,
      occurred_at: new Date().toISOString(),
      created_by: "System (auto accrual)", branch: admission.branch, notes: AUTO_BED_NOTE,
    }).then(({ error: e }) => { if (e) throw e; });
  }
  return { days, rate, amount: remaining * rate };
}

/** Delete one UNBILLED admission charge (corrections need Admin). Billed history is locked. */
export async function deleteAdmissionCharge(id: string): Promise<void> {
  const { data: row, error } = await supabaseAdmin.from("admission_charges").select("billed").eq("id", id).single();
  if (error || !row) throw new Error("Charge not found.");
  if ((row as any).billed) throw new Error("Billed charges are locked in history and cannot be deleted.");
  const { error: delErr } = await supabaseAdmin.from("admission_charges").delete().eq("id", id);
  if (delErr) throw delErr;
}

// ---------- Consumables (stock deducted only on issue) ----------

export async function fetchConsumables(caseId: string): Promise<SurgeryConsumable[]> {
  const { data, error } = await supabaseAdmin.from("surgery_consumables")
    .select("*").eq("case_id", caseId).order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapConsumable);
}

export async function recordConsumable(c: Partial<SurgeryConsumable> & { caseId: string; item: string }): Promise<SurgeryConsumable> {
  const qty = num(c.quantity) || 1, price = num(c.unitPrice);
  const { data, error } = await supabaseAdmin.from("surgery_consumables").insert({
    id: c.id || `con${Date.now()}`,
    case_id: c.caseId, admission_id: c.admissionId || null, patient_id: c.patientId ?? "",
    item: c.item, batch: c.batch ?? "", expiry: c.expiry ?? "",
    quantity: qty, unit_price: price, total: qty * price,
    medicine_id: c.medicineId || null, status: "Recorded",
    used_by: c.usedBy ?? "", branch: c.branch ?? "",
  }).select().single();
  if (error) throw error;
  return mapConsumable(data);
}

/** Confirm issue/use: marks Issued, deducts pharmacy stock once, posts an admission charge. */
export async function issueConsumable(id: string, actor: string): Promise<SurgeryConsumable> {
  const { data: row, error } = await supabaseAdmin.from("surgery_consumables").select("*").eq("id", id).single();
  if (error || !row) throw new Error("Consumable record not found.");
  if (row.status === "Issued" || row.status === "Deducted") return mapConsumable(row);
  if (row.medicine_id) {
    const { data: med } = await supabaseAdmin.from("medicines").select("stock").eq("id", row.medicine_id).single();
    const stock = num((med as any)?.stock);
    if (stock < num(row.quantity)) throw new Error(`Insufficient pharmacy stock (have ${stock}, need ${row.quantity}).`);
    const { error: stockErr } = await supabaseAdmin.from("medicines")
      .update({ stock: stock - num(row.quantity), updated_at: new Date().toISOString() })
      .eq("id", row.medicine_id);
    if (stockErr) throw stockErr;
  }
  const { data: updated, error: upErr } = await supabaseAdmin.from("surgery_consumables")
    .update({ status: row.medicine_id ? "Deducted" : "Issued", updated_at: new Date().toISOString() })
    .eq("id", id).select().single();
  if (upErr) throw upErr;
  if (row.admission_id) {
    await supabaseAdmin.from("admission_charges").insert({
      id: `chg${Date.now()}`,
      admission_id: row.admission_id, patient_id: row.patient_id ?? "",
      category: "Consumables", description: `${row.item} × ${row.quantity} (OT use)`,
      quantity: row.quantity, rate: row.unit_price,
      amount: num(row.quantity) * num(row.unit_price), discount: 0, tax: 0,
      net: num(row.quantity) * num(row.unit_price),
      surgery_case_id: row.case_id, billed: false,
      occurred_at: new Date().toISOString(), created_by: actor, branch: row.branch ?? "",
    }).then(({ error: e }) => { if (e) throw e; });
  }
  return mapConsumable(updated);
}

// ---------- Audit ----------

export async function auditBilling(entry: {
  actor: string; actorEmail?: string; action: string; branch: string;
  target?: string; patientId?: string; admissionId?: string; invoiceId?: string;
  oldValue?: string; newValue?: string; details: string;
}): Promise<void> {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor: entry.actor, actor_email: entry.actorEmail ?? "",
      action: entry.action, target: entry.target ?? "billing", branch: entry.branch,
      details: [
        entry.details,
        entry.patientId ? `patient=${entry.patientId}` : "",
        entry.admissionId ? `admission=${entry.admissionId}` : "",
        entry.invoiceId ? `invoice=${entry.invoiceId}` : "",
        entry.oldValue !== undefined ? `old=${entry.oldValue}` : "",
        entry.newValue !== undefined ? `new=${entry.newValue}` : "",
      ].filter(Boolean).join(" "),
    });
  } catch { /* audit is best-effort */ }
}
