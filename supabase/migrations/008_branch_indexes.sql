-- Branch isolation support: every data table carries a branch column.
-- These indexes keep per-branch listing fast as data grows.
-- Fully idempotent: safe to re-run.

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

-- Backfill: any legacy rows with an empty branch inherit the first branch,
-- so nothing is orphaned from every view.
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
