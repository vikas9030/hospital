-- ============================================================================
-- MediCore one-shot database setup (migrations 002 → 007).
-- Run the ENTIRE file once in Supabase → SQL Editor → Run.
-- Fully idempotent: safe to re-run any number of times.
-- Requires migration 001 (core tables) to be applied first.
-- ============================================================================

-- ===== 002: lab / radiology findings =====
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS findings TEXT;
ALTER TABLE lab_tests ADD COLUMN IF NOT EXISTS problems TEXT;
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS findings TEXT;
ALTER TABLE radiology_orders ADD COLUMN IF NOT EXISTS problems TEXT;

-- ===== 003: app settings + doctor schedules =====
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS doctor_branch_schedules (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  doctor_email TEXT NOT NULL,
  branch TEXT NOT NULL,
  available_days TEXT[] DEFAULT '{}',
  available_from TEXT,
  available_to TEXT,
  shift TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (doctor_email, branch)
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctor_branch_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read app_settings" ON app_settings;
DROP POLICY IF EXISTS "Authenticated read doctor_branch_schedules" ON doctor_branch_schedules;
DROP POLICY IF EXISTS "Service role full access app_settings" ON app_settings;
DROP POLICY IF EXISTS "Service role full access doctor_branch_schedules" ON doctor_branch_schedules;
CREATE POLICY "Authenticated read app_settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated read doctor_branch_schedules" ON doctor_branch_schedules FOR SELECT USING (true);
CREATE POLICY "Service role full access app_settings" ON app_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access doctor_branch_schedules" ON doctor_branch_schedules FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
DROP TRIGGER IF EXISTS update_doctor_branch_schedules_updated_at ON doctor_branch_schedules;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_doctor_branch_schedules_updated_at BEFORE UPDATE ON doctor_branch_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== 004: OPD/IPD bill categories =====
ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_category_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_category_check
  CHECK (category IN ('Consultation', 'OPD', 'IPD', 'Lab', 'Radiology', 'Pharmacy', 'Room', 'Procedure', 'Other'));

-- ===== 005: medicine strip pricing =====
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS strip_size INTEGER NOT NULL DEFAULT 10;
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS sheet_price DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ===== 006: patient portal + prescriptions + visit notes =====
CREATE TABLE IF NOT EXISTS patient_logins (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL UNIQUE REFERENCES patients(id) ON DELETE CASCADE,
  phone TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  must_change_password BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_logins_phone ON patient_logins(phone);

CREATE TABLE IF NOT EXISTS prescriptions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  appointment_id TEXT REFERENCES appointments(id) ON DELETE SET NULL,
  doctor_name TEXT NOT NULL DEFAULT '',
  diagnosis TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Issued' CHECK (status IN ('Issued', 'Partially Dispensed', 'Dispensed', 'Cancelled', 'Follow Up')),
  date TEXT NOT NULL,
  branch TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id);

CREATE TABLE IF NOT EXISTS prescription_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  prescription_id TEXT NOT NULL REFERENCES prescriptions(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL,
  dosage TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL DEFAULT '',
  duration TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'Tablet' CHECK (unit IN ('Tablet', 'Sheet')),
  notes TEXT NOT NULL DEFAULT ''
);

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS problems TEXT NOT NULL DEFAULT '';

ALTER TABLE patient_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read patient_logins" ON patient_logins;
DROP POLICY IF EXISTS "Authenticated read prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Authenticated read prescription_items" ON prescription_items;
DROP POLICY IF EXISTS "Service role full access patient_logins" ON patient_logins;
DROP POLICY IF EXISTS "Service role full access prescriptions" ON prescriptions;
DROP POLICY IF EXISTS "Service role full access prescription_items" ON prescription_items;
CREATE POLICY "Authenticated read patient_logins" ON patient_logins FOR SELECT USING (true);
CREATE POLICY "Authenticated read prescriptions" ON prescriptions FOR SELECT USING (true);
CREATE POLICY "Authenticated read prescription_items" ON prescription_items FOR SELECT USING (true);
CREATE POLICY "Service role full access patient_logins" ON patient_logins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access prescriptions" ON prescriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access prescription_items" ON prescription_items FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_patient_logins_updated_at ON patient_logins;
DROP TRIGGER IF EXISTS update_prescriptions_updated_at ON prescriptions;
CREATE TRIGGER update_patient_logins_updated_at BEFORE UPDATE ON patient_logins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== 007: patient visit requests =====
CREATE TABLE IF NOT EXISTS appointment_requests (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  doctor_id TEXT NOT NULL DEFAULT '',
  doctor_name TEXT NOT NULL,
  department TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  fee INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Accepted', 'Rejected', 'Cancelled', 'Follow Up')),
  branch TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_patient ON appointment_requests(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointment_requests_branch ON appointment_requests(branch);

ALTER TABLE appointment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read appointment_requests" ON appointment_requests;
DROP POLICY IF EXISTS "Service role full access appointment_requests" ON appointment_requests;
CREATE POLICY "Authenticated read appointment_requests" ON appointment_requests FOR SELECT USING (true);
CREATE POLICY "Service role full access appointment_requests" ON appointment_requests FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_appointment_requests_updated_at ON appointment_requests;
CREATE TRIGGER update_appointment_requests_updated_at BEFORE UPDATE ON appointment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== 008: branch indexes + backfill empty branches =====
CREATE INDEX IF NOT EXISTS idx_patients_branch ON patients(branch);
CREATE INDEX IF NOT EXISTS idx_doctors_branch ON doctors(branch);
CREATE INDEX IF NOT EXISTS idx_appointments_branch ON appointments(branch);
CREATE INDEX IF NOT EXISTS idx_appointments_branch_date ON appointments(branch, date);
CREATE INDEX IF NOT EXISTS idx_beds_branch ON beds(branch);
CREATE INDEX IF NOT EXISTS idx_invoices_branch ON invoices(branch);
CREATE INDEX IF NOT EXISTS idx_medicines_branch ON medicines(branch);
CREATE INDEX IF NOT EXISTS idx_lab_tests_branch ON lab_tests(branch);
CREATE INDEX IF NOT EXISTS idx_radiology_orders_branch ON radiology_orders(branch);
CREATE INDEX IF NOT EXISTS idx_medical_records_branch ON medical_records(branch);
CREATE INDEX IF NOT EXISTS idx_staff_branch ON staff(branch);
CREATE INDEX IF NOT EXISTS idx_users_branch ON users(branch);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_branch ON insurance_claims(branch);
CREATE INDEX IF NOT EXISTS idx_notifications_branch ON notifications(branch);

DO $$
DECLARE
  first_branch TEXT;
BEGIN
  SELECT name INTO first_branch FROM branches ORDER BY created_at LIMIT 1;
  IF first_branch IS NOT NULL THEN
    UPDATE patients SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE doctors SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE appointments SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE beds SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE invoices SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE medicines SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE lab_tests SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE radiology_orders SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE medical_records SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE staff SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE insurance_claims SET branch = first_branch WHERE branch IS NULL OR branch = '';
    UPDATE notifications SET branch = first_branch WHERE branch IS NULL OR branch = '';
  END IF;
END $$;

-- ===== 009: claim ↔ invoice link =====
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_claims_invoice ON insurance_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_branch ON insurance_claims(branch);

-- ===== 010: staff photos + login avatars =====
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';

-- ===== 012: staff clinical fields (fee/schedule) =====
ALTER TABLE staff ADD COLUMN IF NOT EXISTS consultation_fee DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_days TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_from TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_to TEXT NOT NULL DEFAULT '';

-- ===== 013: per-day multi-shift doctor timings =====
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS schedule_json TEXT NOT NULL DEFAULT '[]';

-- ===== 011: Razorpay transaction ledger =====
CREATE TABLE IF NOT EXISTS razorpay_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_no TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL DEFAULT '',
  razorpay_payment_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  mode TEXT NOT NULL DEFAULT '' CHECK (mode IN ('', 'test', 'live')),
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_invoice ON razorpay_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_branch ON razorpay_payments(branch);

ALTER TABLE razorpay_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read razorpay_payments" ON razorpay_payments;
DROP POLICY IF EXISTS "Service role full access razorpay_payments" ON razorpay_payments;
CREATE POLICY "Authenticated read razorpay_payments" ON razorpay_payments FOR SELECT USING (true);
CREATE POLICY "Service role full access razorpay_payments" ON razorpay_payments FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_razorpay_payments_updated_at ON razorpay_payments;
CREATE TRIGGER update_razorpay_payments_updated_at BEFORE UPDATE ON razorpay_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===== Verify (should return rows, no errors) =====
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
-- AND table_name IN ('app_settings','doctor_branch_schedules','patient_logins',
--   'prescriptions','prescription_items','appointment_requests');
