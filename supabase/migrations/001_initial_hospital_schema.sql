-- Migration: 001_initial_hospital_schema.sql
-- Run this in the Supabase SQL Editor to create all hospital tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===== Branches =====
CREATE TABLE branches (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  patients INTEGER DEFAULT 0,
  revenue DOUBLE PRECISION DEFAULT 0,
  staff INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Users (extends Prisma User for auth) =====
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Staff',
  avatar TEXT,
  branch TEXT,
  branch_id TEXT REFERENCES branches(id),
  staff_id TEXT UNIQUE,
  must_change_password BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'Active',
  shift TEXT DEFAULT 'Morning',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Patients =====
CREATE TABLE patients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  uhid TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  photo TEXT DEFAULT '',
  gender TEXT NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  age INTEGER NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  blood_group TEXT NOT NULL,
  address TEXT NOT NULL,
  emergency_contact TEXT NOT NULL,
  insurance_provider TEXT DEFAULT '',
  insurance_policy TEXT DEFAULT '',
  allergies TEXT[] DEFAULT '{}',
  chronic_diseases TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Admitted', 'Discharged', 'OPD', 'Follow Up')),
  last_visit DATE,
  registered_on DATE DEFAULT CURRENT_DATE,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Patient Timeline =====
CREATE TABLE patient_timeline (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('appointment', 'consultation', 'prescription', 'lab', 'radiology', 'billing', 'payment', 'followup', 'admission', 'discharge')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  doctor TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('completed', 'pending', 'in-progress')),
  amount DOUBLE PRECISION,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Doctors =====
CREATE TABLE doctors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  photo TEXT DEFAULT '',
  specialization TEXT NOT NULL,
  department TEXT NOT NULL,
  experience INTEGER NOT NULL,
  qualification TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  availability TEXT NOT NULL DEFAULT 'Available' CHECK (availability IN ('Available', 'Busy', 'Off Duty', 'On Leave', 'Follow Up')),
  rating DOUBLE PRECISION DEFAULT 0,
  consultation_fee DOUBLE PRECISION NOT NULL,
  today_appointments INTEGER DEFAULT 0,
  patients_treated INTEGER DEFAULT 0,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Appointments =====
CREATE TABLE appointments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  token TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  patient_photo TEXT DEFAULT '',
  doctor_id TEXT NOT NULL REFERENCES doctors(id),
  doctor_name TEXT NOT NULL,
  department TEXT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Walk-in', 'Online', 'Emergency', 'Referral')),
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Checked-in', 'In Consultation', 'Completed', 'Cancelled', 'No-show', 'Follow Up')),
  reason TEXT NOT NULL,
  waiting_time INTEGER DEFAULT 0,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Beds =====
CREATE TABLE beds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  number TEXT NOT NULL,
  ward TEXT NOT NULL CHECK (ward IN ('ICU', 'General Ward', 'Private Room', 'Semi Private', 'Emergency', 'Operation Theatre')),
  status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Maintenance', 'Reserved', 'Follow Up')),
  patient_name TEXT,
  patient_id TEXT REFERENCES patients(id),
  admitted_on DATE,
  daily_rate DOUBLE PRECISION NOT NULL,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Invoices =====
CREATE TABLE invoices (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_no TEXT NOT NULL UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  patient_name TEXT NOT NULL,
  date DATE NOT NULL,
  due_date DATE NOT NULL,
  subtotal DOUBLE PRECISION NOT NULL,
  tax DOUBLE PRECISION NOT NULL,
  discount DOUBLE PRECISION DEFAULT 0,
  total DOUBLE PRECISION NOT NULL,
  paid_amount DOUBLE PRECISION DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Paid', 'Partial', 'Pending', 'Overdue', 'Follow Up')),
  payment_method TEXT,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Invoice Items =====
CREATE TABLE invoice_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Consultation', 'Lab', 'Radiology', 'Pharmacy', 'Room', 'Procedure', 'Other')),
  quantity INTEGER NOT NULL,
  rate DOUBLE PRECISION NOT NULL,
  amount DOUBLE PRECISION NOT NULL
);

-- ===== Medicines (Pharmacy) =====
CREATE TABLE medicines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  batch_no TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  price DOUBLE PRECISION NOT NULL,
  supplier TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock', 'Expiring Soon', 'Follow Up')),
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Lab Tests =====
CREATE TABLE lab_tests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  test TEXT NOT NULL,
  category TEXT NOT NULL,
  ordered_by TEXT NOT NULL,
  ordered_on TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ordered' CHECK (status IN ('Ordered', 'Sample Collected', 'Testing', 'Quality Check', 'Approved', 'Rejected', 'Follow Up')),
  report_ready BOOLEAN DEFAULT false,
  price DOUBLE PRECISION NOT NULL,
  result TEXT,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Radiology Orders =====
CREATE TABLE radiology_orders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  modality TEXT NOT NULL CHECK (modality IN ('X-Ray', 'CT Scan', 'MRI', 'Ultrasound', 'ECG')),
  region TEXT NOT NULL,
  ordered_by TEXT NOT NULL,
  ordered_on TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'Ordered' CHECK (status IN ('Ordered', 'In Progress', 'Image Captured', 'Report Generated', 'Approved', 'Follow Up')),
  price DOUBLE PRECISION NOT NULL,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Insurance Claims =====
CREATE TABLE insurance_claims (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  claim_no TEXT NOT NULL UNIQUE,
  patient_name TEXT NOT NULL,
  patient_id TEXT NOT NULL REFERENCES patients(id),
  provider TEXT NOT NULL,
  policy_no TEXT NOT NULL,
  claim_amount DOUBLE PRECISION NOT NULL,
  approved_amount DOUBLE PRECISION DEFAULT 0,
  date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Pre-Auth', 'Approved', 'Rejected', 'Settled', 'Follow Up')),
  treatment TEXT NOT NULL,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== CRM Leads =====
CREATE TABLE leads (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('Website', 'Facebook', 'Google Ads', 'Walk-in', 'Referral', 'Phone Call', 'WhatsApp', 'Email')),
  stage TEXT NOT NULL DEFAULT 'New Lead' CHECK (stage IN ('New Lead', 'Contacted', 'Appointment', 'Visit', 'Treatment', 'Follow-up', 'Review', 'Repeat Patient')),
  interest TEXT NOT NULL,
  estimated_value DOUBLE PRECISION DEFAULT 0,
  assigned_to TEXT NOT NULL,
  created_on DATE DEFAULT CURRENT_DATE,
  last_contact DATE,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Campaigns =====
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('Email', 'SMS', 'WhatsApp', 'Offer', 'Referral')),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Scheduled', 'Completed', 'Draft', 'Follow Up')),
  audience INTEGER DEFAULT 0,
  sent INTEGER DEFAULT 0,
  opened INTEGER DEFAULT 0,
  clicked INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date DATE NOT NULL,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Staff =====
CREATE TABLE staff (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  staff_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Inactive', 'Follow Up')),
  shift TEXT NOT NULL DEFAULT 'Morning' CHECK (shift IN ('Morning', 'Evening', 'Night')),
  attendance INTEGER DEFAULT 100,
  join_date DATE NOT NULL,
  salary DOUBLE PRECISION NOT NULL,
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  user_id TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Inventory =====
CREATE TABLE inventory (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Equipment', 'Consumable', 'Furniture', 'IT')),
  stock INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL,
  supplier TEXT NOT NULL,
  price DOUBLE PRECISION NOT NULL,
  location TEXT NOT NULL,
  last_restocked DATE,
  status TEXT NOT NULL DEFAULT 'In Stock' CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock', 'Follow Up')),
  branch TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Notifications =====
CREATE TABLE notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT REFERENCES users(id),
  type TEXT NOT NULL CHECK (type IN ('appointment', 'lab', 'billing', 'insurance', 'pharmacy', 'system', 'marketing', 'emergency')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  time TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT false,
  priority TEXT NOT NULL DEFAULT 'low' CHECK (priority IN ('high', 'medium', 'low')),
  branch TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Audit Logs =====
CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id TEXT REFERENCES users(id),
  actor_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT,
  branch TEXT NOT NULL,
  details TEXT NOT NULL,
  ip TEXT,
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- ===== Medical Records =====
CREATE TABLE medical_records (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  doctor TEXT NOT NULL DEFAULT '',
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== System State =====
CREATE TABLE system_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  initialized BOOLEAN DEFAULT false,
  version TEXT DEFAULT '1.0.0',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Chart Data (Aggregated) =====
CREATE TABLE revenue_trend (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  month TEXT NOT NULL,
  revenue DOUBLE PRECISION NOT NULL,
  opd DOUBLE PRECISION NOT NULL,
  ipd DOUBLE PRECISION NOT NULL,
  branch_id TEXT REFERENCES branches(id)
);

CREATE TABLE patient_growth (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  month TEXT NOT NULL,
  new_patients INTEGER NOT NULL,
  total_patients INTEGER NOT NULL,
  branch_id TEXT REFERENCES branches(id)
);

CREATE TABLE department_performance (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  department TEXT NOT NULL,
  patients INTEGER NOT NULL,
  revenue DOUBLE PRECISION NOT NULL,
  satisfaction DOUBLE PRECISION NOT NULL,
  branch_id TEXT REFERENCES branches(id)
);

-- ===== INDEXES =====
CREATE INDEX idx_patients_branch ON patients(branch);
CREATE INDEX idx_patients_status ON patients(status);
CREATE INDEX idx_patients_name ON patients(name);
CREATE INDEX idx_doctors_branch ON doctors(branch);
CREATE INDEX idx_doctors_department ON doctors(department);
CREATE INDEX idx_appointments_date ON appointments(date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_status ON appointments(status);
CREATE INDEX idx_beds_ward ON beds(ward);
CREATE INDEX idx_beds_status ON beds(status);
CREATE INDEX idx_invoices_patient ON invoices(patient_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_lab_tests_patient ON lab_tests(patient_id);
CREATE INDEX idx_lab_tests_status ON lab_tests(status);
CREATE INDEX idx_radiology_orders_patient ON radiology_orders(patient_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);

-- ===== ROW LEVEL SECURITY =====
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE radiology_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;

-- Public read policies (adjust based on your auth requirements)
CREATE POLICY "Public read branches" ON branches FOR SELECT USING (true);
CREATE POLICY "Authenticated read patients" ON patients FOR SELECT USING (true);
CREATE POLICY "Authenticated read doctors" ON doctors FOR SELECT USING (true);
CREATE POLICY "Authenticated read appointments" ON appointments FOR SELECT USING (true);
CREATE POLICY "Authenticated read beds" ON beds FOR SELECT USING (true);
CREATE POLICY "Authenticated read invoices" ON invoices FOR SELECT USING (true);
CREATE POLICY "Authenticated read invoice_items" ON invoice_items FOR SELECT USING (true);
CREATE POLICY "Authenticated read medicines" ON medicines FOR SELECT USING (true);
CREATE POLICY "Authenticated read lab_tests" ON lab_tests FOR SELECT USING (true);
CREATE POLICY "Authenticated read radiology_orders" ON radiology_orders FOR SELECT USING (true);
CREATE POLICY "Authenticated read insurance_claims" ON insurance_claims FOR SELECT USING (true);
CREATE POLICY "Authenticated read leads" ON leads FOR SELECT USING (true);
CREATE POLICY "Authenticated read campaigns" ON campaigns FOR SELECT USING (true);
CREATE POLICY "Authenticated read staff" ON staff FOR SELECT USING (true);
CREATE POLICY "Authenticated read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Authenticated read notifications" ON notifications FOR SELECT USING (true);
CREATE POLICY "Authenticated read audit_logs" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "Authenticated read patient_timeline" ON patient_timeline FOR SELECT USING (true);
CREATE POLICY "Authenticated read users" ON users FOR SELECT USING (true);
CREATE POLICY "Authenticated read revenue_trend" ON revenue_trend FOR SELECT USING (true);
CREATE POLICY "Authenticated read patient_growth" ON patient_growth FOR SELECT USING (true);
CREATE POLICY "Authenticated read department_performance" ON department_performance FOR SELECT USING (true);

-- Service role full access policies
CREATE POLICY "Service role full access branches" ON branches FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access patients" ON patients FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access doctors" ON doctors FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access appointments" ON appointments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access beds" ON beds FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access invoices" ON invoices FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access invoice_items" ON invoice_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access medicines" ON medicines FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access lab_tests" ON lab_tests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access radiology_orders" ON radiology_orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access insurance_claims" ON insurance_claims FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access leads" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access campaigns" ON campaigns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access staff" ON staff FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inventory" ON inventory FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access audit_logs" ON audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access users" ON users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access patient_timeline" ON patient_timeline FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access medical_records" ON medical_records FOR ALL USING (auth.role() = 'service_role');

-- ===== UPDATED_AT TRIGGER =====
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_branches_updated_at BEFORE UPDATE ON branches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_patients_updated_at BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_doctors_updated_at BEFORE UPDATE ON doctors FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_appointments_updated_at BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_beds_updated_at BEFORE UPDATE ON beds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_medicines_updated_at BEFORE UPDATE ON medicines FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_lab_tests_updated_at BEFORE UPDATE ON lab_tests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_radiology_orders_updated_at BEFORE UPDATE ON radiology_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_insurance_claims_updated_at BEFORE UPDATE ON insurance_claims FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_medical_records_updated_at BEFORE UPDATE ON medical_records FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
