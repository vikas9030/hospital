-- Patient-requested visits: portal creates a request, reception/admin accepts
-- (creating the appointment + token + pending OP bill) or rejects it.

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

CREATE POLICY "Authenticated read appointment_requests" ON appointment_requests FOR SELECT USING (true);
CREATE POLICY "Service role full access appointment_requests" ON appointment_requests FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_appointment_requests_updated_at BEFORE UPDATE ON appointment_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
