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
  | "billing"
  | "insurance"
  | "laboratory"
  | "radiology"
  | "pharmacy"
  | "records"
  | "crm"
  | "marketing"
  | "reports"
  | "staff"
  | "inventory"
  | "settings";

export type Role =
  | "Super Admin"
  | "Hospital Admin"
  | "Doctor"
  | "Receptionist"
  | "Nurse"
  | "Pharmacist"
  | "Lab Technician"
  | "Radiologist"
  | "Accountant"
  | "HR"
  | "Marketing"
  | "Patient";

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
  status: "Active" | "Admitted" | "Discharged" | "OPD";
  lastVisit: string;
  registeredOn: string;
  branch: string;
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
  availability: "Available" | "Busy" | "Off Duty" | "On Leave";
  rating: number;
  consultationFee: number;
  todayAppointments: number;
  patientsTreated: number;
  branch: string;
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
  status: "Scheduled" | "Checked-in" | "In Consultation" | "Completed" | "Cancelled" | "No-show";
  reason: string;
  waitingTime: number;
}

export interface Bed {
  id: string;
  number: string;
  ward: "ICU" | "General Ward" | "Private Room" | "Semi Private" | "Emergency" | "Operation Theatre";
  status: "Available" | "Occupied" | "Maintenance" | "Reserved";
  patientName?: string;
  patientId?: string;
  admittedOn?: string;
  dailyRate: number;
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
  total: number;
  paidAmount: number;
  status: "Paid" | "Partial" | "Pending" | "Overdue";
  paymentMethod?: string;
}

export interface InvoiceItem {
  description: string;
  category: "Consultation" | "Lab" | "Radiology" | "Pharmacy" | "Room" | "Procedure" | "Other";
  quantity: number;
  rate: number;
  amount: number;
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
  supplier: string;
  status: "In Stock" | "Low Stock" | "Out of Stock" | "Expiring Soon";
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
  status: "Ordered" | "Sample Collected" | "Testing" | "Quality Check" | "Approved" | "Rejected";
  reportReady: boolean;
  price: number;
  result?: string;
}

export interface RadiologyOrder {
  id: string;
  orderId: string;
  patientName: string;
  patientId: string;
  modality: "X-Ray" | "CT Scan" | "MRI" | "Ultrasound" | "ECG";
  region: string;
  orderedBy: string;
  orderedOn: string;
  status: "Ordered" | "In Progress" | "Image Captured" | "Report Generated" | "Approved";
  price: number;
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
  status: "Pending" | "Pre-Auth" | "Approved" | "Rejected" | "Settled";
  treatment: string;
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
}

export interface Campaign {
  id: string;
  name: string;
  type: "Email" | "SMS" | "WhatsApp" | "Offer" | "Referral";
  status: "Active" | "Scheduled" | "Completed" | "Draft";
  audience: number;
  sent: number;
  opened: number;
  clicked: number;
  conversions: number;
  startDate: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  department: string;
  phone: string;
  email: string;
  status: "Active" | "On Leave" | "Inactive";
  shift: "Morning" | "Evening" | "Night";
  attendance: number;
  joinDate: string;
  salary: number;
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
  status: "In Stock" | "Low Stock" | "Out of Stock";
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
  type: "appointment" | "lab" | "billing" | "insurance" | "pharmacy" | "system" | "marketing";
  title: string;
  message: string;
  time: string;
  read: boolean;
  priority: "high" | "medium" | "low";
}
