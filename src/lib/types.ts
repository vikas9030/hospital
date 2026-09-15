// ===== Core Types for Hospital CRM =====

export type ModuleKey =
  | "dashboard"
  | "patients"
  | "doctors"
  | "appointments"
  | "reception"
  | "opd"
  | "ipd"
  | "beds"
  | "surgery"
  | "billing"
  | "insurance"
  | "accounts"
  | "attendance"
  | "laboratory"
  | "radiology"
  | "nursing"
  | "pharmacy"
  | "records"
  | "crm"
  | "marketing"
  | "reports"
  | "staff"
  | "inventory"
  | "settings";

export type ModuleName =
  | "patients"
  | "doctors"
  | "appointments"
  | "opd"
  | "ipd"
  | "beds"
  | "surgery"
  | "billing"
  | "insurance"
  | "accounts"
  | "attendance"
  | "laboratory"
  | "radiology"
  | "nursing"
  | "pharmacy"
  | "records"
  | "crm"
  | "marketing"
  | "staff"
  | "inventory";

export type PatientCondition = "Stable" | "Under Observation" | "Critical" | "Recovering";

/** Vitals + status recorded by a nurse during a patient check. */
export interface VitalsEntry {
  id: string;
  patientId: string;
  patientName: string;
  nurseId: string;
  nurse: string;
  at: string;
  bpSys?: string;
  bpDia?: string;
  pulse?: string;
  temp?: string;
  spo2?: string;
  sugar?: string;
  condition: PatientCondition;
  notes?: string;
  branch: string;
}

/** First-aid / bedside care given by a nurse. */
export interface FirstAidEntry {
  id: string;
  patientId: string;
  patientName: string;
  /** Walk-in name when the patient is not registered. */
  customName?: string;
  nurseId: string;
  nurse: string;
  at: string;
  kind: "Dressing" | "Injection" | "IV Line" | "Oxygen" | "First Response" | "Bedside Care" | "Other";
  bedId?: string;
  bedNumber?: string;
  notes?: string;
  /** Charge for the care (₹). Billed as an invoice so Billing counts it. */
  amount?: number;
  /** Collected so far (₹). */
  paidAmount?: number;
  invoiceId?: string;
  branch: string;
}

/** Admin assignment: which doctors, wards and beds a nurse covers. */
export interface NurseAssignment {
  nurseId: string;
  nurseName: string;
  doctorIds: string[];
  wards: string[];
  bedIds: string[];
}

export type Role =
  | "Admin"
  | "Doctor"
  | "Receptionist"
  | "Nurse"
  | "Pharmacist"
  | "Lab Technician"
  | "Radiologist"
  | "Accountant"
  | "HR"
  | "Marketing"
  | "Patient"
  | (string & {});

export interface Patient {
  id: string;
  uhid: string;
  name: string;
  photo: string;
  gender: "Male" | "Female" | "Other";
  age: number;
  phone: string;
  email: string;
  bloodGroup: string;
  address: string;
  emergencyContact: string;
  insuranceProvider: string;
  insurancePolicy: string;
  allergies: string[];
  chronicDiseases: string[];
  status: "Active" | "Admitted" | "Discharged" | "OPD" | "Follow Up";
  lastVisit: string;
  registeredOn: string;
  branch: string;
  opDate?: string;
  opFees?: number;
  doctorId?: string;
  doctorName?: string;
}

export interface TimelineEvent {
  id: string;
  type:
    | "appointment"
    | "consultation"
    | "prescription"
    | "lab"
    | "radiology"
    | "billing"
    | "payment"
    | "followup"
    | "admission"
    | "discharge";
  title: string;
  description: string;
  timestamp: string;
  doctor?: string;
  status: "completed" | "pending" | "in-progress";
  amount?: number;
}

export interface Doctor {
  id: string;
  name: string;
  photo: string;
  specialization: string;
  department: string;
  experience: number;
  qualification: string;
  phone: string;
  email: string;
  availability: "Available" | "Busy" | "Off Duty" | "On Leave" | "Follow Up";
  rating: number;
  consultationFee: number;
  todayAppointments: number;
  patientsTreated: number;
  branch: string;
  availableDays?: string[];
  availableFrom?: string;
  availableTo?: string;
  shift?: string;
  /** Detailed per-day shift timings (multiple shifts per day allowed). */
  schedule?: DayShift[];
}

export interface DoctorBranchSchedule {
  id?: string;
  doctorEmail: string;
  branch: string;
  availableDays: string[];
  availableFrom?: string;
  availableTo?: string;
  shift?: string;
}

export interface Appointment {
  id: string;
  token: string;
  patientId: string;
  patientName: string;
  patientPhoto: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  type: "Walk-in" | "Online" | "Emergency" | "Referral";
  status: "Scheduled" | "Checked-in" | "In Consultation" | "Completed" | "Cancelled" | "No-show" | "Follow Up";
  reason: string;
  waitingTime: number;
  branch: string;
  recurrence?: RecurringSchedule;
  reminderSent?: boolean;
  reminderMinutesBefore?: number;
    /** Doctor-entered clinical notes, health problems, diagnostic observations. */
    clinicalNotes?: string;
    problems?: string;
    /** Cancel audit (migration 026) — who cancelled, when, and why. */
    cancelledBy?: string;
    cancelledAt?: string;
    cancelReason?: string;
  }

export interface PrescriptionItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  unit: "Tablet" | "Sheet";
  notes?: string;
}

export interface Prescription {
  id: string;
  patientId: string;
  patientName: string;
  appointmentId?: string;
  doctorName: string;
  diagnosis: string;
  notes: string;
  status: "Issued" | "Partially Dispensed" | "Dispensed" | "Cancelled" | "Follow Up";
  date: string;
  branch: string;
  items: PrescriptionItem[];
}

export interface PatientLogin {
  patientId: string;
  phone: string;
  mustChangePassword: boolean;
  lastLoginAt?: string;
}

/** One shift timing on one weekday, e.g. Mon 09:00–13:00 Morning. */
export interface DayShift {
  day: string;
  from: string;
  to: string;
  shift: string;
}

export interface AppointmentRequest {
  id: string;
  patientId: string;
  patientName: string;
  phone: string;
  doctorId: string;
  doctorName: string;
  department: string;
  date: string;
  time: string;
  reason: string;
  fee: number;
  status: "Requested" | "Accepted" | "Rejected" | "Cancelled" | "Follow Up";
  branch: string;
  createdAt?: string;
}

export interface RecurringSchedule {
  frequency: number;
  period: "month" | "week";
  totalOccurrences: number;
  completedOccurrences: number;
  startDate: string;
  groupId: string;
}

export interface AppointmentReminder {
  id: string;
  appointmentId: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  department: string;
  appointmentDate: string;
  appointmentTime: string;
  minutesBefore: number;
  sentAt: string;
  method: "sms" | "email" | "push" | "whatsapp";
  status: "pending" | "sent" | "failed";
  branch: string;
}

export interface Bed {
  id: string;
  number: string;
  ward: "ICU" | "General Ward" | "Private Room" | "Semi Private" | "Emergency" | "Operation Theatre";
  status: "Available" | "Occupied" | "Maintenance" | "Reserved" | "Follow Up";
  patientName?: string;
  patientId?: string;
  admittedOn?: string;
  dailyRate: number;
  branch: string;
  type?: string;
  doctorName?: string;
  diagnosis?: string;
  department?: string;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  patientId: string;
  patientName: string;
  date: string;
  dueDate: string;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discount: number;
  /** Percentage-based billing (migration 027). Amounts derive from these. */
  discountPercent?: number;
  gstPercent?: number;
  gstAmount?: number;
  cstPercent?: number;
  cstAmount?: number;
  /** Flexible named tax lines (migration 028) — source of truth for tax. */
  taxes?: InvoiceTaxLine[];
  total: number;
  paidAmount: number;
  status: "Paid" | "Partial" | "Pending" | "Overdue" | "Follow Up"
    | "Partially Paid" | "Overpaid" | "Refund Due" | "Cancelled" | "Finalized" | "Draft";
  paymentMethod?: string;
  branch: string;
  paidDate?: string;
  /** IPD link — every IPD charge/invoice belongs to an admission (031+). */
  admissionId?: string;
  /** OPD | IPD | Surgery | Pharmacy | Lab | Radiology | Package | Interim | Final */
  billKind?: string;
  /** Draft | Finalized | Cancelled — finalized bills are read-only. */
  billStatus?: "Draft" | "Finalized" | "Cancelled";
  finalizedAt?: string;
  createdBy?: string;
  discountReason?: string;
  discountApprovedBy?: string;
}

export interface InvoiceItem {
  description: string;
  category: "Consultation" | "Lab" | "Radiology" | "Pharmacy" | "Room" | "Procedure" | "Other" | "OPD" | "IPD";
  quantity: number;
  rate: number;
  amount: number;
  /** IPD link (031+): which admission/charge this line came from. */
  admissionId?: string;
  chargeId?: string;
  discount?: number;
  tax?: number;
}

export interface InvoiceTaxLine {
  name: string;
  percent: number;
  amount: number;
}

export interface MedicineAlert {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNo: string;
  alertType: "expiry" | "expired" | "low_stock" | "out_of_stock";
  severity: "high" | "medium" | "low";
  message: string;
  daysToExpiry?: number | null;
  stock: number;
  threshold: number;
  status: "active" | "acknowledged" | "resolved";
  branch: string;
  createdAt: string;
  resolvedAt?: string | null;
}

export interface Medicine {
  id: string;
  name: string;
  category: string;
  manufacturer: string;
  batchNo: string;
  expiryDate: string;
  stock: number;
  reorderLevel: number;
  price: number;
  /** Tablets per sheet/strip — drives sheet↔tablet price calculation. */
  stripSize?: number;
  /** Price per full sheet/strip. */
  sheetPrice?: number;
  supplier: string;
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Expiring Soon" | "Follow Up";
  branch: string;
}

export interface LabTest {
  id: string;
  orderId: string;
  patientName: string;
  patientId: string;
  test: string;
  category: string;
  orderedBy: string;
  orderedOn: string;
  status: "Ordered" | "Sample Collected" | "Testing" | "Quality Check" | "Approved" | "Rejected" | "Follow Up";
  reportReady: boolean;
  price: number;
  result?: string;
  findings?: string;
  problems?: string;
  branch: string;
}

export interface RadiologyOrder {
  id: string;
  orderId: string;
  patientName: string;
  patientId: string;
  modality: string;
  region: string;
  orderedBy: string;
  orderedOn: string;
  status: "Ordered" | "In Progress" | "Image Captured" | "Report Generated" | "Approved" | "Follow Up";
  price: number;
  findings?: string;
  problems?: string;
  branch: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  title: string;
  notes: string;
  doctor: string;
  recordDate: string;
  branch: string;
  createdBy: string;
}

export interface InsuranceClaim {
  id: string;
  claimNo: string;
  patientName: string;
  patientId: string;
  provider: string;
  policyNo: string;
  claimAmount: number;
  approvedAmount: number;
  date: string;
  status: "Pending" | "Pre-Auth" | "Approved" | "Rejected" | "Settled" | "Follow Up";
  treatment: string;
  branch: string;
  /** Linked billing invoice — approved amounts are applied to it. */
  invoiceId?: string;
  /** Cashless or Reimbursement. */
  type?: "Cashless" | "Reimbursement" | "";
  admissionDate?: string;
  dischargeDate?: string;
  /** Third-party administrator handling the claim. */
  tpaName?: string;
  remarks?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  source: "Website" | "Facebook" | "Google Ads" | "Walk-in" | "Referral" | "Phone Call" | "WhatsApp" | "Email";
  stage: "New Lead" | "Contacted" | "Appointment" | "Visit" | "Treatment" | "Follow-up" | "Review" | "Repeat Patient";
  interest: string;
  estimatedValue: number;
  assignedTo: string;
  createdOn: string;
  lastContact: string;
  branch: string;
}

export type CampaignAudienceKind =
  | "all-patients" | "patient"
  | "all-doctors" | "doctor"
  | "all-staff" | "staff";

export interface Campaign {
  id: string;
  name: string;
  type: "Email" | "SMS" | "WhatsApp" | "Offer" | "Referral";
  status: "Active" | "Scheduled" | "Completed" | "Draft" | "Follow Up";
  audience: number;
  sent: number;
  opened: number;
  clicked: number;
  conversions: number;
  startDate: string;
  branch: string;
  /** Who receives it (structured targeting). */
  audienceKind?: CampaignAudienceKind;
  audienceRefId?: string;
  audienceRefName?: string;
  message?: string;
}

export interface StaffMember {
  id: string;
  staffId: string;
  name: string;
  photo?: string;
  role: Role;
  department: string;
  phone: string;
  email: string;
  password: string;
  mustChangePassword: boolean;
  status: "Active" | "On Leave" | "Inactive" | "Follow Up";
  shift: "Morning" | "Evening" | "Night";
  attendance: number;
  joinDate: string;
  salary: number;
  branch: string;
  branchId: string;
  consultationFee?: number;
  availableDays?: string[];
  availableFrom?: string;
  availableTo?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: "Equipment" | "Consumable" | "Furniture" | "IT";
  stock: number;
  reorderLevel: number;
  unit: string;
  supplier: string;
  price: number;
  location: string;
  lastRestocked: string;
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Follow Up";
  branch: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
  patients: number;
  revenue: number;
  staff: number;
  status: "Active" | "Maintenance";
}

export interface Notification {
  id: string;
  type: "appointment" | "lab"   | "billing"
  | "insurance"
  | "pharmacy" | "system" | "marketing" | "emergency" | "reminder";
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: "high" | "medium" | "low";
  branch: string;
}

/** Hospital expense (money out) — salaries, supplies, utilities, etc. */
export interface Expense {
  id: string;
  title: string;
  category: "Salaries" | "Medicines" | "Supplies" | "Utilities" | "Rent" | "Maintenance" | "Food" | "Transport" | "Marketing" | "Other";
  amount: number;
  date: string;
  paymentMethod: string;
  vendor?: string;
  notes?: string;
  recordedBy: string;
  branch: string;
}

/** Branch department, managed by Admin (Settings → Departments). */
export interface Department {
  id: string;
  name: string;
  branch: string;
  head?: string;
  description?: string;
  isActive: boolean;
}

/** Daily staff attendance row — manual (HR) or kiosk/device punch. */
export interface AttendanceRecord {
  id: string;
  staffId: string;
  staffName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: "Present" | "Absent" | "Leave" | "Half Day" | "Holiday" | "Week Off";
    mode: "Manual" | "Kiosk" | "Device";
    markedBy: string;
    notes?: string;
    branch: string;
    /** WiFi-gate audit (migration 030): device IP + on-network proof. */
    deviceIp?: string;
    networkVerified?: boolean;
  }

// ===== IPD admissions + financial ledger (migrations 031–032) =====

export type AdmissionStatus = "Admitted" | "Discharged" | "Cancelled";
export type AdmissionBillingStatus =
  | "Open" | "Interim Billing" | "Discharge Pending"
  | "Final Bill Generated" | "Payment Pending" | "Paid" | "Closed";

export interface Admission {
  id: string;
  admissionNo: string;
  patientId: string;
  uhid: string;
  patientName: string;
  doctorName: string;
  department: string;
  admissionAt: string;
  expectedDischargeDate: string;
  dischargeAt?: string;
  bedId: string;
  bedNumber: string;
  room: string;
  ward: string;
  bedRate: number;
  status: AdmissionStatus;
  billingStatus: AdmissionBillingStatus;
  payMode: "Self" | "Insurance";
  insuranceProvider: string;
  insurancePolicy: string;
  insuranceAuth: string;
  notes: string;
  branch: string;
  createdBy: string;
}

export type ChargeCategory =
  | "Registration" | "Consultation" | "Bed" | "Nursing" | "Surgery"
  | "Operation Theatre" | "Anesthesia" | "Procedure" | "Pharmacy"
  | "Laboratory" | "Radiology" | "Consumables" | "Supplies"
  | "Doctor" | "Surgeon" | "Assistant" | "Anesthetist" | "Package" | "Other";

export interface AdmissionCharge {
  id: string;
  admissionId: string;
  patientId: string;
  category: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  discount: number;
  tax: number;
  net: number;
  surgeryCaseId?: string;
  invoiceId?: string;
  billed: boolean;
  idempotencyKey?: string;
  occurredAt: string;
  createdBy: string;
  branch: string;
  notes: string;
}

export type PaymentMethod =
  | "Cash" | "UPI" | "Card" | "Bank Transfer" | "Razorpay"
  | "Insurance" | "Cheque" | "Other";

export interface Payment {
  id: string;
  receiptNo: string;
  patientId: string;
  patientName: string;
  admissionId?: string;
  invoiceId?: string;
  amount: number;
  method: string;
  txnRef: string;
  kind: "Payment" | "Advance";
  idempotencyKey?: string;
  receivedBy: string;
  branch: string;
  notes: string;
  occurredAt: string;
}

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
}

export type RefundStatus = "Requested" | "Approved" | "Rejected" | "Processed";

export interface Refund {
  id: string;
  refundNo: string;
  patientId: string;
  patientName: string;
  admissionId?: string;
  invoiceId?: string;
  paymentId?: string;
  amount: number;
  method: string;
  reason: string;
  approvedBy: string;
  processedBy: string;
  status: RefundStatus;
  txnRef: string;
  branch: string;
}

export interface LedgerRow {
  date: string;
  type: "Charge" | "Payment" | "Advance" | "Refund";
  description: string;
  debit: number;
  credit: number;
  balance: number;
  refId: string;
}

export interface CompleteBill {
  admission: Admission;
  charges: AdmissionCharge[];
  payments: Payment[];
  refunds: Refund[];
  invoices: Invoice[];
  categoryTotals: { category: string; amount: number }[];
  gross: number;
  discount: number;
  tax: number;
  advancePaid: number;
  previousPayments: number;
  refundsTotal: number;
  netPayable: number;
  outstanding: number;
  ledger: LedgerRow[];
}

export type SurgeryStatus =
  | "Scheduled" | "Pre-op" | "Ready" | "In OT"
  | "Completed" | "Cancelled" | "Post-op" | "Discharged";

export interface SurgeryCase {
  id: string;
  caseNo: string;
  patientId: string;
  uhid: string;
  patientName: string;
  admissionId?: string;
  bedNumber: string;
  room: string;
  surgeon: string;
  assistantSurgeon: string;
  anesthetist: string;
  department: string;
  surgeryName: string;
  surgeryCategory: string;
  diagnosis: string;
  plannedDate: string;
  plannedTime: string;
  plannedDurationMin: number;
  actualStart?: string;
  actualEnd?: string;
  theatre: string;
  anesthesiaType: string;
  priority: "Elective" | "Emergency" | "Urgent";
  kind: "Elective" | "Emergency";
  status: SurgeryStatus;
  preOpNotes: string;
  postOpNotes: string;
  complications: string;
  consentStatus: "Pending" | "Obtained" | "Waived";
  insuranceAuth: string;
  packageId?: string;
  estimate: number;
  advanceRequired: number;
  branch: string;
  remarks: string;
  createdBy: string;
}

export interface SurgeryCaseCharge {
  id: string;
  caseId: string;
  admissionId?: string;
  label: string;
  category: string;
  amount: number;
  auto: boolean;
  packageId?: string;
  invoiceId?: string;
  billed: boolean;
  createdBy: string;
  branch: string;
}

export interface SurgeryPackage {
  id: string;
  name: string;
  surgeryType: string;
  basePrice: number;
  packageDiscount: number;
  tax: number;
  validityFrom: string;
  validityTo: string;
  branch: string;
  active: boolean;
  createdBy: string;
  items?: SurgeryPackageItem[];
}

export interface SurgeryPackageItem {
  id: string;
  packageId: string;
  label: string;
  category: string;
  quantity: number;
  rate: number;
}

export interface SurgeryConsumable {
  id: string;
  caseId: string;
  admissionId?: string;
  patientId: string;
  item: string;
  batch: string;
  expiry: string;
  quantity: number;
  unitPrice: number;
  total: number;
  medicineId?: string;
  status: "Recorded" | "Issued" | "Deducted" | "Cancelled";
  usedBy: string;
  branch: string;
}
