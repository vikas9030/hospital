-- Claims must survive patient merges/deletes and imports with ad-hoc ids
-- (the app resolves names client-side). Drop the strict patient FK.
-- Fully idempotent: safe to re-run.
ALTER TABLE insurance_claims DROP CONSTRAINT IF EXISTS insurance_claims_patient_id_fkey;
