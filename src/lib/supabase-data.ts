import { supabaseAdmin } from "@/lib/supabase/admin";
import { normalizeExpiryDate } from "@/lib/utils";
import type {
  Patient, TimelineEvent, Doctor, Appointment, Bed,
  Invoice, InvoiceItem, Medicine, LabTest, RadiologyOrder,
  InsuranceClaim, Lead, Campaign, StaffMember, InventoryItem,
  Branch, Notification, DoctorBranchSchedule, MedicalRecord,
  Prescription, PrescriptionItem, AppointmentRequest, DayShift,
  NurseAssignment, VitalsEntry, FirstAidEntry, Expense, Department, AttendanceRecord,
} from "@/lib/types";

// ---- Pending-migration resilience ----
// If a Supabase migration hasn't been applied yet (e.g. the findings/problems
// columns), PostgREST fails the whole write with a "schema cache" error.
// These helpers retry the write without the missing columns so the rest of
// the data still saves, and log a one-time server warning naming the fix.
const warnedMissingColumns = new Set<string>();

function schemaCacheColumn(e: any): string | null {
  const m = /Could not find the '([^']+)' column .* in the schema cache/i.exec(e?.message ?? "");
  return m ? m[1] : null;
}

async function withColumnFallback<T>(
  table: string,
  payload: Record<string, unknown>,
  op: (clean: Record<string, unknown>) => Promise<T>,
): Promise<T> {
  const clean = { ...payload };
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await op(clean);
    } catch (e: any) {
      const col = schemaCacheColumn(e);
      if (!col || !(col in clean)) throw e;
      const key = `${table}.${col}`;
      if (!warnedMissingColumns.has(key)) {
        warnedMissingColumns.add(key);
        console.warn(
          `[supabase-data] ${key} is missing — run the pending SQL migrations in Supabase. ` +
          `Writes continue without this column until then.`
        );
      }
      delete clean[col];
    }
  }
  throw new Error("Unreachable column-fallback loop");
}

function mapPatient(row: any): Patient {
  return {
    id: row.id,
    uhid: row.uhid,
    name: row.name,
    photo: row.photo ?? "",
    gender: row.gender,
    age: row.age,
    phone: row.phone,
    email: row.email,
    bloodGroup: row.blood_group,
    address: row.address,
    emergencyContact: row.emergency_contact,
    insuranceProvider: row.insurance_provider ?? "",
    insurancePolicy: row.insurance_policy ?? "",
    allergies: row.allergies ?? [],
    chronicDiseases: row.chronic_diseases ?? [],
    status: row.status,
    lastVisit: row.last_visit ?? "",
    registeredOn: row.registered_on ?? "",
    branch: row.branch,
    opDate: row.op_date ?? "",
    opFees: row.op_fees ?? 0,
    doctorId: row.doctor_id ?? "",
    doctorName: row.doctor_name ?? "",
  };
}

function mapTimelineEvent(row: any): TimelineEvent {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    timestamp: row.timestamp,
    doctor: row.doctor,
    status: row.status,
    amount: row.amount,
  };
}

function mapDoctor(row: any): Doctor {
  return {
    id: row.id,
    name: row.name,
    photo: row.photo ?? "",
    specialization: row.specialization,
    department: row.department,
    experience: row.experience,
    qualification: row.qualification,
    phone: row.phone,
    email: row.email,
    availability: row.availability,
    rating: row.rating,
    consultationFee: row.consultation_fee,
    todayAppointments: row.today_appointments,
    patientsTreated: row.patients_treated,
    branch: row.branch,
    availableDays: row.available_days ?? [],
    availableFrom: row.available_from ?? "",
    availableTo: row.available_to ?? "",
    shift: row.shift ?? "",
    schedule: parseScheduleJson(row.schedule_json),
  };
}

function parseScheduleJson(raw: unknown): DayShift[] {
  try {
    if (!raw) return [];
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((e) => e && e.day && e.from && e.to)
      .map((e) => ({ day: String(e.day), from: String(e.from), to: String(e.to), shift: String(e.shift || "") }));
  } catch {
    return [];
  }
}

function mapAppointment(row: any): Appointment {
  return {
    id: row.id,
    token: row.token,
    patientId: row.patient_id,
    patientName: row.patient_name,
    patientPhoto: row.patient_photo ?? "",
    doctorId: row.doctor_id,
    doctorName: row.doctor_name,
    department: row.department,
    date: row.date,
    time: row.time,
    type: row.type,
    status: row.status,
    reason: row.reason,
    waitingTime: row.waiting_time,
      branch: row.branch,
      clinicalNotes: row.clinical_notes ?? "",
      problems: row.problems ?? "",
      cancelledBy: row.cancelled_by ?? "",
      cancelledAt: row.cancelled_at ?? "",
      cancelReason: row.cancel_reason ?? "",
    };
  }

  export async function fetchAppointmentById(id: string): Promise<Appointment | null> {
    const { data, error } = await supabaseAdmin.from("appointments").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? mapAppointment(data) : null;
  }

function mapBed(row: any): Bed {
  return {
    id: row.id,
    number: row.number,
    ward: row.ward,
    status: row.status,
    patientName: row.patient_name,
    patientId: row.patient_id,
    admittedOn: row.admitted_on,
    dailyRate: row.daily_rate,
    branch: row.branch,
    type: row.type ?? "",
    doctorName: row.doctor_name ?? "",
    diagnosis: row.diagnosis ?? "",
    department: row.department ?? "",
  };
}

function mapInvoice(row: any): Invoice {
  return {
    id: row.id,
    invoiceNo: row.invoice_no,
    patientId: row.patient_id,
    patientName: row.patient_name,
    date: row.date,
    dueDate: row.due_date,
    items: [],
    subtotal: row.subtotal,
    tax: row.tax,
    discount: row.discount,
    discountPercent: row.discount_percent ?? 0,
    gstPercent: row.gst_percent ?? 0,
    gstAmount: row.gst_amount ?? 0,
    cstPercent: row.cst_percent ?? 0,
    cstAmount: row.cst_amount ?? 0,
    total: row.total,
    paidAmount: row.paid_amount,
    status: row.status,
    paymentMethod: row.payment_method,
    branch: row.branch,
    paidDate: row.paid_date ?? "",
  };
}

function mapInvoiceItem(row: any): InvoiceItem {
  return {
    description: row.description,
    category: row.category,
    quantity: row.quantity,
    rate: row.rate,
    amount: row.amount,
  };
}

export async function fetchInvoiceItems(invoiceId: string): Promise<InvoiceItem[]> {
  const { data, error } = await supabaseAdmin
    .from("invoice_items")
    .select("*")
    .eq("invoice_id", invoiceId);
  if (error) throw error;
  return (data ?? []).map(mapInvoiceItem);
}

// ===== Flexible invoice tax lines (migration 028) =====

function mapInvoiceTax(row: any): import("@/lib/types").InvoiceTaxLine {
  return {
    name: row.name ?? "GST",
    percent: row.percent ?? 0,
    amount: row.amount ?? 0,
  };
}

export async function fetchInvoiceTaxes(invoiceId: string): Promise<import("@/lib/types").InvoiceTaxLine[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from("invoice_taxes")
      .select("*")
      .eq("invoice_id", invoiceId);
    if (error) throw error;
    return (data ?? []).map(mapInvoiceTax);
  } catch (e: any) {
    if (/Could not find the table|in the schema cache/i.test(e?.message ?? "")) return [];
    throw e;
  }
}

export async function fetchMedicineAlerts(branch?: string, status = "active"): Promise<import("@/lib/types").MedicineAlert[]> {
  try {
    let query = supabaseAdmin.from("medicine_alerts").select("*").order("created_at", { ascending: false }).limit(1000);
    if (branch) query = query.eq("branch", branch);
    if (status && status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((row: any) => ({
      id: row.id,
      medicineId: row.medicine_id,
      medicineName: row.medicine_name ?? "",
      batchNo: row.batch_no ?? "",
      alertType: row.alert_type,
      severity: row.severity ?? "medium",
      message: row.message ?? "",
      daysToExpiry: row.days_to_expiry,
      stock: row.stock ?? 0,
      threshold: row.threshold ?? 0,
      status: row.status ?? "active",
      branch: row.branch ?? "",
      createdAt: row.created_at ?? "",
      resolvedAt: row.resolved_at ?? null,
    }));
  } catch (e: any) {
    if (/Could not find the table|in the schema cache/i.test(e?.message ?? "")) return [];
    throw e;
  }
}

/**
 * Sync the backend alert set with the freshly computed desired set:
 * upsert active alerts, auto-resolve ones that cleared (restocked / new
 * batch with later expiry). Returns the active alerts for the branch.
 */
export async function syncMedicineAlerts(
  desired: { medicineId: string; medicineName: string; batchNo: string; alertType: string; severity: string; message: string; daysToExpiry?: number | null; stock: number; threshold: number; branch: string }[],
  branch?: string
): Promise<import("@/lib/types").MedicineAlert[]> {
  for (const a of desired) {
    const { error } = await supabaseAdmin.from("medicine_alerts").upsert({
      medicine_id: a.medicineId,
      medicine_name: a.medicineName,
      batch_no: a.batchNo ?? "",
      alert_type: a.alertType,
      severity: a.severity,
      message: a.message,
      days_to_expiry: a.daysToExpiry ?? null,
      stock: a.stock ?? 0,
      threshold: a.threshold ?? 0,
      status: "active",
      branch: a.branch ?? "",
      resolved_at: null,
    }, { onConflict: "medicine_id,alert_type" });
    if (error) throw error;
  }
  // Auto-resolve actives that are no longer desired (same branch scope).
  const active = await fetchMedicineAlerts(branch, "active");
  const wanted = new Set(desired.map((a) => `${a.medicineId}|${a.alertType}`));
  const stale = active.filter((a) => !wanted.has(`${a.medicineId}|${a.alertType}`));
  for (const s of stale) {
    await supabaseAdmin.from("medicine_alerts").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", s.id);
  }
  return fetchMedicineAlerts(branch, "active");
}

export async function acknowledgeMedicineAlert(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("medicine_alerts").update({ status: "acknowledged" }).eq("id", id);
  if (error) throw error;
}

export async function replaceInvoiceTaxes(invoiceId: string, taxes: import("@/lib/types").InvoiceTaxLine[]): Promise<import("@/lib/types").InvoiceTaxLine[]> {
  const { error: delError } = await supabaseAdmin.from("invoice_taxes").delete().eq("invoice_id", invoiceId);
  if (delError) throw delError;
  const rows = (taxes ?? [])
    .filter((t) => t && (t.percent ?? 0) > 0)
    .map((t) => ({
      invoice_id: invoiceId,
      name: (t.name || "GST").trim(),
      percent: t.percent ?? 0,
      amount: t.amount ?? 0,
    }));
  if (rows.length > 0) {
    const { error: insError } = await supabaseAdmin.from("invoice_taxes").insert(rows);
    if (insError) throw insError;
  }
  return fetchInvoiceTaxes(invoiceId);
}

function mapMedicine(row: any): Medicine {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    manufacturer: row.manufacturer,
    batchNo: row.batch_no,
    expiryDate: row.expiry_date,
    stock: row.stock,
    reorderLevel: row.reorder_level,
    price: row.price,
    stripSize: row.strip_size ?? 10,
    sheetPrice: row.sheet_price ?? (row.price || 0) * (row.strip_size ?? 10),
    supplier: row.supplier,
    status: row.status,
    branch: row.branch,
  };
}

function mapLabTest(row: any): LabTest {
  return {
    id: row.id,
    orderId: row.order_id,
    patientName: row.patient_name,
    patientId: row.patient_id,
    test: row.test,
    category: row.category,
    orderedBy: row.ordered_by,
    orderedOn: row.ordered_on,
    status: row.status,
    reportReady: row.report_ready,
    price: row.price,
    result: row.result,
    findings: row.findings,
    problems: row.problems,
    branch: row.branch,
  };
}

function mapRadiologyOrder(row: any): RadiologyOrder {
  return {
    id: row.id,
    orderId: row.order_id,
    patientName: row.patient_name,
    patientId: row.patient_id,
    modality: row.modality,
    region: row.region,
    orderedBy: row.ordered_by,
    orderedOn: row.ordered_on,
    status: row.status,
    price: row.price,
    findings: row.findings,
    problems: row.problems,
    branch: row.branch,
  };
}

function mapInsuranceClaim(row: any): InsuranceClaim {
  return {
    id: row.id,
    claimNo: row.claim_no,
    patientName: row.patient_name,
    patientId: row.patient_id,
    provider: row.provider,
    policyNo: row.policy_no,
    claimAmount: row.claim_amount,
    approvedAmount: row.approved_amount,
    date: row.date,
    status: row.status,
    treatment: row.treatment,
    branch: row.branch,
    invoiceId: row.invoice_id ?? undefined,
    type: row.type ?? "",
    admissionDate: row.admission_date ?? "",
    dischargeDate: row.discharge_date ?? "",
    tpaName: row.tpa_name ?? "",
    remarks: row.remarks ?? "",
  };
}

function mapLead(row: any): Lead {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    source: row.source,
    stage: row.stage,
    interest: row.interest,
    estimatedValue: row.estimated_value,
    assignedTo: row.assigned_to,
    createdOn: row.created_on,
    lastContact: row.last_contact,
    branch: row.branch,
  };
}

function mapCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    status: row.status,
    audience: row.audience,
    sent: row.sent,
    opened: row.opened,
    clicked: row.clicked,
    conversions: row.conversions,
    startDate: row.start_date,
    branch: row.branch,
    audienceKind: row.audience_kind ?? "all-patients",
    audienceRefId: row.audience_ref_id ?? "",
    audienceRefName: row.audience_ref_name ?? "",
    message: row.message ?? "",
  };
}

function mapStaffMember(row: any): StaffMember {
  return {
    id: row.id,
    staffId: row.staff_id,
    name: row.name,
    photo: row.photo ?? "",
    role: row.role,
    department: row.department,
    phone: row.phone,
    email: row.email,
    password: row.password_hash,
    mustChangePassword: row.must_change_password,
    status: row.status,
    shift: row.shift,
    attendance: row.attendance,
    joinDate: row.join_date,
    salary: row.salary,
    branch: row.branch,
    branchId: row.branch_id,
    consultationFee: row.consultation_fee ?? 0,
    availableDays: row.available_days ?? [],
    availableFrom: row.available_from ?? "",
    availableTo: row.available_to ?? "",
  };
}

function mapInventoryItem(row: any): InventoryItem {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: row.stock,
    reorderLevel: row.reorder_level,
    unit: row.unit,
    supplier: row.supplier,
    price: row.price,
    location: row.location,
    lastRestocked: row.last_restocked,
    status: row.status,
    branch: row.branch,
  };
}

function mapBranch(row: any): Branch {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    patients: row.patients,
    revenue: row.revenue,
    staff: row.staff,
    status: row.status,
  };
}

export interface UserAccountPayload {
  name: string;
  role: string;
  email: string;
  avatar?: string;
  branch?: string;
  branchId?: string;
  password: string;
  mustChangePassword?: boolean;
  staffId?: string;
}

export interface UserAccount extends Required<Omit<UserAccountPayload, "staffId">> {
  staffId?: string;
}

function mapUser(row: any): UserAccount {
  return {
    name: row.name,
    role: row.role,
    email: row.email,
    avatar: row.avatar ?? "",
    branch: row.branch ?? "",
    branchId: row.branch_id ?? "",
    password: row.password_hash,
    mustChangePassword: row.must_change_password ?? false,
    staffId: row.staff_id ?? undefined,
  };
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    message: row.message,
    time: row.time,
    read: row.read,
    priority: row.priority,
    branch: row.branch,
  };
}

export async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabaseAdmin.from("branches").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapBranch);
}

export async function createBranch(branch: Branch): Promise<Branch> {
  const { data, error } = await supabaseAdmin
    .from("branches")
    .insert({
      id: branch.id,
      name: branch.name,
      location: branch.location,
      patients: branch.patients ?? 0,
      revenue: branch.revenue ?? 0,
      staff: branch.staff ?? 0,
      status: branch.status,
    })
    .select()
    .single();
  if (error) throw error;
  return mapBranch(data);
}

export async function getOrCreateBranch(branch: Branch): Promise<{ branch: Branch; created: boolean }> {
  const { data: existing } = await supabaseAdmin
    .from("branches")
    .select("*")
    .eq("name", branch.name)
    .maybeSingle();
  if (existing) return { branch: mapBranch(existing), created: false };
  return { branch: await createBranch(branch), created: true };
}

export async function updateBranchRow(id: string, updates: Partial<Branch>): Promise<Branch> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.patients !== undefined) patch.patients = updates.patients;
  if (updates.revenue !== undefined) patch.revenue = updates.revenue;
  if (updates.staff !== undefined) patch.staff = updates.staff;
  if (updates.status !== undefined) patch.status = updates.status;
  const { data, error } = await supabaseAdmin.from("branches").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapBranch(data);
}

export async function fetchPatients(branch?: string): Promise<Patient[]> {
  let query = supabaseAdmin.from("patients").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapPatient);
}

export async function createPatient(patient: Patient): Promise<Patient> {
  const { data, error } = await supabaseAdmin
    .from("patients")
    .insert({
      id: patient.id,
      uhid: patient.uhid,
      name: patient.name,
      photo: patient.photo ?? "",
      gender: patient.gender,
      age: patient.age,
      phone: patient.phone,
      email: patient.email ?? "-",
      blood_group: patient.bloodGroup,
      address: patient.address ?? "-",
      emergency_contact: patient.emergencyContact ?? "-",
      insurance_provider: patient.insuranceProvider ?? "Self Pay",
      insurance_policy: patient.insurancePolicy ?? "-",
      allergies: patient.allergies ?? [],
      chronic_diseases: patient.chronicDiseases ?? [],
      status: patient.status,
      last_visit: patient.lastVisit || null,
      registered_on: patient.registeredOn || null,
      branch: patient.branch,
      op_date: patient.opDate || null,
      op_fees: patient.opFees ?? 0,
      doctor_id: patient.doctorId || null,
      doctor_name: patient.doctorName || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapPatient(data);
}

export async function updatePatientRow(id: string, updates: Partial<Patient>): Promise<Patient> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.gender !== undefined) patch.gender = updates.gender;
  if (updates.age !== undefined) patch.age = updates.age;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.bloodGroup !== undefined) patch.blood_group = updates.bloodGroup;
  if (updates.address !== undefined) patch.address = updates.address;
  if (updates.emergencyContact !== undefined) patch.emergency_contact = updates.emergencyContact;
  if (updates.insuranceProvider !== undefined) patch.insurance_provider = updates.insuranceProvider;
  if (updates.insurancePolicy !== undefined) patch.insurance_policy = updates.insurancePolicy;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.lastVisit !== undefined) patch.last_visit = updates.lastVisit || null;
  if (updates.opDate !== undefined) patch.op_date = updates.opDate || null;
  if (updates.opFees !== undefined) patch.op_fees = updates.opFees;
  if (updates.doctorId !== undefined) patch.doctor_id = updates.doctorId || null;
  if (updates.doctorName !== undefined) patch.doctor_name = updates.doctorName || null;
  const { data, error } = await supabaseAdmin.from("patients").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapPatient(data);
}

export async function deletePatientRow(id: string): Promise<void> {
  const { data: invoices, error: invoiceLookupError } = await supabaseAdmin
    .from("invoices")
    .select("id")
    .eq("patient_id", id);
  if (invoiceLookupError) throw invoiceLookupError;

  const invoiceIds = (invoices ?? []).map((invoice: { id: string }) => invoice.id);
  if (invoiceIds.length > 0) {
    const { error: invoiceItemsError } = await supabaseAdmin
      .from("invoice_items")
      .delete()
      .in("invoice_id", invoiceIds);
    if (invoiceItemsError) throw invoiceItemsError;
  }

  const dependentDeletes = [
    supabaseAdmin.from("appointments").delete().eq("patient_id", id),
    supabaseAdmin.from("invoices").delete().eq("patient_id", id),
    supabaseAdmin.from("lab_tests").delete().eq("patient_id", id),
    supabaseAdmin.from("radiology_orders").delete().eq("patient_id", id),
    supabaseAdmin.from("insurance_claims").delete().eq("patient_id", id),
  ];

  for (const result of await Promise.all(dependentDeletes)) {
    if (result.error) throw result.error;
  }

  const { error: bedsError } = await supabaseAdmin
    .from("beds")
    .update({ patient_id: null, patient_name: null, status: "Available", admitted_on: null, updated_at: new Date().toISOString() })
    .eq("patient_id", id);
  if (bedsError) throw bedsError;

  const { error } = await supabaseAdmin.from("patients").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPatientTimeline(patientId: string): Promise<TimelineEvent[]> {
  const { data, error } = await supabaseAdmin
    .from("patient_timeline")
    .select("*")
    .eq("patient_id", patientId)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapTimelineEvent);
}

export async function fetchDoctors(branch?: string): Promise<Doctor[]> {
  let query = supabaseAdmin.from("doctors").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDoctor);
}

export async function createDoctor(doctor: Doctor): Promise<Doctor> {
  return withColumnFallback("doctors", {
    id: doctor.id,
    name: doctor.name,
    photo: doctor.photo ?? "",
    specialization: doctor.specialization,
    department: doctor.department,
    experience: doctor.experience ?? 0,
    qualification: doctor.qualification ?? "",
    phone: doctor.phone,
    email: doctor.email,
    availability: doctor.availability ?? "Available",
    rating: doctor.rating ?? 0,
    consultation_fee: doctor.consultationFee ?? 0,
    today_appointments: doctor.todayAppointments ?? 0,
    patients_treated: doctor.patientsTreated ?? 0,
    branch: doctor.branch,
    available_days: doctor.availableDays ?? [],
    available_from: doctor.availableFrom || null,
    available_to: doctor.availableTo || null,
    shift: doctor.shift || null,
    schedule_json: JSON.stringify(doctor.schedule ?? []),
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("doctors").insert(row).select().single();
    if (error) throw error;
    return mapDoctor(data);
  });
}

export async function updateDoctorRow(id: string, updates: Partial<Doctor>): Promise<Doctor> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.specialization !== undefined) patch.specialization = updates.specialization;
  if (updates.department !== undefined) patch.department = updates.department;
  if (updates.qualification !== undefined) patch.qualification = updates.qualification;
  if (updates.experience !== undefined) patch.experience = updates.experience;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.availability !== undefined) patch.availability = updates.availability;
  if (updates.consultationFee !== undefined) patch.consultation_fee = updates.consultationFee;
  if (updates.availableDays !== undefined) patch.available_days = updates.availableDays;
  if (updates.availableFrom !== undefined) patch.available_from = updates.availableFrom;
  if (updates.availableTo !== undefined) patch.available_to = updates.availableTo;
  if (updates.shift !== undefined) patch.shift = updates.shift;
  if (updates.schedule !== undefined) patch.schedule_json = JSON.stringify(updates.schedule ?? []);
  return withColumnFallback("doctors", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("doctors").update(clean).eq("id", id).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Doctor record not found.");
    return mapDoctor(data[0]);
  });
}

export async function fetchDoctorSchedules(): Promise<DoctorBranchSchedule[]> {
  const { data, error } = await supabaseAdmin.from("doctor_branch_schedules").select("*");
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    doctorEmail: r.doctor_email,
    branch: r.branch,
    availableDays: r.available_days ?? [],
    availableFrom: r.available_from ?? "",
    availableTo: r.available_to ?? "",
    shift: r.shift ?? "",
  }));
}

export async function upsertDoctorSchedule(schedule: DoctorBranchSchedule): Promise<DoctorBranchSchedule> {
  const { data, error } = await supabaseAdmin
    .from("doctor_branch_schedules")
    .upsert(
      {
        doctor_email: schedule.doctorEmail,
        branch: schedule.branch,
        available_days: schedule.availableDays ?? [],
        available_from: schedule.availableFrom || null,
        available_to: schedule.availableTo || null,
        shift: schedule.shift || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_email,branch" }
    )
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    doctorEmail: data.doctor_email,
    branch: data.branch,
    availableDays: data.available_days ?? [],
    availableFrom: data.available_from ?? "",
    availableTo: data.available_to ?? "",
    shift: data.shift ?? "",
  };
}

export async function fetchAppointments(branch?: string, date?: string): Promise<Appointment[]> {
  let query = supabaseAdmin.from("appointments").select("*").order("time");
  if (branch) query = query.eq("branch", branch);
  if (date) query = query.eq("date", date);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAppointment);
}

export async function nextTokenFor(date: string, branch: string): Promise<string> {
  // Tokens restart at A-001 for every branch every day. Max-based so deleted
  // bookings never cause a number to be reused within the same day.
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .select("token")
    .eq("date", date)
    .eq("branch", branch);
  if (error) throw error;
  const max = (data ?? []).reduce((mx, r) => {
    const n = parseInt(String(r.token).split("-")[1], 10);
    return Number.isFinite(n) ? Math.max(mx, n) : mx;
  }, 0);
  return `A-${String(max + 1).padStart(3, "0")}`;
}

export async function createAppointment(appointment: Appointment): Promise<Appointment> {
  // Sequential token per branch per day, assigned server-side.
  const token = await nextTokenFor(appointment.date, appointment.branch);
  const { data, error } = await supabaseAdmin
    .from("appointments")
    .insert({
      id: appointment.id,
      token,
      patient_id: appointment.patientId,
      patient_name: appointment.patientName,
      patient_photo: appointment.patientPhoto ?? "",
      doctor_id: appointment.doctorId,
      doctor_name: appointment.doctorName,
      department: appointment.department,
      date: appointment.date,
      time: appointment.time,
      type: appointment.type,
      status: appointment.status,
      reason: appointment.reason,
      waiting_time: appointment.waitingTime ?? 0,
      branch: appointment.branch,
    })
    .select()
    .single();
  if (error) throw error;
  return mapAppointment(data);
}

export async function updateAppointmentStatus(id: string, updates: { status?: string; token?: string; date?: string; time?: string; doctorId?: string; doctorName?: string; department?: string; reason?: string; clinicalNotes?: string; problems?: string; cancelledBy?: string; cancelReason?: string }): Promise<Appointment> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.token !== undefined) patch.token = updates.token;
  if (updates.date !== undefined) patch.date = updates.date;
  if (updates.time !== undefined) patch.time = updates.time;
  if (updates.doctorId !== undefined) patch.doctor_id = updates.doctorId;
  if (updates.doctorName !== undefined) patch.doctor_name = updates.doctorName;
  if (updates.department !== undefined) patch.department = updates.department;
  if (updates.reason !== undefined) patch.reason = updates.reason;
    if (updates.clinicalNotes !== undefined) patch.clinical_notes = updates.clinicalNotes;
    if (updates.problems !== undefined) patch.problems = updates.problems;
    if (updates.cancelledBy !== undefined) patch.cancelled_by = updates.cancelledBy;
    if (updates.cancelReason !== undefined) patch.cancel_reason = updates.cancelReason;
    if (updates.status === "Cancelled") patch.cancelled_at = new Date().toISOString();
  return withColumnFallback("appointments", patch, async (clean) => {
    const { data, error } = await supabaseAdmin
      .from("appointments")
      .update(clean)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapAppointment(data);
  });
}

export async function fetchBeds(branch?: string): Promise<Bed[]> {
  let query = supabaseAdmin.from("beds").select("*").order("number");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapBed);
}

export async function createBed(bed: Bed): Promise<Bed> {
  const { data, error } = await supabaseAdmin
    .from("beds")
    .insert({
      id: bed.id,
      number: bed.number,
      ward: bed.ward,
      status: bed.status,
      daily_rate: bed.dailyRate ?? 0,
      branch: bed.branch,
      type: bed.type || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapBed(data);
}

export async function updateBedRow(id: string, updates: Partial<Bed>): Promise<Bed> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.patientId !== undefined) patch.patient_id = updates.patientId || null;
  if (updates.patientName !== undefined) patch.patient_name = updates.patientName || null;
  if (updates.admittedOn !== undefined) patch.admitted_on = updates.admittedOn || null;
  if (updates.dailyRate !== undefined) patch.daily_rate = updates.dailyRate;
  if (updates.doctorName !== undefined) patch.doctor_name = updates.doctorName || null;
  if (updates.diagnosis !== undefined) patch.diagnosis = updates.diagnosis || null;
  if (updates.department !== undefined) patch.department = updates.department || null;
  const { data, error } = await supabaseAdmin.from("beds").update(patch).eq("id", id).select();
  if (error) throw error;
  if (!data || data.length === 0) throw new Error("Bed not found.");
  return mapBed(data[0]);
}

export async function fetchInvoices(branch?: string): Promise<Invoice[]> {
  let query = supabaseAdmin.from("invoices").select("*").order("date", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
    const invoices = (data ?? []).map(mapInvoice);
    for (const inv of invoices) {
      const { data: items } = await supabaseAdmin
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", inv.id);
      inv.items = (items ?? []).map(mapInvoiceItem);
      inv.taxes = await fetchInvoiceTaxes(inv.id);
    }
    return invoices;
}

export async function nextInvoiceNo(): Promise<string> {
  const year = new Date().getFullYear();
  // Derive from the highest existing number for the year (not the row
  // count), so deleted invoices never cause number reuse collisions.
  try {
    const { data, error } = await supabaseAdmin
      .from("invoices")
      .select("invoice_no")
      .like("invoice_no", `INV-${year}-%`)
      .order("invoice_no", { ascending: false })
      .limit(1);
    if (error) throw error;
    const last = data?.[0]?.invoice_no as string | undefined;
    const m = last ? last.match(/(\d+)\s*$/) : null;
    const next = (m ? parseInt(m[1], 10) : 0) + 1;
    return `INV-${year}-${String(next).padStart(5, "0")}`;
  } catch {
    const { count } = await supabaseAdmin.from("invoices").select("id", { count: "exact", head: true });
    return `INV-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;
  }
}

function isUniqueViolation(e: any): boolean {
  return e?.code === "23505" || /duplicate key|unique constraint/i.test(e?.message ?? "");
}

export async function createInvoice(invoice: Invoice): Promise<Invoice> {
  const explicitNo = (invoice.invoiceNo || "").trim();
  let lastError: any = null;
  // Retry with a freshly generated number on unique violations (concurrent
  // creates or legacy numbering gaps). Explicit numbers are tried once.
  for (let attempt = 0; attempt < 5; attempt++) {
    const invoiceNo = explicitNo && attempt === 0 ? explicitNo : await nextInvoiceNo();
    try {
      // withColumnFallback keeps inserts working on databases where migration
      // 027 (percentage columns) hasn't been applied yet.
      const data = await withColumnFallback("invoices", {
        id: attempt === 0 ? invoice.id : `${invoice.id}-r${attempt}`,
        invoice_no: invoiceNo,
        patient_id: invoice.patientId || null,
        patient_name: invoice.patientName,
        date: invoice.date,
        due_date: invoice.dueDate || invoice.date || new Date().toISOString().split("T")[0],
        subtotal: invoice.subtotal ?? 0,
        tax: invoice.tax ?? 0,
        discount: invoice.discount ?? 0,
        discount_percent: invoice.discountPercent ?? 0,
        gst_percent: invoice.gstPercent ?? 0,
        gst_amount: invoice.gstAmount ?? 0,
        cst_percent: invoice.cstPercent ?? 0,
        cst_amount: invoice.cstAmount ?? 0,
        total: invoice.total ?? 0,
        paid_amount: invoice.paidAmount ?? 0,
        status: invoice.status,
        payment_method: invoice.paymentMethod || null,
        branch: invoice.branch,
        paid_date: invoice.paidDate || (invoice.paidAmount ? invoice.date || null : null),
      }, async (clean) => {
        const { data, error } = await supabaseAdmin.from("invoices").insert(clean).select().single();
        if (error) throw error;
        return data;
      });
      if (invoice.items && invoice.items.length > 0) {
        const rows = invoice.items.map((it) => ({
          invoice_id: data.id,
          description: it.description,
          category: it.category || "General",
          quantity: it.quantity ?? 1,
          rate: it.rate ?? 0,
          amount: it.amount ?? 0,
        }));
        const { error: itemError } = await supabaseAdmin.from("invoice_items").insert(rows);
        if (itemError) {
          // Compensate: don't leave an invoice behind without its line items.
          await supabaseAdmin.from("invoices").delete().eq("id", data.id);
          throw itemError;
        }
      }
      // Persist flexible tax lines (best-effort on DBs without migration 028).
      let taxes: import("@/lib/types").InvoiceTaxLine[] = invoice.taxes ?? [];
      try {
        if (taxes.length > 0) taxes = await replaceInvoiceTaxes(data.id, taxes);
      } catch (e: any) {
        if (!/Could not find the table|in the schema cache/i.test(e?.message ?? "")) throw e;
        taxes = invoice.taxes ?? [];
      }
      return { ...mapInvoice(data), items: invoice.items ?? [], taxes };
    } catch (e: any) {
      lastError = e;
      if (!isUniqueViolation(e)) throw e;
      if (explicitNo && attempt === 0) throw new Error(`Invoice number ${explicitNo} already exists. Please use a different number.`);
      // Otherwise loop and retry with a fresh number.
    }
  }
  throw lastError;
}

export function deriveInvoiceStatus(total: number, paid: number, current: string): string {
  if (total > 0 && paid >= total) return "Paid";
  if (paid > 0) return "Partial";
  // Nothing collected: Paid/Partial states are no longer valid after an edit.
  if (current === "Paid" || current === "Partial") return "Pending";
  return current;
}

export async function updateInvoiceRow(id: string, updates: Partial<Invoice>): Promise<Invoice> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.paidAmount !== undefined) patch.paid_amount = updates.paidAmount;
  if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
  if (updates.paidDate !== undefined) patch.paid_date = updates.paidDate || null;
  if (updates.total !== undefined) patch.total = updates.total;
  if (updates.subtotal !== undefined) patch.subtotal = updates.subtotal;
  if (updates.discount !== undefined) patch.discount = updates.discount;
  if (updates.tax !== undefined) patch.tax = updates.tax;
  if (updates.discountPercent !== undefined) patch.discount_percent = updates.discountPercent;
  if (updates.gstPercent !== undefined) patch.gst_percent = updates.gstPercent;
  if (updates.gstAmount !== undefined) patch.gst_amount = updates.gstAmount;
  if (updates.cstPercent !== undefined) patch.cst_percent = updates.cstPercent;
  if (updates.cstAmount !== undefined) patch.cst_amount = updates.cstAmount;
  // Auto-reconcile status when money or the bill amount changes without an
  // explicit status: e.g. collect ₹500 on a ₹500 bill (Paid), admin edits the
  // bill to ₹800 → status flips back to Partial with ₹300 outstanding, so the
  // Collect button reappears for the new balance.
  if (updates.status === undefined && (updates.paidAmount !== undefined || updates.total !== undefined)) {
    const { data: current } = await supabaseAdmin.from("invoices").select("total,paid_amount,status").eq("id", id).single();
    if (current) {
      const total = updates.total ?? current.total ?? 0;
      const paid = updates.paidAmount ?? current.paid_amount ?? 0;
      patch.status = deriveInvoiceStatus(total, paid, current.status);
    }
  }
  const data = await withColumnFallback("invoices", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("invoices").update(clean).eq("id", id).select().single();
    if (error) throw error;
    return data;
  });
  const { data: items } = await supabaseAdmin.from("invoice_items").select("*").eq("invoice_id", id);
  const taxes = await fetchInvoiceTaxes(id);
  return { ...mapInvoice(data), items: (items ?? []).map(mapInvoiceItem), taxes };
}

export async function replaceInvoiceItems(invoiceId: string, items: InvoiceItem[]): Promise<InvoiceItem[]> {
  const { error: delError } = await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", invoiceId);
  if (delError) throw delError;
  if (items.length > 0) {
    const rows = items.map((it) => ({
      invoice_id: invoiceId,
      description: it.description,
      category: it.category || "Other",
      quantity: it.quantity ?? 1,
      rate: it.rate ?? 0,
      amount: it.amount ?? (it.quantity ?? 1) * (it.rate ?? 0),
    }));
    const { error: insError } = await supabaseAdmin.from("invoice_items").insert(rows);
    if (insError) throw insError;
  }
  return fetchInvoiceItems(invoiceId);
}

export async function fetchMedicines(branch?: string): Promise<Medicine[]> {
  let query = supabaseAdmin.from("medicines").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapMedicine);
}

export async function createMedicine(medicine: Medicine): Promise<Medicine> {
  const expiry = normalizeExpiryDate(medicine.expiryDate);
  if (!expiry) throw new Error(`Invalid expiry date "${medicine.expiryDate ?? ""}". Use MM/YYYY (e.g. 07/2027).`);
  return withColumnFallback("medicines", {
    id: medicine.id, name: medicine.name, category: medicine.category,
    manufacturer: medicine.manufacturer, batch_no: medicine.batchNo,
    expiry_date: expiry, stock: medicine.stock,
    reorder_level: medicine.reorderLevel, price: medicine.price,
    strip_size: medicine.stripSize ?? 10, sheet_price: medicine.sheetPrice ?? 0,
    supplier: medicine.supplier, status: medicine.status, branch: medicine.branch,
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("medicines").insert(row).select().single();
    if (error) throw error;
    return mapMedicine(data);
  });
}

export async function updateMedicineRow(id: string, updates: Partial<Medicine>): Promise<Medicine> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.manufacturer !== undefined) patch.manufacturer = updates.manufacturer;
  if (updates.batchNo !== undefined) patch.batch_no = updates.batchNo;
  if (updates.expiryDate !== undefined) {
    const expiry = normalizeExpiryDate(updates.expiryDate);
    if (!expiry) throw new Error(`Invalid expiry date "${updates.expiryDate ?? ""}". Use MM/YYYY (e.g. 07/2027).`);
    patch.expiry_date = expiry;
  }
  if (updates.stock !== undefined) patch.stock = updates.stock;
  if (updates.reorderLevel !== undefined) patch.reorder_level = updates.reorderLevel;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.stripSize !== undefined) patch.strip_size = updates.stripSize;
  if (updates.sheetPrice !== undefined) patch.sheet_price = updates.sheetPrice;
  if (updates.supplier !== undefined) patch.supplier = updates.supplier;
  if (updates.status !== undefined) patch.status = updates.status;
  return withColumnFallback("medicines", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("medicines").update(clean).eq("id", id).select().single();
    if (error) throw error;
    return mapMedicine(data);
  });
}

export async function fetchLabTests(branch?: string): Promise<LabTest[]> {
  let query = supabaseAdmin.from("lab_tests").select("*").order("ordered_on", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLabTest);
}

export async function createLabTest(test: LabTest): Promise<LabTest> {
  return withColumnFallback("lab_tests", {
    id: test.id, order_id: test.orderId, patient_name: test.patientName,
    patient_id: test.patientId, test: test.test, category: test.category,
    ordered_by: test.orderedBy, ordered_on: test.orderedOn, status: test.status,
    report_ready: test.reportReady, price: test.price, result: test.result,
    findings: test.findings, problems: test.problems, branch: test.branch,
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("lab_tests").insert(row).select().single();
    if (error) throw error;
    return mapLabTest(data);
  });
}

export async function updateLabTestRow(id: string, updates: Partial<LabTest>): Promise<LabTest> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.patientName !== undefined) patch.patient_name = updates.patientName;
  if (updates.patientId !== undefined) patch.patient_id = updates.patientId;
  if (updates.test !== undefined) patch.test = updates.test;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.orderedBy !== undefined) patch.ordered_by = updates.orderedBy;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.reportReady !== undefined) patch.report_ready = updates.reportReady;
  if (updates.result !== undefined) patch.result = updates.result;
  if (updates.findings !== undefined) patch.findings = updates.findings;
  if (updates.problems !== undefined) patch.problems = updates.problems;
  if (updates.price !== undefined) patch.price = updates.price;
  return withColumnFallback("lab_tests", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("lab_tests").update(clean).eq("id", id).select().single();
    if (error) throw error;
    return mapLabTest(data);
  });
}

export async function fetchRadiologyOrders(branch?: string): Promise<RadiologyOrder[]> {
  let query = supabaseAdmin.from("radiology_orders").select("*").order("ordered_on", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapRadiologyOrder);
}

export async function createRadiologyOrder(order: RadiologyOrder): Promise<RadiologyOrder> {
  return withColumnFallback("radiology_orders", {
    id: order.id, order_id: order.orderId, patient_name: order.patientName,
    patient_id: order.patientId, modality: order.modality, region: order.region,
    ordered_by: order.orderedBy, ordered_on: order.orderedOn, status: order.status,
    price: order.price, findings: order.findings, problems: order.problems, branch: order.branch,
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("radiology_orders").insert(row).select().single();
    if (error) throw error;
    return mapRadiologyOrder(data);
  });
}

export async function updateRadiologyOrderRow(id: string, updates: Partial<RadiologyOrder>): Promise<RadiologyOrder> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.patientName !== undefined) patch.patient_name = updates.patientName;
  if (updates.patientId !== undefined) patch.patient_id = updates.patientId;
  if (updates.modality !== undefined) patch.modality = updates.modality;
  if (updates.region !== undefined) patch.region = updates.region;
  if (updates.orderedBy !== undefined) patch.ordered_by = updates.orderedBy;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.findings !== undefined) patch.findings = updates.findings;
  if (updates.problems !== undefined) patch.problems = updates.problems;
  return withColumnFallback("radiology_orders", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("radiology_orders").update(clean).eq("id", id).select().single();
    if (error) throw error;
    return mapRadiologyOrder(data);
  });
}

// ===== Medical Records =====

function mapMedicalRecord(row: any): MedicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id ?? "",
    patientName: row.patient_name,
    type: row.type,
    title: row.title ?? "",
    notes: row.notes ?? "",
    doctor: row.doctor ?? "",
    recordDate: row.record_date ?? "",
    branch: row.branch,
    createdBy: row.created_by ?? "",
  };
}

export async function fetchMedicalRecords(branch?: string): Promise<MedicalRecord[]> {
  let query = supabaseAdmin.from("medical_records").select("*").order("record_date", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapMedicalRecord);
}

export async function createMedicalRecord(record: MedicalRecord): Promise<MedicalRecord> {
  const { data, error } = await supabaseAdmin.from("medical_records").insert({
    id: record.id,
    patient_id: record.patientId || null,
    patient_name: record.patientName,
    type: record.type,
    title: record.title,
    notes: record.notes,
    doctor: record.doctor,
    record_date: record.recordDate,
    branch: record.branch,
    created_by: record.createdBy,
  }).select().single();
  if (error) throw error;
  return mapMedicalRecord(data);
}

export async function updateMedicalRecordRow(id: string, updates: Partial<MedicalRecord>): Promise<MedicalRecord> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.patientId !== undefined) patch.patient_id = updates.patientId || null;
  if (updates.patientName !== undefined) patch.patient_name = updates.patientName;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.doctor !== undefined) patch.doctor = updates.doctor;
  if (updates.recordDate !== undefined) patch.record_date = updates.recordDate;
  if (updates.createdBy !== undefined) patch.created_by = updates.createdBy;
  const { data, error } = await supabaseAdmin.from("medical_records").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapMedicalRecord(data);
}

export async function deleteMedicalRecordRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("medical_records").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchInsuranceClaims(branch?: string): Promise<InsuranceClaim[]> {
  let query = supabaseAdmin.from("insurance_claims").select("*").order("date", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapInsuranceClaim);
}

export async function createInsuranceClaim(claim: InsuranceClaim): Promise<InsuranceClaim> {
  return withColumnFallback("insurance_claims", {
    id: claim.id, claim_no: claim.claimNo, patient_name: claim.patientName,
    patient_id: claim.patientId, provider: claim.provider, policy_no: claim.policyNo,
    claim_amount: claim.claimAmount, approved_amount: claim.approvedAmount,
    date: claim.date, status: claim.status, treatment: claim.treatment, branch: claim.branch,
    invoice_id: claim.invoiceId || "",
    type: claim.type ?? "", admission_date: claim.admissionDate ?? "",
    discharge_date: claim.dischargeDate ?? "", tpa_name: claim.tpaName ?? "",
    remarks: claim.remarks ?? "",
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("insurance_claims").insert(row).select().single();
    if (error) throw error;
    return mapInsuranceClaim(data);
  });
}

export async function updateInsuranceClaimRow(id: string, updates: Partial<InsuranceClaim>): Promise<InsuranceClaim> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.approvedAmount !== undefined) patch.approved_amount = updates.approvedAmount;
  if (updates.claimAmount !== undefined) patch.claim_amount = updates.claimAmount;
  if (updates.invoiceId !== undefined) patch.invoice_id = updates.invoiceId || "";
  if (updates.provider !== undefined) patch.provider = updates.provider;
  if (updates.policyNo !== undefined) patch.policy_no = updates.policyNo;
  if (updates.treatment !== undefined) patch.treatment = updates.treatment;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.admissionDate !== undefined) patch.admission_date = updates.admissionDate;
  if (updates.dischargeDate !== undefined) patch.discharge_date = updates.dischargeDate;
  if (updates.tpaName !== undefined) patch.tpa_name = updates.tpaName;
  if (updates.remarks !== undefined) patch.remarks = updates.remarks;
  return withColumnFallback("insurance_claims", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("insurance_claims").update(clean).eq("id", id).select().single();
    if (error) throw error;
    return mapInsuranceClaim(data);
  });
}

export async function fetchLeads(branch?: string): Promise<Lead[]> {
  let query = supabaseAdmin.from("leads").select("*").order("created_on", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLead);
}

export async function createLead(lead: Lead): Promise<Lead> {
  const { data, error } = await supabaseAdmin.from("leads").insert({
    id: lead.id, name: lead.name, phone: lead.phone, email: lead.email,
    source: lead.source, stage: lead.stage, interest: lead.interest,
    estimated_value: lead.estimatedValue, assigned_to: lead.assignedTo,
    created_on: lead.createdOn, last_contact: lead.lastContact, branch: lead.branch,
  }).select().single();
  if (error) throw error;
  return mapLead(data);
}

export async function updateLeadRow(id: string, updates: Partial<Lead>): Promise<Lead> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.stage !== undefined) patch.stage = updates.stage;
  if (updates.interest !== undefined) patch.interest = updates.interest;
  if (updates.estimatedValue !== undefined) patch.estimated_value = updates.estimatedValue;
  if (updates.assignedTo !== undefined) patch.assigned_to = updates.assignedTo;
  if (updates.lastContact !== undefined) patch.last_contact = updates.lastContact;
  const { data, error } = await supabaseAdmin.from("leads").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapLead(data);
}

export async function fetchCampaigns(branch?: string): Promise<Campaign[]> {
  let query = supabaseAdmin.from("campaigns").select("*").order("start_date", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapCampaign);
}

export async function createCampaign(campaign: Campaign): Promise<Campaign> {
  const { data, error } = await supabaseAdmin.from("campaigns").insert({
    id: campaign.id, name: campaign.name, type: campaign.type,
    status: campaign.status, audience: campaign.audience, sent: campaign.sent,
    opened: campaign.opened, clicked: campaign.clicked, conversions: campaign.conversions,
    start_date: campaign.startDate, branch: campaign.branch,
    audience_kind: campaign.audienceKind ?? "all-patients",
    audience_ref_id: campaign.audienceRefId ?? "",
    audience_ref_name: campaign.audienceRefName ?? "",
    message: campaign.message ?? "",
  }).select().single();
  if (error) throw error;
  return mapCampaign(data);
}

export async function updateCampaignRow(id: string, updates: Partial<Campaign>): Promise<Campaign> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.type !== undefined) patch.type = updates.type;
  if (updates.startDate !== undefined) patch.start_date = updates.startDate;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.audience !== undefined) patch.audience = updates.audience;
  if (updates.sent !== undefined) patch.sent = updates.sent;
  if (updates.opened !== undefined) patch.opened = updates.opened;
  if (updates.clicked !== undefined) patch.clicked = updates.clicked;
  if (updates.conversions !== undefined) patch.conversions = updates.conversions;
  if (updates.audienceKind !== undefined) patch.audience_kind = updates.audienceKind;
  if (updates.audienceRefId !== undefined) patch.audience_ref_id = updates.audienceRefId;
  if (updates.audienceRefName !== undefined) patch.audience_ref_name = updates.audienceRefName;
  if (updates.message !== undefined) patch.message = updates.message;
  const { data, error } = await supabaseAdmin.from("campaigns").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapCampaign(data);
}

export async function fetchStaff(branch?: string): Promise<StaffMember[]> {
  let query = supabaseAdmin.from("staff").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapStaffMember);
}

export async function createStaff(staff: StaffMember): Promise<StaffMember> {
  return withColumnFallback("staff", {
    id: staff.id,
    staff_id: staff.staffId,
    name: staff.name,
    role: staff.role,
    department: staff.department,
    phone: staff.phone,
    email: staff.email,
    password_hash: staff.password,
    must_change_password: staff.mustChangePassword ?? false,
    status: staff.status,
    shift: staff.shift,
    attendance: staff.attendance ?? 100,
    join_date: staff.joinDate,
    salary: staff.salary,
    branch: staff.branch,
    branch_id: staff.branchId || null,
    photo: staff.photo || "",
    consultation_fee: staff.consultationFee ?? 0,
    available_days: staff.availableDays ?? [],
    available_from: staff.availableFrom || null,
    available_to: staff.availableTo || null,
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("staff").insert(row).select().single();
    if (error) throw error;
    return mapStaffMember(data);
  });
}

export async function updateStaff(id: string, updates: Partial<StaffMember>): Promise<StaffMember> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.department !== undefined) patch.department = updates.department;
  if (updates.phone !== undefined) patch.phone = updates.phone;
  if (updates.email !== undefined) patch.email = updates.email;
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.branch !== undefined) patch.branch = updates.branch;
  if (updates.branchId !== undefined) patch.branch_id = updates.branchId || null;
  if (updates.photo !== undefined) patch.photo = updates.photo || "";
  if (updates.password !== undefined) patch.password_hash = updates.password;
  if (updates.mustChangePassword !== undefined) patch.must_change_password = updates.mustChangePassword;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.shift !== undefined) patch.shift = updates.shift;
  if (updates.salary !== undefined) patch.salary = updates.salary;
  if ((updates as any).consultationFee !== undefined) patch.consultation_fee = (updates as any).consultationFee;
  if ((updates as any).availableDays !== undefined) patch.available_days = (updates as any).availableDays;
  if ((updates as any).availableFrom !== undefined) patch.available_from = (updates as any).availableFrom;
  if ((updates as any).availableTo !== undefined) patch.available_to = (updates as any).availableTo;
  return withColumnFallback("staff", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("staff").update(clean).eq("id", id).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("Staff record not found.");
    return mapStaffMember(data[0]);
  });
}

export async function updateUserRow(
  email: string,
  updates: Partial<{ name: string; role: string; branch: string; branchId: string; password: string; mustChangePassword: boolean; newEmail: string; avatar: string }>
): Promise<UserAccount> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.role !== undefined) patch.role = updates.role;
  if (updates.branch !== undefined) patch.branch = updates.branch;
  if (updates.branchId !== undefined) patch.branch_id = updates.branchId || null;
  if (updates.password !== undefined) patch.password_hash = updates.password;
  if (updates.mustChangePassword !== undefined) patch.must_change_password = updates.mustChangePassword;
  if (updates.newEmail !== undefined) patch.email = updates.newEmail;
  if ((updates as any).avatar !== undefined) patch.avatar = (updates as any).avatar || "";
  return withColumnFallback("users", patch, async (clean) => {
    const { data, error } = await supabaseAdmin.from("users").update(clean).eq("email", email).select();
    if (error) throw error;
    if (!data || data.length === 0) throw new Error("User account not found.");
    return mapUser(data[0]);
  });
}

export async function deleteUserRow(email: string): Promise<void> {
  const { error } = await supabaseAdmin.from("users").delete().eq("email", email);
  if (error) throw error;
}

// Razorpay ledger — best-effort: never blocks money movement if the table
// (migration 011) is pending.
export async function logRazorpayPayment(entry: {
  invoiceId?: string; invoiceNo?: string; patientName?: string; amount: number;
  currency?: string; orderId?: string; paymentId?: string;
  status: "created" | "paid" | "failed"; mode?: string; branch?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from("razorpay_payments").insert({
      invoice_id: entry.invoiceId || null,
      invoice_no: entry.invoiceNo || "",
      patient_name: entry.patientName || "",
      amount: entry.amount,
      currency: entry.currency || "INR",
      razorpay_order_id: entry.orderId || "",
      razorpay_payment_id: entry.paymentId || "",
      status: entry.status,
      mode: entry.mode || "",
      branch: entry.branch || "",
    });
    if (error) throw error;
  } catch (e: any) {
    if (/Could not find the table|in the schema cache/i.test(e?.message ?? "")) {
      console.warn("[supabase-data] razorpay_payments missing — run 011_razorpay_payments.sql to keep the online ledger.");
      return;
    }
    throw e;
  }
}

export async function markRazorpayPaid(orderId: string, paymentId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from("razorpay_payments")
      .update({ razorpay_payment_id: paymentId, status: "paid", updated_at: new Date().toISOString() })
      .eq("razorpay_order_id", orderId);
    if (error) throw error;
  } catch (e: any) {
    if (/Could not find the table|in the schema cache/i.test(e?.message ?? "")) return;
    throw e;
  }
}

// ===== Audit log (append-only, server-written) =====

export async function addAuditLogRow(entry: {
  actor: string; actorEmail?: string; action: string; target?: string; branch?: string; details?: string;
}): Promise<void> {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    actor: entry.actor,
    actor_email: entry.actorEmail || "",
    action: entry.action,
    target: entry.target || "",
    branch: entry.branch || "",
    details: entry.details || "",
  });
  if (error) throw error;
}

export async function fetchAuditLogs(branch?: string, actionPrefix?: string, limit = 200): Promise<any[]> {
  let query = supabaseAdmin.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(limit);
  if (branch) query = query.eq("branch", branch);
  if (actionPrefix) query = query.like("action", `${actionPrefix}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    actor: r.actor,
    actorEmail: r.actor_email ?? "",
    action: r.action,
    target: r.target ?? "",
    branch: r.branch ?? "",
    details: r.details ?? "",
    timestamp: r.timestamp,
  }));
}

// Tables created by newer migrations may not exist yet on older databases.
// Wrap those calls so users get "run migration N" guidance instead of raw
// PostgREST schema-cache errors.
async function withMigrationHint<T>(migration: string, op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (e: any) {
    if (/Could not find the table|in the schema cache/i.test(e?.message ?? "")) {
      throw new Error(`${e.message} (Run ${migration} in Supabase SQL Editor.)`);
    }
    throw e;
  }
}

export interface DatabaseStatus {
  tables: Record<string, boolean>;
  columns: Record<string, boolean>;
  migrations: { file: string; label: string; ok: boolean; missing: string[] }[];
}

// Probe which tables/columns exist so the admin UI can show exactly which
// migration files still need to be run in Supabase SQL Editor.
export async function getDatabaseStatus(): Promise<DatabaseStatus> {
  const tables: Record<string, boolean> = {};
  const columns: Record<string, boolean> = {};

  const tablePk: Record<string, string> = { app_settings: "key" };
  const checkTable = async (table: string) => {
    try {
      const pk = tablePk[table] ?? "id";
      const { error } = await supabaseAdmin.from(table).select(pk).limit(1);
      tables[table] = !error;
    } catch {
      tables[table] = false;
    }
  };
  const checkColumn = async (table: string, column: string) => {
    try {
      if (!tables[table]) {
        columns[`${table}.${column}`] = false;
        return;
      }
      const { error } = await supabaseAdmin.from(table).select(column).limit(1);
      columns[`${table}.${column}`] = !error;
    } catch {
      columns[`${table}.${column}`] = false;
    }
  };

  const coreTables = ["patients", "doctors", "appointments", "invoices", "medicines", "lab_tests", "radiology_orders", "medical_records", "users", "staff"];
  const newTables = ["app_settings", "doctor_branch_schedules", "patient_logins", "prescriptions", "prescription_items", "appointment_requests", "razorpay_payments", "audit_logs", "appointment_reminders", "expenses", "departments", "staff_attendance", "invoice_items", "invoice_taxes", "medicine_alerts", "beds", "inventory", "insurance_claims", "leads", "campaigns", "notifications"];
  for (const t of [...coreTables, ...newTables]) await checkTable(t);
  const columnChecks: [string, string][] = [
    ["lab_tests", "findings"], ["lab_tests", "problems"],
    ["radiology_orders", "findings"], ["radiology_orders", "problems"],
    ["appointments", "clinical_notes"], ["appointments", "problems"],
    ["medicines", "strip_size"], ["medicines", "sheet_price"],
  ];
  for (const [t, c] of columnChecks) await checkColumn(t, c);

  const missingCols = (...keys: string[]) => keys.filter((k) => !columns[k]);
  const missingTables = (...names: string[]) => names.filter((t) => !tables[t]);
  const migrations: DatabaseStatus["migrations"] = [
    { file: "001_initial_hospital_schema.sql", label: "Core tables", ok: missingTables(...coreTables).length === 0, missing: missingTables(...coreTables) },
    { file: "002_add_findings_columns.sql", label: "Lab/radiology findings", ok: missingCols("lab_tests.findings", "lab_tests.problems", "radiology_orders.findings", "radiology_orders.problems").length === 0, missing: missingCols("lab_tests.findings", "lab_tests.problems", "radiology_orders.findings", "radiology_orders.problems") },
    { file: "003_app_settings_and_schedules.sql", label: "Settings + schedules", ok: missingTables("app_settings", "doctor_branch_schedules").length === 0, missing: missingTables("app_settings", "doctor_branch_schedules") },
    { file: "004_invoice_item_categories.sql", label: "OPD/IPD bill categories (constraint — re-run file to be safe)", ok: true, missing: [] },
    { file: "005_medicine_strip_fields.sql", label: "Medicine strip pricing", ok: missingCols("medicines.strip_size", "medicines.sheet_price").length === 0, missing: missingCols("medicines.strip_size", "medicines.sheet_price") },
    { file: "006_patient_portal.sql", label: "Patient portal + prescriptions", ok: [...missingTables("patient_logins", "prescriptions", "prescription_items"), ...missingCols("appointments.clinical_notes", "appointments.problems")].length === 0, missing: [...missingTables("patient_logins", "prescriptions", "prescription_items"), ...missingCols("appointments.clinical_notes", "appointments.problems")] },
    { file: "007_appointment_requests.sql", label: "Patient visit requests (auto-fallback active if red)", ok: missingTables("appointment_requests").length === 0, missing: missingTables("appointment_requests") },
    { file: "008_branch_indexes.sql", label: "Branch speed indexes + empty-branch backfill (safe to re-run)", ok: true, missing: [] },
    { file: "009_claim_invoice_link.sql", label: "Insurance ↔ bill link (auto-fallback active if red)", ok: true, missing: [] },
    { file: "010_staff_photos.sql", label: "Staff photos + login avatars (auto-fallback active if red)", ok: true, missing: [] },
    { file: "012_staff_clinical_fields.sql", label: "Staff fee/schedule columns (auto-fallback active if red)", ok: true, missing: [] },
    { file: "013_doctor_schedule.sql", label: "Doctor multi-shift timings (auto-fallback active if red)", ok: true, missing: [] },
    { file: "011_razorpay_payments.sql", label: "Razorpay transaction ledger (logging best-effort if red)", ok: missingTables("razorpay_payments").length === 0, missing: missingTables("razorpay_payments") },
    { file: "014_nursing_tables.sql", label: "Nursing assignments, vitals, first-aid", ok: true, missing: [] },
    { file: "015_invoices_walkin_patient.sql", label: "Walk-in invoice patient link", ok: true, missing: [] },
    { file: "016_order_patient_fk.sql", label: "Lab/radiology patient foreign keys", ok: true, missing: [] },
    { file: "017_expenses.sql", label: "Expense ledger", ok: missingTables("expenses").length === 0, missing: missingTables("expenses") },
    { file: "018-021_insurance_claims.sql", label: "Insurance claim fields + links", ok: missingTables("insurance_claims").length === 0, missing: missingTables("insurance_claims") },
    { file: "022_departments.sql", label: "Departments", ok: missingTables("departments").length === 0, missing: missingTables("departments") },
    { file: "023_staff_attendance.sql", label: "Staff attendance", ok: missingTables("staff_attendance").length === 0, missing: missingTables("staff_attendance") },
    { file: "024_campaign_targeting.sql", label: "Campaign targeting", ok: true, missing: [] },
    { file: "025_appointment_reminders.sql", label: "Appointment reminders (all reminders now in Supabase)", ok: missingTables("appointment_reminders").length === 0, missing: missingTables("appointment_reminders") },
    { file: "026_appointment_cancel_audit.sql", label: "Appointment cancel audit (who/when/why — auto-fallback active if red)", ok: true, missing: [] },
    { file: "027_invoice_tax_columns.sql", label: "Invoice discount % / GST % / CST % (auto-fallback active if red)", ok: true, missing: [] },
    { file: "028_invoice_taxes.sql", label: "Flexible per-bill tax lines (any names + %, locked after payment)", ok: missingTables("invoice_taxes").length === 0, missing: missingTables("invoice_taxes") },
    { file: "029_medicine_alerts.sql", label: "Pharmacy alerts — near-expiry + low/out-of-stock (backend-synced)", ok: missingTables("medicine_alerts").length === 0, missing: missingTables("medicine_alerts") },
    { file: "030_attendance_network.sql", label: "WiFi-gated attendance (device IP + on-network proof — auto-fallback if red)", ok: true, missing: [] },
  ];
  return { tables, columns, migrations };
}

// ===== Patient portal logins (phone-based, separate from staff users) =====

export interface PatientLoginRow {
  patientId: string;
  phone: string;
  passwordHash: string;
  mustChangePassword: boolean;
  lastLoginAt?: string;
}

function mapPatientLogin(row: any): PatientLoginRow {
  return {
    patientId: row.patient_id,
    phone: row.phone,
    passwordHash: row.password_hash,
    mustChangePassword: !!row.must_change_password,
    lastLoginAt: row.last_login_at ?? undefined,
  };
}

function isMissingTableError(e: any): boolean {
  return /Could not find the table 'public\.patient_logins'|Could not find the table "public\.patient_logins"/i.test(e?.message ?? "") ||
    (/patient_logins/i.test(e?.message ?? "") && /schema cache|does not exist|not find/i.test(e?.message ?? ""));
}

// Fallback credential store inside app_settings (no new tables needed):
// key portal_login_<patientId> -> { phone, passwordHash, mustChangePassword }.
// Used automatically when migration 006 hasn't been applied yet.
const PORTAL_LOGIN_KEY = (patientId: string) => `portal_login_${patientId}`;

function rethrowSettingsMissing(e: any): never {
  if (/Could not find the table 'public\.app_settings'|app_settings.*schema cache/i.test(e?.message ?? "")) {
    throw new Error("Portal credential store is unavailable. Run 003_app_settings_and_schedules.sql in Supabase SQL Editor.");
  }
  throw e;
}

async function settingsLoginByPatientId(patientId: string): Promise<PatientLoginRow | null> {
  let all: Record<string, string>;
  try {
    all = await fetchAppSettings();
  } catch (e: any) {
    rethrowSettingsMissing(e);
  }
  const raw = all![PORTAL_LOGIN_KEY(patientId)];
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return { patientId, phone: v.phone, passwordHash: v.passwordHash, mustChangePassword: !!v.mustChangePassword };
  } catch {
    return null;
  }
}

async function settingsLoginByPhone(phone: string): Promise<PatientLoginRow | null> {
  let all: Record<string, string>;
  try {
    all = await fetchAppSettings();
  } catch (e: any) {
    rethrowSettingsMissing(e);
  }
  for (const [k, raw] of Object.entries(all!)) {
    if (!k.startsWith("portal_login_")) continue;
    try {
      const v = JSON.parse(raw);
      if (v.phone === phone) {
        return { patientId: k.slice("portal_login_".length), phone: v.phone, passwordHash: v.passwordHash, mustChangePassword: !!v.mustChangePassword };
      }
    } catch { /* skip corrupt entries */ }
  }
  return null;
}

export interface PatientLoginStatus {
  patientId: string;
  phone: string;
  mustChangePassword: boolean;
}

// All portal logins (safe fields only, never hashes) across both stores.
export async function fetchPatientLoginStatuses(): Promise<PatientLoginStatus[]> {
  const merged = new Map<string, PatientLoginStatus>();
  try {
    const { data, error } = await supabaseAdmin.from("patient_logins").select("patient_id, phone, must_change_password");
    if (error) throw error;
    for (const r of data ?? []) {
      merged.set(r.patient_id, { patientId: r.patient_id, phone: r.phone, mustChangePassword: !!r.must_change_password });
    }
  } catch (e: any) {
    if (!/Could not find the table|in the schema cache/i.test(e?.message ?? "")) throw e;
  }
  try {
    const all = await fetchAppSettings();
    for (const [k, raw] of Object.entries(all)) {
      if (!k.startsWith("portal_login_")) continue;
      const patientId = k.slice("portal_login_".length);
      if (merged.has(patientId)) continue;
      try {
        const v = JSON.parse(raw);
        merged.set(patientId, { patientId, phone: v.phone, mustChangePassword: !!v.mustChangePassword });
      } catch { /* skip corrupt entries */ }
    }
  } catch { /* settings store unavailable */ }
  return Array.from(merged.values());
}

export async function getPatientLoginByPhone(phone: string): Promise<PatientLoginRow | null> {
  const all = await getPatientLoginsByPhone(phone);
  return all[0] ?? null;
}

/** All logins sharing a phone (family members, cross-branch duplicates).
 *  Callers must verify the password against each — first verified hash wins. */
export async function getPatientLoginsByPhone(phone: string): Promise<PatientLoginRow[]> {
  try {
    return await withMigrationHint("006_patient_portal.sql", async () => {
      const { data, error } = await supabaseAdmin.from("patient_logins").select("*").eq("phone", phone).limit(10);
      if (error) throw error;
      return (data ?? []).map(mapPatientLogin);
    });
  } catch (e: any) {
    if (!isMissingTableError(e)) throw e;
    const one = await settingsLoginByPhone(phone);
    return one ? [one] : [];
  }
}

export async function getPatientLoginByPatientId(patientId: string): Promise<PatientLoginRow | null> {
  try {
    return await withMigrationHint("006_patient_portal.sql", async () => {
      const { data, error } = await supabaseAdmin.from("patient_logins").select("*").eq("patient_id", patientId).maybeSingle();
      if (error) throw error;
      return data ? mapPatientLogin(data) : null;
    });
  } catch (e: any) {
    if (!isMissingTableError(e)) throw e;
    return settingsLoginByPatientId(patientId);
  }
}

export async function upsertPatientLogin(input: { patientId: string; phone: string; passwordHash: string; mustChangePassword?: boolean }): Promise<PatientLoginRow> {
  try {
    return await withMigrationHint("006_patient_portal.sql", async () => {
      const { data, error } = await supabaseAdmin
        .from("patient_logins")
        .upsert(
          {
            patient_id: input.patientId,
            phone: input.phone,
            password_hash: input.passwordHash,
            must_change_password: input.mustChangePassword ?? true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "patient_id" }
        )
        .select()
        .single();
      if (error) throw error;
      return mapPatientLogin(data);
    });
  } catch (e: any) {
    if (!isMissingTableError(e)) throw e;
    const row: PatientLoginRow = {
      patientId: input.patientId, phone: input.phone,
      passwordHash: input.passwordHash, mustChangePassword: input.mustChangePassword ?? true,
    };
    await upsertAppSetting(PORTAL_LOGIN_KEY(input.patientId), JSON.stringify({
      phone: row.phone, passwordHash: row.passwordHash, mustChangePassword: row.mustChangePassword,
    }));
    return row;
  }
}

export async function updatePatientLogin(
  patientId: string,
  updates: Partial<{ phone: string; passwordHash: string; mustChangePassword: boolean; lastLoginAt: string }>
): Promise<PatientLoginRow> {
  try {
    return await withMigrationHint("006_patient_portal.sql", async () => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (updates.phone !== undefined) patch.phone = updates.phone;
      if (updates.passwordHash !== undefined) patch.password_hash = updates.passwordHash;
      if (updates.mustChangePassword !== undefined) patch.must_change_password = updates.mustChangePassword;
      if (updates.lastLoginAt !== undefined) patch.last_login_at = updates.lastLoginAt;
      const { data, error } = await supabaseAdmin.from("patient_logins").update(patch).eq("patient_id", patientId).select();
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Patient login not found.");
      return mapPatientLogin(data[0]);
    });
  } catch (e: any) {
    if (!isMissingTableError(e)) throw e;
    const current = await settingsLoginByPatientId(patientId);
    if (!current) throw new Error("Patient login not found.");
    const next: PatientLoginRow = {
      patientId,
      phone: updates.phone ?? current.phone,
      passwordHash: updates.passwordHash ?? current.passwordHash,
      mustChangePassword: updates.mustChangePassword ?? current.mustChangePassword,
    };
    await upsertAppSetting(PORTAL_LOGIN_KEY(patientId), JSON.stringify({
      phone: next.phone, passwordHash: next.passwordHash, mustChangePassword: next.mustChangePassword,
    }));
    return next;
  }
}

// ===== Digital prescriptions =====

function mapPrescriptionItem(row: any): PrescriptionItem {
  return {
    medicineName: row.medicine_name,
    dosage: row.dosage ?? "",
    frequency: row.frequency ?? "",
    duration: row.duration ?? "",
    quantity: row.quantity ?? 0,
    unit: row.unit ?? "Tablet",
    notes: row.notes ?? "",
  };
}

function mapPrescription(row: any, items: PrescriptionItem[] = []): Prescription {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    appointmentId: row.appointment_id ?? undefined,
    doctorName: row.doctor_name ?? "",
    diagnosis: row.diagnosis ?? "",
    notes: row.notes ?? "",
    status: row.status,
    date: row.date,
    branch: row.branch,
    items,
  };
}

const RX_KEY = (id: string) => `rx_${id}`;

function mapSettingsPrescription(v: any): Prescription | null {
  try {
    if (!v || typeof v !== "object" || !v.id || !v.patientId) return null;
    return {
      id: v.id, patientId: v.patientId, patientName: v.patientName || "",
      appointmentId: v.appointmentId, doctorName: v.doctorName || "",
      diagnosis: v.diagnosis || "", notes: v.notes || "",
      status: v.status || "Issued", date: v.date || "", branch: v.branch || "",
      items: Array.isArray(v.items) ? v.items : [],
    };
  } catch {
    return null;
  }
}

async function fetchSettingsPrescriptions(): Promise<Prescription[]> {
  try {
    const all = await fetchAppSettings();
    const out: Prescription[] = [];
    for (const [k, raw] of Object.entries(all)) {
      if (!k.startsWith("rx_")) continue;
      try {
        const parsed = mapSettingsPrescription(JSON.parse(raw));
        if (parsed) out.push(parsed);
      } catch { /* skip corrupt entries */ }
    }
    return out;
  } catch {
    return [];
  }
}

export async function fetchPrescriptions(patientId?: string, branch?: string): Promise<Prescription[]> {
  let tableRows: Prescription[] = [];
  try {
    tableRows = await withMigrationHint("006_patient_portal.sql", async () => {
      let query = supabaseAdmin.from("prescriptions").select("*").order("date", { ascending: false });
      if (patientId) query = query.eq("patient_id", patientId);
      else if (branch) query = query.eq("branch", branch);
      const { data, error } = await query;
      if (error) throw error;
      const out: Prescription[] = [];
      for (const row of data ?? []) {
        const { data: items } = await supabaseAdmin.from("prescription_items").select("*").eq("prescription_id", row.id);
        out.push(mapPrescription(row, (items ?? []).map(mapPrescriptionItem)));
      }
      return out;
    });
  } catch (e: any) {
    if (!/006_patient_portal\.sql/.test(e?.message ?? "")) throw e;
  }
  const settingsRows = await fetchSettingsPrescriptions();
  const seen = new Set(tableRows.map((r) => r.id));
  const merged = [...tableRows, ...settingsRows.filter((r) => !seen.has(r.id))];
  return merged
    .filter((r) => !patientId || r.patientId === patientId)
    .filter((r) => patientId || !branch || r.branch === branch)
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

export async function createPrescription(p: Prescription): Promise<Prescription> {
  const record: Prescription = {
    ...p,
    id: p.id || `rx${Date.now()}`,
    date: p.date || new Date().toISOString().split("T")[0],
    status: p.status || "Issued",
    items: p.items ?? [],
  };
  try {
    return await withMigrationHint("006_patient_portal.sql", async () => {
      const { data, error } = await supabaseAdmin
        .from("prescriptions")
        .insert({
          id: record.id,
          patient_id: record.patientId,
          patient_name: record.patientName,
          appointment_id: record.appointmentId || null,
          doctor_name: record.doctorName || "",
          diagnosis: record.diagnosis || "",
          notes: record.notes || "",
          status: record.status || "Issued",
          date: record.date,
          branch: record.branch,
        })
        .select()
        .single();
      if (error) throw error;
      if (record.items && record.items.length > 0) {
        const rows = record.items.map((it) => ({
          prescription_id: data.id,
          medicine_name: it.medicineName,
          dosage: it.dosage || "",
          frequency: it.frequency || "",
          duration: it.duration || "",
          quantity: it.quantity ?? 0,
          unit: it.unit || "Tablet",
          notes: it.notes || "",
        }));
        const { error: itemError } = await supabaseAdmin.from("prescription_items").insert(rows);
        if (itemError) {
          await supabaseAdmin.from("prescriptions").delete().eq("id", data.id);
          throw itemError;
        }
      }
      return mapPrescription(data, record.items ?? []);
    });
  } catch (e: any) {
    if (!/006_patient_portal\.sql/.test(e?.message ?? "")) throw e;
    await upsertAppSetting(RX_KEY(record.id), JSON.stringify(record));
    return record;
  }
}

// ===== Patient appointment requests =====

function mapAppointmentRequest(row: any): AppointmentRequest {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name,
    phone: row.phone ?? "",
    doctorId: row.doctor_id ?? "",
    doctorName: row.doctor_name,
    department: row.department ?? "",
    date: row.date,
    time: row.time,
    reason: row.reason ?? "",
    fee: row.fee ?? 0,
    status: row.status,
    branch: row.branch,
    createdAt: row.created_at ?? undefined,
  };
}

const APPT_REQ_KEY = (id: string) => `appt_req_${id}`;

function mapSettingsRequest(v: any): AppointmentRequest | null {
  try {
    if (!v || typeof v !== "object") return null;
    if (!v.id || !v.patientId) return null;
    return {
      id: v.id, patientId: v.patientId, patientName: v.patientName || "",
      phone: v.phone || "", doctorId: v.doctorId || "", doctorName: v.doctorName || "",
      department: v.department || "", date: v.date || "", time: v.time || "",
      reason: v.reason || "", fee: v.fee ?? 0, status: v.status || "Requested",
      branch: v.branch || "", createdAt: v.createdAt,
    };
  } catch {
    return null;
  }
}

async function fetchSettingsRequests(): Promise<AppointmentRequest[]> {
  try {
    const all = await fetchAppSettings();
    const out: AppointmentRequest[] = [];
    for (const [k, raw] of Object.entries(all)) {
      if (!k.startsWith("appt_req_")) continue;
      try {
        const parsed = mapSettingsRequest(JSON.parse(raw));
        if (parsed) out.push(parsed);
      } catch { /* skip corrupt entries */ }
    }
    return out;
  } catch {
    return [];
  }
}

function filterRequests(list: AppointmentRequest[], patientId?: string, branch?: string, status?: string): AppointmentRequest[] {
  return list
    .filter((r) => !patientId || r.patientId === patientId)
    .filter((r) => !branch || r.branch === branch)
    .filter((r) => !status || r.status === status)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
}

export async function fetchAppointmentRequests(patientId?: string, branch?: string, status?: string): Promise<AppointmentRequest[]> {
  // Table rows first; settings-backed rows merged in when migration 007 is
  // pending, so booking works with zero SQL.
  let tableRows: AppointmentRequest[] = [];
  try {
    tableRows = await withMigrationHint("007_appointment_requests.sql", async () => {
      let query = supabaseAdmin.from("appointment_requests").select("*").order("created_at", { ascending: false });
      if (patientId) query = query.eq("patient_id", patientId);
      if (branch) query = query.eq("branch", branch);
      if (status) query = query.eq("status", status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map(mapAppointmentRequest);
    });
  } catch (e: any) {
    if (!/007_appointment_requests\.sql/.test(e?.message ?? "")) throw e;
  }
  const settingsRows = await fetchSettingsRequests();
  const seen = new Set(tableRows.map((r) => r.id));
  const merged = [...tableRows, ...settingsRows.filter((r) => !seen.has(r.id))];
  return filterRequests(merged, patientId, branch, status);
}

export async function createAppointmentRequest(r: AppointmentRequest): Promise<AppointmentRequest> {
  const record: AppointmentRequest = {
    ...r,
    id: r.id || `ar${Date.now()}`,
    status: r.status || "Requested",
    createdAt: new Date().toISOString(),
  };
  try {
    return await withMigrationHint("007_appointment_requests.sql", async () => {
      const { data, error } = await supabaseAdmin
        .from("appointment_requests")
        .insert({
          id: record.id,
          patient_id: record.patientId,
          patient_name: record.patientName,
          phone: record.phone || "",
          doctor_id: record.doctorId || "",
          doctor_name: record.doctorName,
          department: record.department || "",
          date: record.date,
          time: record.time,
          reason: record.reason || "",
          fee: record.fee ?? 0,
          status: record.status || "Requested",
          branch: record.branch,
        })
        .select()
        .single();
      if (error) throw error;
      return mapAppointmentRequest(data);
    });
  } catch (e: any) {
    if (!/007_appointment_requests\.sql/.test(e?.message ?? "")) throw e;
    await upsertAppSetting(APPT_REQ_KEY(record.id), JSON.stringify(record));
    return record;
  }
}

async function getRequestById(id: string): Promise<{ record: AppointmentRequest; inSettings: boolean } | null> {
  try {
    const rows = await withMigrationHint("007_appointment_requests.sql", async () => {
      const { data, error } = await supabaseAdmin.from("appointment_requests").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data ? [mapAppointmentRequest(data)] : [];
    });
    if (rows.length > 0) return { record: rows[0], inSettings: false };
  } catch (e: any) {
    if (!/007_appointment_requests\.sql/.test(e?.message ?? "")) throw e;
  }
  const all = await fetchSettingsRequests();
  const found = all.find((r) => r.id === id);
  return found ? { record: found, inSettings: true } : null;
}

export async function updateAppointmentRequest(id: string, status: AppointmentRequest["status"]): Promise<AppointmentRequest> {
  const existing = await getRequestById(id);
  if (existing && existing.inSettings) {
    const next = { ...existing.record, status };
    await upsertAppSetting(APPT_REQ_KEY(id), JSON.stringify(next));
    return next;
  }
  return withMigrationHint("007_appointment_requests.sql", async () => {
    const { data, error } = await supabaseAdmin
      .from("appointment_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return mapAppointmentRequest(data);
  });
}

export async function updatePrescriptionStatus(id: string, status: Prescription["status"]): Promise<Prescription> {
  // Settings-backed records (pre-migration) update in place.
  try {
    const all = await fetchAppSettings();
    const raw = all[RX_KEY(id)];
    if (raw) {
      const current = mapSettingsPrescription(JSON.parse(raw));
      if (current) {
        const next = { ...current, status };
        await upsertAppSetting(RX_KEY(id), JSON.stringify(next));
        return next;
      }
    }
  } catch { /* fall through to table path */ }
  return withMigrationHint("006_patient_portal.sql", async () => {
    const { data, error } = await supabaseAdmin
      .from("prescriptions")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    const { data: items } = await supabaseAdmin.from("prescription_items").select("*").eq("prescription_id", id);
    return mapPrescription(data, (items ?? []).map(mapPrescriptionItem));
  });
}

export async function ensureDoctor(doctor: {
  email: string; name?: string; phone?: string; branch: string; department?: string;
  consultationFee?: number; availableDays?: string[]; shift?: string; schedule?: DayShift[];
  availableFrom?: string; availableTo?: string;
}): Promise<Doctor> {
  const normName = (n: string) => n.trim().toLowerCase().replace(/^dr\.?\s+/, "");
  const { data: byEmail } = await supabaseAdmin
    .from("doctors")
    .select("*")
    .eq("email", doctor.email)
    .maybeSingle();
  if (byEmail) return mapDoctor(byEmail);
  // Same person under a different email (e.g. auto-generated staff address)?
  // Match by normalized name within the branch instead of creating a duplicate.
  if (doctor.name) {
    const { data: branchRows } = await supabaseAdmin.from("doctors").select("*").eq("branch", doctor.branch);
    const sameName = (branchRows ?? []).find((r: any) => normName(r.name || "") === normName(doctor.name || ""));
    if (sameName) return mapDoctor(sameName);
  }
  const created = await createDoctor({
    id: `d${Date.now()}`,
    name: doctor.name || "Doctor",
    photo: "",
    specialization: doctor.department || "General Medicine",
    department: doctor.department || "General Medicine",
    experience: 0,
    qualification: "",
    phone: doctor.phone || "",
    email: doctor.email,
    availability: "Available",
    rating: 0,
    consultationFee: doctor.consultationFee ?? 0,
    todayAppointments: 0,
    patientsTreated: 0,
    branch: doctor.branch,
    availableDays: doctor.availableDays ?? [],
    availableFrom: doctor.availableFrom ?? "",
    availableTo: doctor.availableTo ?? "",
    shift: doctor.shift || "",
    schedule: doctor.schedule ?? [],
  });
  return created;
}

export async function fetchAppSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin.from("app_settings").select("key,value");
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: any) => [r.key, r.value]));
}

export async function upsertAppSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export async function deleteAppSetting(key: string): Promise<void> {
  const { error } = await supabaseAdmin.from("app_settings").delete().eq("key", key);
  if (error) throw error;
}

export async function fetchUsers(): Promise<UserAccount[]> {
  const { data, error } = await supabaseAdmin.from("users").select("*").order("name");
  if (error) throw error;
  return (data ?? []).map(mapUser);
}

export async function createUser(user: UserAccountPayload): Promise<UserAccount> {
  return withColumnFallback("users", {
    email: user.email,
    name: user.name,
    password_hash: user.password,
    role: user.role,
    avatar: user.avatar || null,
    branch: user.branch || null,
    branch_id: user.branchId || null,
    staff_id: user.staffId || null,
    must_change_password: user.mustChangePassword ?? false,
  }, async (row) => {
    const { data, error } = await supabaseAdmin.from("users").insert(row).select().single();
    if (error) throw error;
    return mapUser(data);
  });
}

export async function fetchInventory(branch?: string): Promise<InventoryItem[]> {
  let query = supabaseAdmin.from("inventory").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapInventoryItem);
}

export async function createInventoryItem(item: InventoryItem): Promise<InventoryItem> {
  const { data, error } = await supabaseAdmin.from("inventory").insert({
    id: item.id, name: item.name, category: item.category,
    stock: item.stock, reorder_level: item.reorderLevel, unit: item.unit,
    supplier: item.supplier, price: item.price, location: item.location,
    last_restocked: item.lastRestocked, status: item.status, branch: item.branch,
  }).select().single();
  if (error) throw error;
  return mapInventoryItem(data);
}

export async function updateInventoryItemRow(id: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.stock !== undefined) patch.stock = updates.stock;
  if (updates.reorderLevel !== undefined) patch.reorder_level = updates.reorderLevel;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.supplier !== undefined) patch.supplier = updates.supplier;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.lastRestocked !== undefined) patch.last_restocked = updates.lastRestocked;
  const { data, error } = await supabaseAdmin.from("inventory").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapInventoryItem(data);
}

export async function fetchNotifications(branch?: string): Promise<Notification[]> {
  let query = supabaseAdmin.from("notifications").select("*").order("created_at", { ascending: false });
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapNotification);
}

export async function createNotification(notification: Notification): Promise<Notification> {
  const { data, error } = await supabaseAdmin.from("notifications").insert({
    id: notification.id, type: notification.type, title: notification.title,
    message: notification.message, time: notification.time, read: notification.read,
    priority: notification.priority, branch: notification.branch,
  }).select().single();
  if (error) throw error;
  return mapNotification(data);
}

export async function updateNotificationRow(id: string, updates: Partial<Notification>): Promise<Notification> {
  const patch: Record<string, unknown> = {};
  if (updates.read !== undefined) patch.read = updates.read;
  const { data, error } = await supabaseAdmin.from("notifications").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapNotification(data);
}

export async function fetchRevenueTrend(branchId?: string) {
  let query = supabaseAdmin.from("revenue_trend").select("*").order("id");
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    month: r.month,
    revenue: r.revenue,
    opd: r.opd,
    ipd: r.ipd,
  }));
}

export async function fetchPatientGrowth(branchId?: string) {
  let query = supabaseAdmin.from("patient_growth").select("*").order("id");
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((p: any) => ({
    month: p.month,
    new: p.new_patients,
    total: p.total_patients,
  }));
}

export async function fetchDepartmentPerformance(branchId?: string) {
  let query = supabaseAdmin.from("department_performance").select("*").order("id");
  if (branchId) query = query.eq("branch_id", branchId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((d: any) => ({
    department: d.department,
    patients: d.patients,
    revenue: d.revenue,
    satisfaction: d.satisfaction,
  }));
}

export async function deleteDoctorRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("doctors").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAppointmentRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("appointments").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteBedRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("beds").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteInvoiceRow(id: string): Promise<void> {
  await supabaseAdmin.from("invoice_items").delete().eq("invoice_id", id);
  const { error } = await supabaseAdmin.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteMedicineRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("medicines").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteLabTestRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("lab_tests").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteRadiologyOrderRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("radiology_orders").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteInsuranceClaimRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("insurance_claims").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteLeadRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("leads").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteCampaignRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteStaffRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("staff").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteInventoryItemRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("inventory").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteNotificationRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("notifications").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteBranchRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("branches").delete().eq("id", id);
  if (error) throw error;
}

// ===== Nursing Station (migration 014) =====

function mapNurseAssignment(row: any): NurseAssignment {
  return {
    nurseId: row.nurse_id,
    nurseName: row.nurse_name ?? "",
    doctorIds: row.doctor_ids ?? [],
    wards: row.wards ?? [],
    bedIds: row.bed_ids ?? [],
  };
}

export async function fetchNurseAssignments(branch?: string): Promise<NurseAssignment[]> {
  let query = supabaseAdmin.from("nurse_assignments").select("*").order("nurse_name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapNurseAssignment);
}

export async function upsertNurseAssignment(a: NurseAssignment & { branch: string }): Promise<NurseAssignment> {
  const { data, error } = await supabaseAdmin.from("nurse_assignments").upsert({
    nurse_id: a.nurseId,
    nurse_name: a.nurseName,
    doctor_ids: a.doctorIds,
    wards: a.wards,
    bed_ids: a.bedIds,
    branch: a.branch,
    updated_at: new Date().toISOString(),
  }, { onConflict: "nurse_id" }).select().single();
  if (error) throw error;
  return mapNurseAssignment(data);
}

function mapVitals(row: any): VitalsEntry {
  return {
    id: row.id,
    patientId: row.patient_id ?? "",
    patientName: row.patient_name ?? "",
    nurseId: row.nurse_id ?? "",
    nurse: row.nurse ?? "",
    at: row.at ?? "",
    bpSys: row.bp_sys ?? "",
    bpDia: row.bp_dia ?? "",
    pulse: row.pulse ?? "",
    temp: row.temp ?? "",
    spo2: row.spo2 ?? "",
    sugar: row.sugar ?? "",
    condition: row.condition ?? "Stable",
    notes: row.notes ?? "",
    branch: row.branch ?? "",
  };
}

export async function fetchNurseVitals(branch?: string, patientId?: string): Promise<VitalsEntry[]> {
  let query = supabaseAdmin.from("nurse_vitals").select("*").order("at", { ascending: false }).limit(2000);
  if (branch) query = query.eq("branch", branch);
  if (patientId) query = query.eq("patient_id", patientId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapVitals);
}

export async function createNurseVitals(v: VitalsEntry): Promise<VitalsEntry> {
  const { data, error } = await supabaseAdmin.from("nurse_vitals").insert({
    id: v.id,
    patient_id: v.patientId || "",
    patient_name: v.patientName,
    nurse_id: v.nurseId,
    nurse: v.nurse,
    at: v.at,
    bp_sys: v.bpSys ?? "",
    bp_dia: v.bpDia ?? "",
    pulse: v.pulse ?? "",
    temp: v.temp ?? "",
    spo2: v.spo2 ?? "",
    sugar: v.sugar ?? "",
    condition: v.condition,
    notes: v.notes ?? "",
    branch: v.branch,
  }).select().single();
  if (error) throw error;
  return mapVitals(data);
}

function mapFirstAid(row: any): FirstAidEntry {
  return {
    id: row.id,
    patientId: row.patient_id ?? "",
    patientName: row.patient_name ?? "",
    customName: row.custom_name ?? "",
    nurseId: row.nurse_id ?? "",
    nurse: row.nurse ?? "",
    at: row.at ?? "",
    kind: row.kind ?? "Other",
    bedId: row.bed_id ?? "",
    bedNumber: row.bed_number ?? "",
    notes: row.notes ?? "",
    amount: Number(row.amount ?? 0),
    paidAmount: Number(row.paid_amount ?? 0),
    invoiceId: row.invoice_id ?? "",
    branch: row.branch ?? "",
  };
}

export async function fetchNurseFirstAid(branch?: string): Promise<FirstAidEntry[]> {
  let query = supabaseAdmin.from("nurse_firstaid").select("*").order("at", { ascending: false }).limit(1000);
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapFirstAid);
}

export async function createNurseFirstAid(f: FirstAidEntry): Promise<FirstAidEntry> {
  const { data, error } = await supabaseAdmin.from("nurse_firstaid").insert({
    id: f.id,
    patient_id: f.patientId || "",
    patient_name: f.patientName,
    custom_name: f.customName ?? "",
    nurse_id: f.nurseId,
    nurse: f.nurse,
    at: f.at,
    kind: f.kind,
    bed_id: f.bedId || "",
    bed_number: f.bedNumber ?? "",
    notes: f.notes ?? "",
    amount: f.amount ?? 0,
    paid_amount: f.paidAmount ?? 0,
    invoice_id: f.invoiceId ?? "",
    branch: f.branch,
  }).select().single();
  if (error) throw error;
  return mapFirstAid(data);
}

export async function updateNurseFirstAidRow(id: string, updates: { paidAmount?: number; invoiceId?: string; notes?: string }): Promise<FirstAidEntry> {
  const patch: Record<string, unknown> = {};
  if (updates.paidAmount !== undefined) patch.paid_amount = updates.paidAmount;
  if (updates.invoiceId !== undefined) patch.invoice_id = updates.invoiceId;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  const { data, error } = await supabaseAdmin.from("nurse_firstaid").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapFirstAid(data);
}

// ===== Accountant workspace: expenses (migration 017) =====

function mapExpense(row: any): Expense {
  return {
    id: row.id,
    title: row.title ?? "",
    category: row.category ?? "Other",
    amount: Number(row.amount ?? 0),
    date: row.date ?? "",
    paymentMethod: row.payment_method ?? "Cash",
    vendor: row.vendor ?? "",
    notes: row.notes ?? "",
    recordedBy: row.recorded_by ?? "",
    branch: row.branch ?? "",
  };
}

export async function fetchExpenses(branch?: string): Promise<Expense[]> {
  let query = supabaseAdmin.from("expenses").select("*").order("date", { ascending: false }).limit(2000);
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function createExpense(e: Expense): Promise<Expense> {
  const { data, error } = await supabaseAdmin.from("expenses").insert({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: e.amount ?? 0,
    date: e.date,
    payment_method: e.paymentMethod || "Cash",
    vendor: e.vendor ?? "",
    notes: e.notes ?? "",
    recorded_by: e.recordedBy ?? "",
    branch: e.branch,
  }).select().single();
  if (error) throw error;
  return mapExpense(data);
}

export async function updateExpenseRow(id: string, updates: Partial<Expense>): Promise<Expense> {
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.category !== undefined) patch.category = updates.category;
  if (updates.amount !== undefined) patch.amount = updates.amount;
  if (updates.date !== undefined) patch.date = updates.date;
  if (updates.paymentMethod !== undefined) patch.payment_method = updates.paymentMethod;
  if (updates.vendor !== undefined) patch.vendor = updates.vendor;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  const { data, error } = await supabaseAdmin.from("expenses").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapExpense(data);
}

export async function deleteExpenseRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

// ===== Branch departments (migration 022) =====

function mapDepartment(row: any): Department {
  return {
    id: row.id,
    name: row.name ?? "",
    branch: row.branch ?? "",
    head: row.head ?? "",
    description: row.description ?? "",
    isActive: row.is_active ?? true,
  };
}

export async function fetchDepartments(branch?: string): Promise<Department[]> {
  let query = supabaseAdmin.from("departments").select("*").order("name");
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapDepartment);
}

export async function createDepartment(d: Department): Promise<Department> {
  const { data, error } = await supabaseAdmin.from("departments").insert({
    id: d.id,
    name: d.name,
    branch: d.branch,
    head: d.head ?? "",
    description: d.description ?? "",
    is_active: d.isActive ?? true,
  }).select().single();
  if (error) throw error;
  return mapDepartment(data);
}

export async function updateDepartmentRow(id: string, updates: Partial<Department>): Promise<Department> {
  const patch: Record<string, unknown> = {};
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.head !== undefined) patch.head = updates.head;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;
  const { data, error } = await supabaseAdmin.from("departments").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return mapDepartment(data);
}

export async function deleteDepartmentRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("departments").delete().eq("id", id);
  if (error) throw error;
}

// ===== Staff attendance (migration 023) =====

  // ===== WiFi-gated attendance (migration 030 + Network settings) =====

  /** Best-effort client IP from proxy headers (first public entry wins). */
  export function requesterIp(headers: Headers): string {
    const fwd = headers.get("x-forwarded-for") ?? "";
    const first = fwd.split(",").map((s) => s.trim()).find(Boolean) ?? "";
    const real = (headers.get("x-real-ip") ?? "").trim();
    const raw = first || real;
    // Normalize ::ffff:1.2.3.4 → 1.2.3.4; drop port suffixes.
    return raw.replace(/^::ffff:/, "").split(":").length > 2 ? raw : raw.split(":")[0];
  }

  function sameLan24(a: string, b: string): boolean {
    const pa = a.trim().split(".");
    const pb = b.trim().split(".");
    return pa.length === 4 && pb.length === 4 && pa.slice(0, 3).join(".") === pb.slice(0, 3).join(".");
  }

  export interface BranchNetwork {
    mode: string;
    ipAddress: string;
    enforced: boolean;
  }

  /** Branch network config from app_settings (branch-scoped, global fallback). */
  export async function getBranchNetwork(branch?: string): Promise<BranchNetwork> {
    try {
      const s = await fetchAppSettings();
      const pick = (k: string) => {
        const scoped = branch ? s[`${k}@@${branch}`] : undefined;
        if (scoped !== undefined && scoped !== "") return scoped;
        return s[k] ?? "";
      };
      const mode = pick("network_mode") || "DHCP";
      const ipAddress = pick("network_ipAddress") ?? "";
      return { mode, ipAddress, enforced: mode === "Static" && ipAddress.trim() !== "" };
    } catch {
      return { mode: "DHCP", ipAddress: "", enforced: false };
    }
  }

  /**
   * Is this request coming from the clinic network? Exact saved-IP match or
   * same /24 LAN counts as on-network (devices differ in the last octet).
   * Branches without a static IP configured stay open.
   */
  export async function verifyBranchNetwork(ip: string, branch?: string): Promise<{ verified: boolean; ip: string; reason: string }> {
    const net = await getBranchNetwork(branch);
    if (!net.enforced) return { verified: true, ip, reason: "No static clinic IP configured for this branch — open." };
    // Strict: no localhost/loopback exception. When enforcement is on, even
    // the server machine itself must come through the clinic network,
    // otherwise off-WiFi punches would slip through during testing.
    if (!ip) return { verified: false, ip, reason: "Could not determine device IP." };
    const saved = net.ipAddress.trim();
    if (ip === saved || sameLan24(ip, saved)) {
      return { verified: true, ip, reason: `On clinic network (${ip}).` };
    }
    return { verified: false, ip, reason: `Device IP ${ip || "unknown"} is not on the clinic network (${saved}). Connect to clinic WiFi.` };
  }

  function mapAttendance(row: any): AttendanceRecord {
    return {
      id: row.id,
      staffId: row.staff_id ?? "",
      staffName: row.staff_name ?? "",
      date: row.date ?? "",
      checkIn: row.check_in ?? "",
      checkOut: row.check_out ?? "",
      status: row.status ?? "Present",
      mode: row.mode ?? "Manual",
      markedBy: row.marked_by ?? "",
      notes: row.notes ?? "",
      branch: row.branch ?? "",
      deviceIp: row.device_ip ?? "",
      networkVerified: row.network_verified ?? false,
    };
  }

export async function fetchAttendance(branch?: string, from?: string, to?: string): Promise<AttendanceRecord[]> {
  let query = supabaseAdmin.from("staff_attendance").select("*").order("date", { ascending: false }).limit(5000);
  if (branch) query = query.eq("branch", branch);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAttendance);
}

  /** One row per staff per day — repeats upsert the same day. */
  export async function upsertAttendance(a: AttendanceRecord): Promise<AttendanceRecord> {
    const data = await withColumnFallback("staff_attendance", {
      id: a.id,
      staff_id: a.staffId,
      staff_name: a.staffName,
      date: a.date,
      check_in: a.checkIn ?? "",
      check_out: a.checkOut ?? "",
      status: a.status,
      mode: a.mode,
      marked_by: a.markedBy ?? "",
      notes: a.notes ?? "",
      branch: a.branch,
      device_ip: a.deviceIp ?? "",
      network_verified: a.networkVerified ?? false,
    }, async (clean) => {
      const { data, error } = await supabaseAdmin.from("staff_attendance").upsert(clean, { onConflict: "staff_id,date" }).select().single();
      if (error) throw error;
      return data;
    });
    return mapAttendance(data);
  }

export async function deleteAttendanceRow(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from("staff_attendance").delete().eq("id", id);
  if (error) throw error;
}

// ===== Appointment reminders (migration 025) =====

function mapAppointmentReminder(row: any): import("@/lib/types").AppointmentReminder {
  return {
    id: row.id,
    appointmentId: row.appointment_id ?? "",
    patientId: row.patient_id ?? "",
    patientName: row.patient_name ?? "",
    patientPhone: row.patient_phone ?? "",
    doctorName: row.doctor_name ?? "",
    department: row.department ?? "",
    appointmentDate: row.appointment_date ?? "",
    appointmentTime: row.appointment_time ?? "",
    minutesBefore: row.minutes_before ?? 30,
    sentAt: row.sent_at ?? "",
    method: row.method ?? "push",
    status: row.status ?? "sent",
    branch: row.branch ?? "",
  };
}

export async function fetchAppointmentReminders(branch?: string): Promise<import("@/lib/types").AppointmentReminder[]> {
  let query = supabaseAdmin.from("appointment_reminders").select("*").order("sent_at", { ascending: false }).limit(2000);
  if (branch) query = query.eq("branch", branch);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapAppointmentReminder);
}

export async function createAppointmentReminder(r: import("@/lib/types").AppointmentReminder): Promise<import("@/lib/types").AppointmentReminder> {
  const { data, error } = await supabaseAdmin.from("appointment_reminders").insert({
    id: r.id,
    appointment_id: r.appointmentId,
    patient_id: r.patientId,
    patient_name: r.patientName,
    patient_phone: r.patientPhone ?? "",
    doctor_name: r.doctorName,
    department: r.department ?? "",
    appointment_date: r.appointmentDate,
    appointment_time: r.appointmentTime,
    minutes_before: r.minutesBefore ?? 30,
    sent_at: r.sentAt,
    method: r.method,
    status: r.status,
    branch: r.branch,
  }).select().single();
  if (error) throw error;
  return mapAppointmentReminder(data);
}
