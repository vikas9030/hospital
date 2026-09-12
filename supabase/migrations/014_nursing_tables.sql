-- Nursing station backend: nurse→doctor/ward/bed assignments, patient
-- vitals/status checks, and first-aid log (with charges + collection).
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS nurse_assignments (
  nurse_id TEXT PRIMARY KEY,
  nurse_name TEXT NOT NULL DEFAULT '',
  doctor_ids TEXT[] NOT NULL DEFAULT '{}',
  wards TEXT[] NOT NULL DEFAULT '{}',
  bed_ids TEXT[] NOT NULL DEFAULT '{}',
  branch TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS nurse_vitals (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  nurse_id TEXT NOT NULL DEFAULT '',
  nurse TEXT NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  bp_sys TEXT NOT NULL DEFAULT '',
  bp_dia TEXT NOT NULL DEFAULT '',
  pulse TEXT NOT NULL DEFAULT '',
  temp TEXT NOT NULL DEFAULT '',
  spo2 TEXT NOT NULL DEFAULT '',
  sugar TEXT NOT NULL DEFAULT '',
  condition TEXT NOT NULL DEFAULT 'Stable',
  notes TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nurse_vitals_patient ON nurse_vitals(patient_id);
CREATE INDEX IF NOT EXISTS idx_nurse_vitals_branch ON nurse_vitals(branch);
CREATE TABLE IF NOT EXISTS nurse_firstaid (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  custom_name TEXT NOT NULL DEFAULT '',
  nurse_id TEXT NOT NULL DEFAULT '',
  nurse TEXT NOT NULL DEFAULT '',
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind TEXT NOT NULL DEFAULT 'Other',
  bed_id TEXT NOT NULL DEFAULT '',
  bed_number TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  paid_amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  invoice_id TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_nurse_firstaid_branch ON nurse_firstaid(branch);
