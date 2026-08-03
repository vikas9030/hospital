import type {
  Patient,
  TimelineEvent,
  Doctor,
  Appointment,
  Bed,
  Invoice,
  Medicine,
  LabTest,
  RadiologyOrder,
  InsuranceClaim,
  Lead,
  Campaign,
  StaffMember,
  InventoryItem,
  Branch,
  Notification,
} from "./types";

// ===== Branches =====
export const branches: Branch[] = [
  { id: "br1", name: "MediCore Main Campus", location: "MG Road, Bangalore", patients: 12480, revenue: 4820000, staff: 342, status: "Active" },
  { id: "br2", name: "MediCore North Branch", location: "Hebbal, Bangalore", patients: 6240, revenue: 2180000, staff: 178, status: "Active" },
  { id: "br3", name: "MediCore South Branch", location: "JP Nagar, Bangalore", patients: 4890, revenue: 1640000, staff: 142, status: "Active" },
  { id: "br4", name: "MediCore East Branch", location: "Whitefield, Bangalore", patients: 3120, revenue: 980000, staff: 96, status: "Maintenance" },
];

// ===== Patients =====
export const patients: Patient[] = [
  {
    id: "p1", uhid: "MC-2024-0001", name: "Aarav Sharma", photo: "AS",
    gender: "Male", age: 34, phone: "+91 98765 43210", email: "aarav.sharma@email.com",
    bloodGroup: "O+", address: "123, Indiranagar, Bangalore",
    emergencyContact: "+91 98765 11111", insuranceProvider: "Star Health", insurancePolicy: "SH-2024-887421",
    allergies: ["Penicillin"], chronicDiseases: ["Hypertension"],
    status: "Admitted", lastVisit: "2026-08-01", registeredOn: "2024-03-15", branch: "MediCore Main Campus",
  },
  {
    id: "p2", uhid: "MC-2024-0002", name: "Priya Patel", photo: "PP",
    gender: "Female", age: 28, phone: "+91 98765 43211", email: "priya.patel@email.com",
    bloodGroup: "A+", address: "456, Koramangala, Bangalore",
    emergencyContact: "+91 98765 22222", insuranceProvider: "HDFC ERGO", insurancePolicy: "HE-2024-556231",
    allergies: [], chronicDiseases: [],
    status: "OPD", lastVisit: "2026-08-02", registeredOn: "2024-06-22", branch: "MediCore Main Campus",
  },
  {
    id: "p3", uhid: "MC-2024-0003", name: "Rohan Mehta", photo: "RM",
    gender: "Male", age: 45, phone: "+91 98765 43212", email: "rohan.mehta@email.com",
    bloodGroup: "B+", address: "789, Jayanagar, Bangalore",
    emergencyContact: "+91 98765 33333", insuranceProvider: "ICICI Lombard", insurancePolicy: "IL-2024-334567",
    allergies: ["Sulfa Drugs"], chronicDiseases: ["Diabetes Type 2", "Hypertension"],
    status: "Active", lastVisit: "2026-07-30", registeredOn: "2023-11-08", branch: "MediCore Main Campus",
  },
  {
    id: "p4", uhid: "MC-2024-0004", name: "Ananya Reddy", photo: "AR",
    gender: "Female", age: 52, phone: "+91 98765 43213", email: "ananya.reddy@email.com",
    bloodGroup: "AB+", address: "321, HSR Layout, Bangalore",
    emergencyContact: "+91 98765 44444", insuranceProvider: "Star Health", insurancePolicy: "SH-2024-998123",
    allergies: ["Peanuts"], chronicDiseases: ["Hypothyroidism"],
    status: "Discharged", lastVisit: "2026-07-28", registeredOn: "2024-01-12", branch: "MediCore North Branch",
  },
  {
    id: "p5", uhid: "MC-2024-0005", name: "Vikram Singh", photo: "VS",
    gender: "Male", age: 67, phone: "+91 98765 43214", email: "vikram.singh@email.com",
    bloodGroup: "O-", address: "654, Whitefield, Bangalore",
    emergencyContact: "+91 98765 55555", insuranceProvider: "Bajaj Allianz", insurancePolicy: "BA-2024-112345",
    allergies: [], chronicDiseases: ["Coronary Artery Disease", "Diabetes"],
    status: "Admitted", lastVisit: "2026-08-03", registeredOn: "2023-08-19", branch: "MediCore Main Campus",
  },
  {
    id: "p6", uhid: "MC-2024-0006", name: "Sneha Iyer", photo: "SI",
    gender: "Female", age: 31, phone: "+91 98765 43215", email: "sneha.iyer@email.com",
    bloodGroup: "A-", address: "987, Marathahalli, Bangalore",
    emergencyContact: "+91 98765 66666", insuranceProvider: "Self Pay", insurancePolicy: "-",
    allergies: ["Latex"], chronicDiseases: [],
    status: "OPD", lastVisit: "2026-08-03", registeredOn: "2024-09-03", branch: "MediCore South Branch",
  },
  {
    id: "p7", uhid: "MC-2024-0007", name: "Arjun Nair", photo: "AN",
    gender: "Male", age: 39, phone: "+91 98765 43216", email: "arjun.nair@email.com",
    bloodGroup: "B-", address: "147, Electronic City, Bangalore",
    emergencyContact: "+91 98765 77777", insuranceProvider: "Tata AIG", insurancePolicy: "TA-2024-445678",
    allergies: [], chronicDiseases: ["Asthma"],
    status: "Active", lastVisit: "2026-08-01", registeredOn: "2024-04-25", branch: "MediCore Main Campus",
  },
  {
    id: "p8", uhid: "MC-2024-0008", name: "Kavya Gowda", photo: "KG",
    gender: "Female", age: 24, phone: "+91 98765 43217", email: "kavya.gowda@email.com",
    bloodGroup: "O+", address: "258, BTM Layout, Bangalore",
    emergencyContact: "+91 98765 88888", insuranceProvider: "Star Health", insurancePolicy: "SH-2024-667890",
    allergies: ["Aspirin"], chronicDiseases: [],
    status: "OPD", lastVisit: "2026-08-02", registeredOn: "2025-02-14", branch: "MediCore North Branch",
  },
];

// ===== Patient Timeline (for p1 - Aarav Sharma) =====
export const patientTimeline: TimelineEvent[] = [
  { id: "t1", type: "followup", title: "Follow-up Scheduled", description: "Post-discharge follow-up in 7 days", timestamp: "2026-08-10 10:00", status: "pending" },
  { id: "t2", type: "payment", title: "Payment Received", description: "₹45,200 paid via UPI", timestamp: "2026-08-03 14:30", status: "completed", amount: 45200 },
  { id: "t3", type: "billing", title: "Invoice Generated", description: "Invoice INV-2024-0156 - Consolidated bill", timestamp: "2026-08-03 14:15", status: "completed", amount: 52800 },
  { id: "t4", type: "radiology", title: "Chest X-Ray Completed", description: "Report approved by Dr. Mehta", timestamp: "2026-08-03 12:45", status: "completed", amount: 800 },
  { id: "t5", type: "lab", title: "Blood Test Results Ready", description: "CBC, Lipid Profile, Blood Sugar", timestamp: "2026-08-03 11:20", status: "completed", amount: 1500 },
  { id: "t6", type: "prescription", title: "Prescription Generated", description: "Prescribed by Dr. Rajesh Kumar", timestamp: "2026-08-03 10:30", status: "completed", doctor: "Dr. Rajesh Kumar" },
  { id: "t7", type: "consultation", title: "Doctor Consultation", description: "Cardiology consultation - Chest pain evaluation", timestamp: "2026-08-03 10:00", status: "completed", doctor: "Dr. Rajesh Kumar" },
  { id: "t8", type: "appointment", title: "Appointment Checked-in", description: "Token #A-012, Reception", timestamp: "2026-08-03 09:30", status: "completed" },
];

// ===== Doctors =====
export const doctors: Doctor[] = [
  {
    id: "d1", name: "Dr. Rajesh Kumar", photo: "RK", specialization: "Cardiologist", department: "Cardiology",
    experience: 18, qualification: "MD, DM (Cardiology)", phone: "+91 99887 76655", email: "rajesh.kumar@medicore.com",
    availability: "Available", rating: 4.9, consultationFee: 1200, todayAppointments: 12, patientsTreated: 3420, branch: "MediCore Main Campus",
  },
  {
    id: "d2", name: "Dr. Sunita Menon", photo: "SM", specialization: "Neurologist", department: "Neurology",
    experience: 15, qualification: "MD, DM (Neurology)", phone: "+91 99887 76656", email: "sunita.menon@medicore.com",
    availability: "Busy", rating: 4.8, consultationFee: 1500, todayAppointments: 8, patientsTreated: 2180, branch: "MediCore Main Campus",
  },
  {
    id: "d3", name: "Dr. Aakash Verma", photo: "AV", specialization: "Orthopedic Surgeon", department: "Orthopedics",
    experience: 12, qualification: "MS (Ortho)", phone: "+91 99887 76657", email: "aakash.verma@medicore.com",
    availability: "Available", rating: 4.7, consultationFee: 1000, todayAppointments: 6, patientsTreated: 1560, branch: "MediCore Main Campus",
  },
  {
    id: "d4", name: "Dr. Meera Joshi", photo: "MJ", specialization: "Gynecologist", department: "Obstetrics & Gynecology",
    experience: 14, qualification: "MS (OBG)", phone: "+91 99887 76658", email: "meera.joshi@medicore.com",
    availability: "On Leave", rating: 4.9, consultationFee: 900, todayAppointments: 0, patientsTreated: 2890, branch: "MediCore Main Campus",
  },
  {
    id: "d5", name: "Dr. Karthik Rao", photo: "KR", specialization: "Pediatrician", department: "Pediatrics",
    experience: 10, qualification: "MD (Pediatrics)", phone: "+91 99887 76659", email: "karthik.rao@medicore.com",
    availability: "Available", rating: 4.8, consultationFee: 800, todayAppointments: 15, patientsTreated: 3120, branch: "MediCore Main Campus",
  },
  {
    id: "d6", name: "Dr. Neha Gupta", photo: "NG", specialization: "Dermatologist", department: "Dermatology",
    experience: 9, qualification: "MD (Dermatology)", phone: "+91 99887 76660", email: "neha.gupta@medicore.com",
    availability: "Off Duty", rating: 4.6, consultationFee: 700, todayAppointments: 0, patientsTreated: 980, branch: "MediCore North Branch",
  },
];

// ===== Appointments =====
export const appointments: Appointment[] = [
  { id: "a1", token: "A-001", patientId: "p2", patientName: "Priya Patel", patientPhoto: "PP", doctorId: "d1", doctorName: "Dr. Rajesh Kumar", department: "Cardiology", date: "2026-08-03", time: "09:00", type: "Online", status: "Completed", reason: "Routine cardiac checkup", waitingTime: 5 },
  { id: "a2", token: "A-002", patientId: "p1", patientName: "Aarav Sharma", patientPhoto: "AS", doctorId: "d1", doctorName: "Dr. Rajesh Kumar", department: "Cardiology", date: "2026-08-03", time: "09:30", type: "Walk-in", status: "Completed", reason: "Chest pain & palpitations", waitingTime: 12 },
  { id: "a3", token: "A-003", patientId: "p3", patientName: "Rohan Mehta", patientPhoto: "RM", doctorId: "d3", doctorName: "Dr. Aakash Verma", department: "Orthopedics", date: "2026-08-03", time: "10:00", type: "Walk-in", status: "In Consultation", reason: "Knee pain follow-up", waitingTime: 0 },
  { id: "a4", token: "A-004", patientId: "p7", patientName: "Arjun Nair", patientPhoto: "AN", doctorId: "d5", doctorName: "Dr. Karthik Rao", department: "Pediatrics", date: "2026-08-03", time: "10:30", type: "Referral", status: "Checked-in", reason: "Child - fever", waitingTime: 8 },
  { id: "a5", token: "A-005", patientId: "p8", patientName: "Kavya Gowda", patientPhoto: "KG", doctorId: "d6", doctorName: "Dr. Neha Gupta", department: "Dermatology", date: "2026-08-03", time: "11:00", type: "Online", status: "Scheduled", reason: "Skin rash", waitingTime: 0 },
  { id: "a6", token: "A-006", patientId: "p5", patientName: "Vikram Singh", patientPhoto: "VS", doctorId: "d1", doctorName: "Dr. Rajesh Kumar", department: "Cardiology", date: "2026-08-03", time: "11:30", type: "Emergency", status: "Scheduled", reason: "Severe chest pain", waitingTime: 0 },
  { id: "a7", token: "A-007", patientId: "p6", patientName: "Sneha Iyer", patientPhoto: "SI", doctorId: "d2", doctorName: "Dr. Sunita Menon", department: "Neurology", date: "2026-08-03", time: "12:00", type: "Walk-in", status: "Scheduled", reason: "Migraine", waitingTime: 0 },
  { id: "a8", token: "A-008", patientId: "p4", patientName: "Ananya Reddy", patientPhoto: "AR", doctorId: "d3", doctorName: "Dr. Aakash Verma", department: "Orthopedics", date: "2026-08-03", time: "14:00", type: "Walk-in", status: "Scheduled", reason: "Back pain", waitingTime: 0 },
];

// ===== Beds =====
export const beds: Bed[] = [
  // ICU
  { id: "b1", number: "ICU-01", ward: "ICU", status: "Occupied", patientName: "Aarav Sharma", patientId: "p1", admittedOn: "2026-08-01", dailyRate: 8500 },
  { id: "b2", number: "ICU-02", ward: "ICU", status: "Occupied", patientName: "Vikram Singh", patientId: "p5", admittedOn: "2026-08-03", dailyRate: 8500 },
  { id: "b3", number: "ICU-03", ward: "ICU", status: "Available", dailyRate: 8500 },
  { id: "b4", number: "ICU-04", ward: "ICU", status: "Maintenance", dailyRate: 8500 },
  // General Ward
  { id: "b5", number: "GW-01", ward: "General Ward", status: "Occupied", patientName: "Ramesh K", patientId: "p9", admittedOn: "2026-07-30", dailyRate: 2500 },
  { id: "b6", number: "GW-02", ward: "General Ward", status: "Available", dailyRate: 2500 },
  { id: "b7", number: "GW-03", ward: "General Ward", status: "Occupied", patientName: "Lakshmi P", patientId: "p10", admittedOn: "2026-08-02", dailyRate: 2500 },
  { id: "b8", number: "GW-04", ward: "General Ward", status: "Available", dailyRate: 2500 },
  { id: "b9", number: "GW-05", ward: "General Ward", status: "Reserved", dailyRate: 2500 },
  // Private Room
  { id: "b10", number: "PR-01", ward: "Private Room", status: "Occupied", patientName: "Ananya Reddy", patientId: "p4", admittedOn: "2026-07-28", dailyRate: 5500 },
  { id: "b11", number: "PR-02", ward: "Private Room", status: "Available", dailyRate: 5500 },
  { id: "b12", number: "PR-03", ward: "Private Room", status: "Available", dailyRate: 5500 },
  // Semi Private
  { id: "b13", number: "SP-01", ward: "Semi Private", status: "Occupied", patientName: "Suresh M", patientId: "p11", admittedOn: "2026-08-01", dailyRate: 3500 },
  { id: "b14", number: "SP-02", ward: "Semi Private", status: "Available", dailyRate: 3500 },
  { id: "b15", number: "SP-03", ward: "Semi Private", status: "Occupied", patientName: "Geeta R", patientId: "p12", admittedOn: "2026-08-02", dailyRate: 3500 },
  // Emergency
  { id: "b16", number: "ER-01", ward: "Emergency", status: "Occupied", patientName: "Emergency Case", patientId: "p13", admittedOn: "2026-08-03", dailyRate: 4500 },
  { id: "b17", number: "ER-02", ward: "Emergency", status: "Available", dailyRate: 4500 },
  // Operation Theatre
  { id: "b18", number: "OT-01", ward: "Operation Theatre", status: "Available", dailyRate: 15000 },
  { id: "b19", number: "OT-02", ward: "Operation Theatre", status: "Reserved", dailyRate: 15000 },
];

// ===== Invoices =====
export const invoices: Invoice[] = [
  {
    id: "inv1", invoiceNo: "INV-2026-0156", patientId: "p1", patientName: "Aarav Sharma", date: "2026-08-03", dueDate: "2026-08-10",
    items: [
      { description: "Cardiology Consultation", category: "Consultation", quantity: 1, rate: 1200, amount: 1200 },
      { description: "ICU Bed (2 days)", category: "Room", quantity: 2, rate: 8500, amount: 17000 },
      { description: "CBC Blood Test", category: "Lab", quantity: 1, rate: 800, amount: 800 },
      { description: "Lipid Profile", category: "Lab", quantity: 1, rate: 700, amount: 700 },
      { description: "Chest X-Ray", category: "Radiology", quantity: 1, rate: 800, amount: 800 },
      { description: "Medicines (Cardiac)", category: "Pharmacy", quantity: 1, rate: 2400, amount: 2400 },
      { description: "ECG Procedure", category: "Procedure", quantity: 1, rate: 500, amount: 500 },
    ],
    subtotal: 23400, tax: 1170, discount: 0, total: 24570, paidAmount: 24570, status: "Paid", paymentMethod: "UPI",
  },
  {
    id: "inv2", invoiceNo: "INV-2026-0157", patientId: "p3", patientName: "Rohan Mehta", date: "2026-08-03", dueDate: "2026-08-17",
    items: [
      { description: "Orthopedic Consultation", category: "Consultation", quantity: 1, rate: 1000, amount: 1000 },
      { description: "MRI Knee", category: "Radiology", quantity: 1, rate: 4500, amount: 4500 },
      { description: "Pain Medication", category: "Pharmacy", quantity: 1, rate: 650, amount: 650 },
    ],
    subtotal: 6150, tax: 307, discount: 200, total: 6257, paidAmount: 3000, status: "Partial", paymentMethod: "Cash",
  },
  {
    id: "inv3", invoiceNo: "INV-2026-0158", patientId: "p5", patientName: "Vikram Singh", date: "2026-08-03", dueDate: "2026-08-10",
    items: [
      { description: "Emergency Cardiac Consultation", category: "Consultation", quantity: 1, rate: 1500, amount: 1500 },
      { description: "ICU Bed (1 day)", category: "Room", quantity: 1, rate: 8500, amount: 8500 },
      { description: "Troponin Test", category: "Lab", quantity: 1, rate: 1200, amount: 1200 },
      { description: "Angiogram", category: "Procedure", quantity: 1, rate: 18000, amount: 18000 },
    ],
    subtotal: 29200, tax: 1460, discount: 0, total: 30660, paidAmount: 0, status: "Pending",
  },
  {
    id: "inv4", invoiceNo: "INV-2026-0155", patientId: "p2", patientName: "Priya Patel", date: "2026-08-02", dueDate: "2026-08-09",
    items: [
      { description: "Cardiology Consultation", category: "Consultation", quantity: 1, rate: 1200, amount: 1200 },
      { description: "ECG", category: "Procedure", quantity: 1, rate: 500, amount: 500 },
    ],
    subtotal: 1700, tax: 85, discount: 0, total: 1785, paidAmount: 1785, status: "Paid", paymentMethod: "Card",
  },
  {
    id: "inv5", invoiceNo: "INV-2026-0152", patientId: "p4", patientName: "Ananya Reddy", date: "2026-07-28", dueDate: "2026-08-04",
    items: [
      { description: "Private Room (4 days)", category: "Room", quantity: 4, rate: 5500, amount: 22000 },
      { description: "Thyroid Panel", category: "Lab", quantity: 1, rate: 1500, amount: 1500 },
      { description: "Medicines", category: "Pharmacy", quantity: 1, rate: 3200, amount: 3200 },
    ],
    subtotal: 26700, tax: 1335, discount: 1000, total: 27035, paidAmount: 27035, status: "Paid", paymentMethod: "Insurance",
  },
];

// ===== Medicines (Pharmacy) =====
export const medicines: Medicine[] = [
  { id: "m1", name: "Crocin 650mg", category: "Analgesic", manufacturer: "GSK", batchNo: "CRO2401", expiryDate: "2026-12-31", stock: 1250, reorderLevel: 200, price: 2.5, supplier: "MediSource Pvt Ltd", status: "In Stock" },
  { id: "m2", name: "Azithromycin 500mg", category: "Antibiotic", manufacturer: "Pfizer", batchNo: "AZI2403", expiryDate: "2026-09-30", stock: 85, reorderLevel: 100, price: 12, supplier: "Pharma Distributors", status: "Low Stock" },
  { id: "m3", name: "Insulin Glargine", category: "Hormone", manufacturer: "Sanofi", batchNo: "INS2402", expiryDate: "2026-08-15", stock: 45, reorderLevel: 50, price: 480, supplier: "MediSource Pvt Ltd", status: "Expiring Soon" },
  { id: "m4", name: "Atorvastatin 10mg", category: "Statin", manufacturer: "Sun Pharma", batchNo: "ATO2404", expiryDate: "2027-03-31", stock: 680, reorderLevel: 150, price: 4.5, supplier: "Pharma Distributors", status: "In Stock" },
  { id: "m5", name: "Metformin 500mg", category: "Antidiabetic", manufacturer: "Cipla", batchNo: "MET2405", expiryDate: "2026-11-30", stock: 920, reorderLevel: 200, price: 3.2, supplier: "MediSource Pvt Ltd", status: "In Stock" },
  { id: "m6", name: "Omeprazole 20mg", category: "PPI", manufacturer: "Dr. Reddy's", batchNo: "OME2406", expiryDate: "2027-01-31", stock: 0, reorderLevel: 100, price: 5.5, supplier: "Pharma Distributors", status: "Out of Stock" },
  { id: "m7", name: "Amoxicillin 250mg", category: "Antibiotic", manufacturer: "Hetero", batchNo: "AMO2407", expiryDate: "2026-10-31", stock: 450, reorderLevel: 100, price: 4.2, supplier: "MediSource Pvt Ltd", status: "In Stock" },
  { id: "m8", name: "Pantoprazole 40mg", category: "PPI", manufacturer: "Alkem", batchNo: "PAN2408", expiryDate: "2027-02-28", stock: 320, reorderLevel: 150, price: 6.8, supplier: "Pharma Distributors", status: "In Stock" },
];

// ===== Lab Tests =====
export const labTests: LabTest[] = [
  { id: "lt1", orderId: "LAB-2401", patientName: "Aarav Sharma", patientId: "p1", test: "Complete Blood Count (CBC)", category: "Hematology", orderedBy: "Dr. Rajesh Kumar", orderedOn: "2026-08-03 09:45", status: "Approved", reportReady: true, price: 800, result: "WBC: 7.2, RBC: 4.8, Hb: 14.2, Platelets: 240" },
  { id: "lt2", orderId: "LAB-2402", patientName: "Aarav Sharma", patientId: "p1", test: "Lipid Profile", category: "Biochemistry", orderedBy: "Dr. Rajesh Kumar", orderedOn: "2026-08-03 09:45", status: "Approved", reportReady: true, price: 700, result: "Total Cholesterol: 210, LDL: 140, HDL: 45" },
  { id: "lt3", orderId: "LAB-2403", patientName: "Rohan Mehta", patientId: "p3", test: "HbA1c", category: "Biochemistry", orderedBy: "Dr. Aakash Verma", orderedOn: "2026-08-03 10:15", status: "Quality Check", reportReady: false, price: 600 },
  { id: "lt4", orderId: "LAB-2404", patientName: "Vikram Singh", patientId: "p5", test: "Troponin I", category: "Cardiac", orderedBy: "Dr. Rajesh Kumar", orderedOn: "2026-08-03 11:30", status: "Testing", reportReady: false, price: 1200 },
  { id: "lt5", orderId: "LAB-2405", patientName: "Ananya Reddy", patientId: "p4", test: "Thyroid Panel (T3, T4, TSH)", category: "Biochemistry", orderedBy: "Dr. Meera Joshi", orderedOn: "2026-07-28 14:00", status: "Approved", reportReady: true, price: 1500, result: "TSH: 8.4 (High), T3: Normal, T4: Normal" },
  { id: "lt6", orderId: "LAB-2406", patientName: "Sneha Iyer", patientId: "p6", test: "Vitamin D", category: "Biochemistry", orderedBy: "Dr. Sunita Menon", orderedOn: "2026-08-03 12:10", status: "Sample Collected", reportReady: false, price: 900 },
  { id: "lt7", orderId: "LAB-2407", patientName: "Kavya Gowda", patientId: "p8", test: "Allergy Panel", category: "Immunology", orderedBy: "Dr. Neha Gupta", orderedOn: "2026-08-03 09:00", status: "Ordered", reportReady: false, price: 2200 },
];

// ===== Radiology Orders =====
export const radiologyOrders: RadiologyOrder[] = [
  { id: "ro1", orderId: "RAD-2401", patientName: "Aarav Sharma", patientId: "p1", modality: "X-Ray", region: "Chest PA View", orderedBy: "Dr. Rajesh Kumar", orderedOn: "2026-08-03 10:00", status: "Approved", price: 800 },
  { id: "ro2", orderId: "RAD-2402", patientName: "Rohan Mehta", patientId: "p3", modality: "MRI", region: "Knee Joint Left", orderedBy: "Dr. Aakash Verma", orderedOn: "2026-08-03 10:30", status: "In Progress", price: 4500 },
  { id: "ro3", orderId: "RAD-2403", patientName: "Vikram Singh", patientId: "p5", modality: "CT Scan", region: "Brain (Contrast)", orderedBy: "Dr. Rajesh Kumar", orderedOn: "2026-08-03 11:45", status: "Image Captured", price: 6800 },
  { id: "ro4", orderId: "RAD-2404", patientName: "Ananya Reddy", patientId: "p4", modality: "Ultrasound", region: "Thyroid", orderedBy: "Dr. Meera Joshi", orderedOn: "2026-07-28 14:15", status: "Report Generated", price: 1500 },
  { id: "ro5", orderId: "RAD-2405", patientName: "Sneha Iyer", patientId: "p6", modality: "ECG", region: "12-Lead", orderedBy: "Dr. Sunita Menon", orderedOn: "2026-08-03 12:05", status: "Ordered", price: 500 },
  { id: "ro6", orderId: "RAD-2406", patientName: "Arjun Nair", patientId: "p7", modality: "X-Ray", region: "Chest PA", orderedBy: "Dr. Karthik Rao", orderedOn: "2026-08-03 10:45", status: "Report Generated", price: 800 },
];

// ===== Insurance Claims =====
export const insuranceClaims: InsuranceClaim[] = [
  { id: "ic1", claimNo: "CLM-2026-0421", patientName: "Aarav Sharma", patientId: "p1", provider: "Star Health", policyNo: "SH-2024-887421", claimAmount: 24570, approvedAmount: 22000, date: "2026-08-03", status: "Settled", treatment: "Cardiac Evaluation & ICU" },
  { id: "ic2", claimNo: "CLM-2026-0422", patientName: "Vikram Singh", patientId: "p5", provider: "Bajaj Allianz", policyNo: "BA-2024-112345", claimAmount: 30660, approvedAmount: 0, date: "2026-08-03", status: "Pre-Auth", treatment: "Emergency Angiogram" },
  { id: "ic3", claimNo: "CLM-2026-0423", patientName: "Ananya Reddy", patientId: "p4", provider: "Star Health", policyNo: "SH-2024-998123", claimAmount: 27035, approvedAmount: 25000, date: "2026-07-28", status: "Approved", treatment: "Thyroid Treatment" },
  { id: "ic4", claimNo: "CLM-2026-0420", patientName: "Rohan Mehta", patientId: "p3", provider: "ICICI Lombard", policyNo: "IL-2024-334567", claimAmount: 6257, approvedAmount: 0, date: "2026-08-03", status: "Pending", treatment: "Orthopedic Consultation & MRI" },
  { id: "ic5", claimNo: "CLM-2026-0418", patientName: "Priya Patel", patientId: "p2", provider: "HDFC ERGO", policyNo: "HE-2024-556231", claimAmount: 1785, approvedAmount: 0, date: "2026-08-02", status: "Rejected", treatment: "Routine Checkup" },
];

// ===== CRM Leads =====
export const leads: Lead[] = [
  { id: "l1", name: "Ritu Agarwal", phone: "+91 90011 22334", email: "ritu.agarwal@email.com", source: "Google Ads", stage: "New Lead", interest: "Health Checkup Package", estimatedValue: 8000, assignedTo: "Marketing Team", createdOn: "2026-08-02", lastContact: "2026-08-02" },
  { id: "l2", name: "Sanjay Kulkarni", phone: "+91 90011 22335", email: "sanjay.k@email.com", source: "Website", stage: "Contacted", interest: "Cardiology Consultation", estimatedValue: 1500, assignedTo: "Reception", createdOn: "2026-08-01", lastContact: "2026-08-02" },
  { id: "l3", name: "Deepa Rao", phone: "+91 90011 22336", email: "deepa.rao@email.com", source: "Facebook", stage: "Appointment", interest: "Gynecology", estimatedValue: 1200, assignedTo: "Reception", createdOn: "2026-08-01", lastContact: "2026-08-02" },
  { id: "l4", name: "Manish Tiwari", phone: "+91 90011 22337", email: "manish.t@email.com", source: "Referral", stage: "Visit", interest: "Orthopedic Surgery", estimatedValue: 45000, assignedTo: "Dr. Verma Team", createdOn: "2026-07-30", lastContact: "2026-08-01" },
  { id: "l5", name: "Pooja Desai", phone: "+91 90011 22338", email: "pooja.d@email.com", source: "WhatsApp", stage: "Treatment", interest: "Dermatology Package", estimatedValue: 12000, assignedTo: "Dr. Gupta Team", createdOn: "2026-07-28", lastContact: "2026-08-01" },
  { id: "l6", name: "Ashok Pillai", phone: "+91 90011 22339", email: "ashok.p@email.com", source: "Phone Call", stage: "Follow-up", interest: "Diabetes Management", estimatedValue: 6500, assignedTo: "Marketing Team", createdOn: "2026-07-25", lastContact: "2026-08-02" },
  { id: "l7", name: "Nisha Bhatt", phone: "+91 90011 22340", email: "nisha.b@email.com", source: "Walk-in", stage: "Review", interest: "Maternity Package", estimatedValue: 35000, assignedTo: "Dr. Joshi Team", createdOn: "2026-07-20", lastContact: "2026-08-01" },
  { id: "l8", name: "Gaurav Saxena", phone: "+91 90011 22341", email: "gaurav.s@email.com", source: "Email", stage: "Repeat Patient", interest: "Annual Health Check", estimatedValue: 5000, assignedTo: "Marketing Team", createdOn: "2026-07-15", lastContact: "2026-08-02" },
];

// ===== Campaigns =====
export const campaigns: Campaign[] = [
  { id: "c1", name: "Monsoon Health Checkup Drive", type: "Email", status: "Active", audience: 8500, sent: 8500, opened: 4250, clicked: 1275, conversions: 142, startDate: "2026-08-01" },
  { id: "c2", name: "Diabetes Awareness Camp", type: "SMS", status: "Active", audience: 3200, sent: 3200, opened: 2880, clicked: 864, conversions: 96, startDate: "2026-07-28" },
  { id: "c3", name: "Patient Birthday Wishes", type: "WhatsApp", status: "Active", audience: 1250, sent: 1180, opened: 945, clicked: 380, conversions: 65, startDate: "2026-07-15" },
  { id: "c4", name: "Cardiac Care Package Offer", type: "Offer", status: "Scheduled", audience: 2100, sent: 0, opened: 0, clicked: 0, conversions: 0, startDate: "2026-08-10" },
  { id: "c5", name: "Referral Reward Program", type: "Referral", status: "Active", audience: 5600, sent: 5600, opened: 3920, clicked: 1568, conversions: 234, startDate: "2026-07-01" },
  { id: "c6", name: "Women's Health Webinar", type: "Email", status: "Completed", audience: 4200, sent: 4200, opened: 2520, clicked: 840, conversions: 168, startDate: "2026-07-10" },
];

// ===== Staff =====
export const staffMembers: StaffMember[] = [
  { id: "s1", name: "Dr. Rajesh Kumar", role: "Doctor", department: "Cardiology", phone: "+91 99887 76655", email: "rajesh.kumar@medicore.com", status: "Active", shift: "Morning", attendance: 98, joinDate: "2018-06-15", salary: 250000 },
  { id: "s2", name: "Nurse Lakshmi Nair", role: "Nurse", department: "ICU", phone: "+91 99887 76660", email: "lakshmi.n@medicore.com", status: "Active", shift: "Morning", attendance: 96, joinDate: "2020-03-20", salary: 45000 },
  { id: "s3", name: "Receptionist Anita Kumar", role: "Receptionist", department: "Front Office", phone: "+91 99887 76661", email: "anita.k@medicore.com", status: "Active", shift: "Morning", attendance: 99, joinDate: "2021-07-10", salary: 32000 },
  { id: "s4", name: "Pharmacist Raj Patel", role: "Pharmacist", department: "Pharmacy", phone: "+91 99887 76662", email: "raj.p@medicore.com", status: "On Leave", shift: "Evening", attendance: 92, joinDate: "2019-11-05", salary: 55000 },
  { id: "s5", name: "Lab Tech Suresh Kumar", role: "Lab Technician", department: "Laboratory", phone: "+91 99887 76663", email: "suresh.k@medicore.com", status: "Active", shift: "Morning", attendance: 97, joinDate: "2022-01-15", salary: 42000 },
  { id: "s6", name: "Dr. Sunita Menon", role: "Doctor", department: "Neurology", phone: "+91 99887 76656", email: "sunita.m@medicore.com", status: "Active", shift: "Morning", attendance: 95, joinDate: "2019-08-22", salary: 220000 },
  { id: "s7", name: "Accountant Manoj Gupta", role: "Accountant", department: "Finance", phone: "+91 99887 76664", email: "manoj.g@medicore.com", status: "Active", shift: "Morning", attendance: 98, joinDate: "2017-04-12", salary: 65000 },
  { id: "s8", name: "HR Priya Shetty", role: "HR", department: "Human Resources", phone: "+91 99887 76665", email: "priya.s@medicore.com", status: "Active", shift: "Morning", attendance: 99, joinDate: "2018-09-30", salary: 58000 },
];

// ===== Inventory =====
export const inventoryItems: InventoryItem[] = [
  { id: "i1", name: "Patient Monitor (Philips)", category: "Equipment", stock: 12, reorderLevel: 5, unit: "units", supplier: "Philips Healthcare", price: 85000, location: "ICU Storage", lastRestocked: "2026-07-15", status: "In Stock" },
  { id: "i2", name: "Surgical Gloves (Medium)", category: "Consumable", stock: 85, reorderLevel: 200, unit: "boxes", supplier: "MediSource Pvt Ltd", price: 450, location: "Central Store", lastRestocked: "2026-07-28", status: "Low Stock" },
  { id: "i3", name: "Syringes 5ml", category: "Consumable", stock: 1250, reorderLevel: 300, unit: "units", supplier: "MediSource Pvt Ltd", price: 3.5, location: "Central Store", lastRestocked: "2026-08-01", status: "In Stock" },
  { id: "i4", name: "IV Stand", category: "Furniture", stock: 45, reorderLevel: 20, unit: "units", supplier: "Hospital Furniture Co", price: 2200, location: "Ward Storage", lastRestocked: "2026-06-20", status: "In Stock" },
  { id: "i5", name: "ECG Machine Paper", category: "Consumable", stock: 0, reorderLevel: 50, unit: "rolls", supplier: "MediSource Pvt Ltd", price: 120, location: "Radiology Dept", lastRestocked: "2026-06-10", status: "Out of Stock" },
  { id: "i6", name: "Hospital Beds (Electric)", category: "Furniture", stock: 28, reorderLevel: 10, unit: "units", supplier: "Hospital Furniture Co", price: 35000, location: "Ward Storage", lastRestocked: "2026-05-15", status: "In Stock" },
  { id: "i7", name: "Desktop Computer", category: "IT", stock: 65, reorderLevel: 15, unit: "units", supplier: "Dell India", price: 45000, location: "IT Storage", lastRestocked: "2026-07-05", status: "In Stock" },
  { id: "i8", name: "Oxygen Masks", category: "Consumable", stock: 180, reorderLevel: 100, unit: "units", supplier: "MediSource Pvt Ltd", price: 85, location: "Central Store", lastRestocked: "2026-07-25", status: "In Stock" },
];

// ===== Notifications =====
export const notifications: Notification[] = [
  { id: "n1", type: "emergency", title: "Emergency Admission", message: "Vikram Singh - Severe chest pain, ICU-02", time: "2 min ago", read: false, priority: "high" },
  { id: "n2", type: "lab", title: "Lab Report Ready", message: "Aarav Sharma - CBC results approved", time: "15 min ago", read: false, priority: "medium" },
  { id: "n3", type: "billing", title: "Pending Payment", message: "Rohan Mehta - ₹3,257 due on INV-0157", time: "1 hour ago", read: false, priority: "high" },
  { id: "n4", type: "insurance", title: "Insurance Approved", message: "Ananya Reddy - ₹25,000 approved by Star Health", time: "2 hours ago", read: true, priority: "medium" },
  { id: "n5", type: "appointment", title: "Appointment Reminder", message: "5 appointments scheduled in next hour", time: "3 hours ago", read: true, priority: "low" },
  { id: "n6", type: "pharmacy", title: "Low Stock Alert", message: "Azithromycin 500mg below reorder level", time: "4 hours ago", read: false, priority: "high" },
];

// ===== Chart Data =====
export const revenueTrendData = [
  { month: "Jan", revenue: 2850000, opd: 1850000, ipd: 1000000 },
  { month: "Feb", revenue: 3120000, opd: 2010000, ipd: 1110000 },
  { month: "Mar", revenue: 3480000, opd: 2240000, ipd: 1240000 },
  { month: "Apr", revenue: 3210000, opd: 2080000, ipd: 1130000 },
  { month: "May", revenue: 3850000, opd: 2480000, ipd: 1370000 },
  { month: "Jun", revenue: 4120000, opd: 2650000, ipd: 1470000 },
  { month: "Jul", revenue: 4380000, opd: 2810000, ipd: 1570000 },
  { month: "Aug", revenue: 4820000, opd: 2980000, ipd: 1840000 },
];

export const patientGrowthData = [
  { month: "Jan", new: 420, total: 8420 },
  { month: "Feb", new: 480, total: 8900 },
  { month: "Mar", new: 520, total: 9420 },
  { month: "Apr", new: 450, total: 9870 },
  { month: "May", new: 580, total: 10450 },
  { month: "Jun", new: 610, total: 11060 },
  { month: "Jul", new: 645, total: 11705 },
  { month: "Aug", new: 775, total: 12480 },
];

export const departmentPerformanceData = [
  { department: "Cardiology", patients: 842, revenue: 1240000, satisfaction: 4.8 },
  { department: "Neurology", patients: 456, revenue: 980000, satisfaction: 4.7 },
  { department: "Orthopedics", patients: 689, revenue: 1120000, satisfaction: 4.6 },
  { department: "Pediatrics", patients: 1240, revenue: 685000, satisfaction: 4.9 },
  { department: "Gynecology", patients: 567, revenue: 845000, satisfaction: 4.8 },
  { department: "Dermatology", patients: 324, revenue: 320000, satisfaction: 4.5 },
];

export const appointmentTrendData = [
  { day: "Mon", booked: 45, completed: 38, cancelled: 4 },
  { day: "Tue", booked: 52, completed: 45, cancelled: 3 },
  { day: "Wed", booked: 48, completed: 41, cancelled: 5 },
  { day: "Thu", booked: 56, completed: 49, cancelled: 2 },
  { day: "Fri", booked: 62, completed: 55, cancelled: 4 },
  { day: "Sat", booked: 38, completed: 33, cancelled: 3 },
  { day: "Sun", booked: 18, completed: 15, cancelled: 2 },
];

export const insuranceClaimsData = [
  { status: "Approved", count: 142, amount: 2840000 },
  { status: "Pending", count: 38, amount: 760000 },
  { status: "Rejected", count: 18, amount: 360000 },
  { status: "Settled", count: 128, amount: 2560000 },
];

export const pharmacySalesData = [
  { month: "Jan", sales: 285000, purchases: 220000 },
  { month: "Feb", sales: 312000, purchases: 245000 },
  { month: "Mar", sales: 348000, purchases: 280000 },
  { month: "Apr", sales: 321000, purchases: 255000 },
  { month: "May", sales: 385000, purchases: 310000 },
  { month: "Jun", sales: 412000, purchases: 325000 },
  { month: "Jul", sales: 438000, purchases: 350000 },
  { month: "Aug", sales: 482000, purchases: 380000 },
];
