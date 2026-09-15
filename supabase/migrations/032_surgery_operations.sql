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
