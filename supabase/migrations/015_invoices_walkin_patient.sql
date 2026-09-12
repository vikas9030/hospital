-- Walk-in billing: first-aid for unregistered patients has no patient_id.
-- Fully idempotent: safe to re-run.
ALTER TABLE invoices ALTER COLUMN patient_id DROP NOT NULL;
