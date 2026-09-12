-- Patient portal: phone-based login, digital prescriptions, visit clinical notes.

-- ===== Patient logins (separate from staff users) =====
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

-- ===== Digital prescriptions (doctor issues → pharmacy fulfills) =====
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

-- ===== Visit clinical notes on appointments =====
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS clinical_notes TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS problems TEXT NOT NULL DEFAULT '';

ALTER TABLE patient_logins ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prescription_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read patient_logins" ON patient_logins FOR SELECT USING (true);
CREATE POLICY "Authenticated read prescriptions" ON prescriptions FOR SELECT USING (true);
CREATE POLICY "Authenticated read prescription_items" ON prescription_items FOR SELECT USING (true);
CREATE POLICY "Service role full access patient_logins" ON patient_logins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access prescriptions" ON prescriptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access prescription_items" ON prescription_items FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_patient_logins_updated_at BEFORE UPDATE ON patient_logins FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_prescriptions_updated_at BEFORE UPDATE ON prescriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
