-- Tables used by the app but missing from the initial schema.
-- Without app_settings, admin settings (service prices, bill/report design)
-- silently fail to persist, so lab/radiology price auto-fill never works.

-- ===== App Settings (global key/value store) =====
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ===== Per-branch doctor schedules =====
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

CREATE POLICY "Authenticated read app_settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Authenticated read doctor_branch_schedules" ON doctor_branch_schedules FOR SELECT USING (true);
CREATE POLICY "Service role full access app_settings" ON app_settings FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access doctor_branch_schedules" ON doctor_branch_schedules FOR ALL USING (auth.role() = 'service_role');

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_doctor_branch_schedules_updated_at BEFORE UPDATE ON doctor_branch_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
