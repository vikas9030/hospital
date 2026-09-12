-- Insurance claims: missing user-facing fields (type was collected in the
-- UI but never stored). Fully idempotent: safe to re-run.
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT '';
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS admission_date TEXT NOT NULL DEFAULT '';
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS discharge_date TEXT NOT NULL DEFAULT '';
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS tpa_name TEXT NOT NULL DEFAULT '';
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT '';
