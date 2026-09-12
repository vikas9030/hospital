-- Appointment reminders: generated client-side, now persisted to Supabase
-- so they survive reloads and work across devices.
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS appointment_reminders (
  id TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL DEFAULT '',
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  patient_phone TEXT NOT NULL DEFAULT '',
  doctor_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  appointment_date TEXT NOT NULL DEFAULT '',
  appointment_time TEXT NOT NULL DEFAULT '',
  minutes_before INTEGER NOT NULL DEFAULT 30,
  sent_at TEXT NOT NULL DEFAULT '',
  method TEXT NOT NULL DEFAULT 'push',
  status TEXT NOT NULL DEFAULT 'sent',
  branch TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_branch ON appointment_reminders(branch);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_appointment ON appointment_reminders(appointment_id);
CREATE INDEX IF NOT EXISTS idx_appointment_reminders_date ON appointment_reminders(appointment_date);
ALTER TABLE appointment_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read appointment_reminders" ON appointment_reminders;
CREATE POLICY "Authenticated read appointment_reminders" ON appointment_reminders FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access appointment_reminders" ON appointment_reminders;
CREATE POLICY "Service role full access appointment_reminders" ON appointment_reminders FOR ALL USING (auth.role() = 'service_role');
