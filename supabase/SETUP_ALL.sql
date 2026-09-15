-- ============================================================================
-- MediCore one-shot database setup (migrations 002 → 032).
-- Run the ENTIRE file once in Supabase → SQL Editor → Run.
-- Fully idempotent: safe to re-run any number of times.
-- Requires migration 001 (core tables) to be applied first.
-- Preferred path is `npm run supabase:sync` (applies supabase/migrations/*.sql in order);
-- this file mirrors the same SQL for manual SQL-Editor setup.
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
-- IPD admissions + admission-level financial ledger (charges, payments, refunds).
-- Patient → Admission → Charges → Invoices → Payments / Refunds.
-- Idempotent: safe to re-run. No existing data is touched.

-- ===== Admissions (one billing account per admission) =====
CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admission_no TEXT UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uhid TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  doctor_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  admission_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_discharge_date TEXT NOT NULL DEFAULT '',
  discharge_at TIMESTAMPTZ,
  bed_id TEXT NOT NULL DEFAULT '',
  bed_number TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  ward TEXT NOT NULL DEFAULT '',
  bed_rate INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Admitted' CHECK (status IN ('Admitted', 'Discharged', 'Cancelled')),
  billing_status TEXT NOT NULL DEFAULT 'Open' CHECK (billing_status IN ('Open', 'Interim Billing', 'Discharge Pending', 'Final Bill Generated', 'Payment Pending', 'Paid', 'Closed')),
  pay_mode TEXT NOT NULL DEFAULT 'Self' CHECK (pay_mode IN ('Self', 'Insurance')),
  insurance_provider TEXT NOT NULL DEFAULT '',
  insurance_policy TEXT NOT NULL DEFAULT '',
  insurance_auth TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_branch ON admissions(branch);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_billing ON admissions(billing_status);

-- ===== Admission charges (every IPD charge belongs to an admission) =====
CREATE TABLE IF NOT EXISTS admission_charges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admission_id TEXT NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  surgery_case_id TEXT,
  invoice_id TEXT,
  billed BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adm_charges_admission ON admission_charges(admission_id);
CREATE INDEX IF NOT EXISTS idx_adm_charges_patient ON admission_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_adm_charges_invoice ON admission_charges(invoice_id);

-- ===== Payments (receipt ledger; never deleted, only reversed via refunds) =====
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_no TEXT UNIQUE,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  invoice_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Cash',
  txn_ref TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'Payment' CHECK (kind IN ('Payment', 'Advance')),
  idempotency_key TEXT UNIQUE,
  received_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_admission ON payments(admission_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch);

-- ===== Payment → invoice allocations (one payment can split across bills) =====
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_invoice ON payment_allocations(invoice_id);

-- ===== Refunds (reversal workflow; original payment is never deleted) =====
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  refund_no TEXT UNIQUE,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  invoice_id TEXT,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Cash',
  reason TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  processed_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approved', 'Rejected', 'Processed')),
  txn_ref TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_admission ON refunds(admission_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- ===== Invoice extensions (backward compatible: all nullable/defaulted) =====
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_kind TEXT NOT NULL DEFAULT 'OPD';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_status TEXT NOT NULL DEFAULT 'Draft' CHECK (bill_status IN ('Draft', 'Finalized', 'Cancelled'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_approved_by TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_invoices_admission ON invoices(admission_id);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS admission_id TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS charge_id TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tax NUMERIC NOT NULL DEFAULT 0;

-- ===== RLS (same pattern as existing tables) =====
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read admissions" ON admissions;
DROP POLICY IF EXISTS "Authenticated read admission_charges" ON admission_charges;
DROP POLICY IF EXISTS "Authenticated read payments" ON payments;
DROP POLICY IF EXISTS "Authenticated read payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Authenticated read refunds" ON refunds;
DROP POLICY IF EXISTS "Service role full access admissions" ON admissions;
DROP POLICY IF EXISTS "Service role full access admission_charges" ON admission_charges;
DROP POLICY IF EXISTS "Service role full access payments" ON payments;
DROP POLICY IF EXISTS "Service role full access payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Service role full access refunds" ON refunds;
CREATE POLICY "Authenticated read admissions" ON admissions FOR SELECT USING (true);
CREATE POLICY "Authenticated read admission_charges" ON admission_charges FOR SELECT USING (true);
CREATE POLICY "Authenticated read payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Authenticated read payment_allocations" ON payment_allocations FOR SELECT USING (true);
CREATE POLICY "Authenticated read refunds" ON refunds FOR SELECT USING (true);
CREATE POLICY "Service role full access admissions" ON admissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access admission_charges" ON admission_charges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payment_allocations" ON payment_allocations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access refunds" ON refunds FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_admissions_updated_at ON admissions;
DROP TRIGGER IF EXISTS update_admission_charges_updated_at ON admission_charges;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
CREATE TRIGGER update_admissions_updated_at BEFORE UPDATE ON admissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_admission_charges_updated_at BEFORE UPDATE ON admission_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Surgery & Operation Theatre: cases, configurable charge components,
-- packages, and consumables/implants linked to admissions.
-- Idempotent: safe to re-run. No existing data is touched.

-- ===== Surgery cases (IPD surgeries must reference an admission) =====
CREATE TABLE IF NOT EXISTS surgery_cases (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_no TEXT UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uhid TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  bed_number TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  surgeon TEXT NOT NULL DEFAULT '',
  assistant_surgeon TEXT NOT NULL DEFAULT '',
  anesthetist TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  surgery_name TEXT NOT NULL DEFAULT '',
  surgery_category TEXT NOT NULL DEFAULT '',
  diagnosis TEXT NOT NULL DEFAULT '',
  planned_date TEXT NOT NULL DEFAULT '',
  planned_time TEXT NOT NULL DEFAULT '',
  planned_duration_min INTEGER NOT NULL DEFAULT 0,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  theatre TEXT NOT NULL DEFAULT '',
  anesthesia_type TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'Elective' CHECK (priority IN ('Elective', 'Emergency', 'Urgent')),
  kind TEXT NOT NULL DEFAULT 'Elective' CHECK (kind IN ('Elective', 'Emergency')),
  status TEXT NOT NULL DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Pre-op', 'Ready', 'In OT', 'Completed', 'Cancelled', 'Post-op', 'Discharged')),
  pre_op_notes TEXT NOT NULL DEFAULT '',
  post_op_notes TEXT NOT NULL DEFAULT '',
  complications TEXT NOT NULL DEFAULT '',
  consent_status TEXT NOT NULL DEFAULT 'Pending' CHECK (consent_status IN ('Pending', 'Obtained', 'Waived')),
  insurance_auth TEXT NOT NULL DEFAULT '',
  package_id TEXT,
  estimate NUMERIC NOT NULL DEFAULT 0,
  advance_required NUMERIC NOT NULL DEFAULT 0,
  branch TEXT NOT NULL DEFAULT '',
  remarks TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surgery_patient ON surgery_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_surgery_admission ON surgery_cases(admission_id);
CREATE INDEX IF NOT EXISTS idx_surgery_status ON surgery_cases(status);
CREATE INDEX IF NOT EXISTS idx_surgery_branch ON surgery_cases(branch);
CREATE INDEX IF NOT EXISTS idx_surgery_date ON surgery_cases(planned_date);

-- ===== Surgery charge components (each case's billable parts) =====
CREATE TABLE IF NOT EXISTS surgery_case_charges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id TEXT NOT NULL REFERENCES surgery_cases(id) ON DELETE CASCADE,
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  label TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Surgery',
  amount NUMERIC NOT NULL DEFAULT 0,
  auto BOOLEAN NOT NULL DEFAULT false,
  package_id TEXT,
  invoice_id TEXT,
  billed BOOLEAN NOT NULL DEFAULT false,
  created_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surg_charges_case ON surgery_case_charges(case_id);
CREATE INDEX IF NOT EXISTS idx_surg_charges_admission ON surgery_case_charges(admission_id);

-- ===== Surgery packages (hospital-configured bundles) =====
CREATE TABLE IF NOT EXISTS surgery_packages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  surgery_type TEXT NOT NULL DEFAULT '',
  base_price NUMERIC NOT NULL DEFAULT 0,
  package_discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  validity_from TEXT NOT NULL DEFAULT '',
  validity_to TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surg_pkg_branch ON surgery_packages(branch);
CREATE INDEX IF NOT EXISTS idx_surg_pkg_active ON surgery_packages(active);

CREATE TABLE IF NOT EXISTS surgery_package_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  package_id TEXT NOT NULL REFERENCES surgery_packages(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Surgery',
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surg_pkg_items_pkg ON surgery_package_items(package_id);

-- ===== Surgery consumables & implants (stock deducted only on issue/use) =====
CREATE TABLE IF NOT EXISTS surgery_consumables (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  case_id TEXT NOT NULL REFERENCES surgery_cases(id) ON DELETE CASCADE,
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  patient_id TEXT NOT NULL DEFAULT '',
  item TEXT NOT NULL DEFAULT '',
  batch TEXT NOT NULL DEFAULT '',
  expiry TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  medicine_id TEXT,
  status TEXT NOT NULL DEFAULT 'Recorded' CHECK (status IN ('Recorded', 'Issued', 'Deducted', 'Cancelled')),
  used_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_surg_cons_case ON surgery_consumables(case_id);
CREATE INDEX IF NOT EXISTS idx_surg_cons_admission ON surgery_consumables(admission_id);
CREATE INDEX IF NOT EXISTS idx_surg_cons_status ON surgery_consumables(status);

-- ===== RLS (same pattern as existing tables) =====
ALTER TABLE surgery_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_case_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_package_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE surgery_consumables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read surgery_cases" ON surgery_cases;
DROP POLICY IF EXISTS "Authenticated read surgery_case_charges" ON surgery_case_charges;
DROP POLICY IF EXISTS "Authenticated read surgery_packages" ON surgery_packages;
DROP POLICY IF EXISTS "Authenticated read surgery_package_items" ON surgery_package_items;
DROP POLICY IF EXISTS "Authenticated read surgery_consumables" ON surgery_consumables;
DROP POLICY IF EXISTS "Service role full access surgery_cases" ON surgery_cases;
DROP POLICY IF EXISTS "Service role full access surgery_case_charges" ON surgery_case_charges;
DROP POLICY IF EXISTS "Service role full access surgery_packages" ON surgery_packages;
DROP POLICY IF EXISTS "Service role full access surgery_package_items" ON surgery_package_items;
DROP POLICY IF EXISTS "Service role full access surgery_consumables" ON surgery_consumables;
CREATE POLICY "Authenticated read surgery_cases" ON surgery_cases FOR SELECT USING (true);
CREATE POLICY "Authenticated read surgery_case_charges" ON surgery_case_charges FOR SELECT USING (true);
CREATE POLICY "Authenticated read surgery_packages" ON surgery_packages FOR SELECT USING (true);
CREATE POLICY "Authenticated read surgery_package_items" ON surgery_package_items FOR SELECT USING (true);
CREATE POLICY "Authenticated read surgery_consumables" ON surgery_consumables FOR SELECT USING (true);
CREATE POLICY "Service role full access surgery_cases" ON surgery_cases FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access surgery_case_charges" ON surgery_case_charges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access surgery_packages" ON surgery_packages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access surgery_package_items" ON surgery_package_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access surgery_consumables" ON surgery_consumables FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_surgery_cases_updated_at ON surgery_cases;
DROP TRIGGER IF EXISTS update_surgery_case_charges_updated_at ON surgery_case_charges;
DROP TRIGGER IF EXISTS update_surgery_packages_updated_at ON surgery_packages;
DROP TRIGGER IF EXISTS update_surgery_consumables_updated_at ON surgery_consumables;
CREATE TRIGGER update_surgery_cases_updated_at BEFORE UPDATE ON surgery_cases FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_surgery_case_charges_updated_at BEFORE UPDATE ON surgery_case_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_surgery_packages_updated_at BEFORE UPDATE ON surgery_packages FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_surgery_consumables_updated_at BEFORE UPDATE ON surgery_consumables FOR EACH ROW EXECUTE FUNCTION update_updated_at();
