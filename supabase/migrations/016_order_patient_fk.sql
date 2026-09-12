-- Orders must survive even when the linked patient row is missing, merged
-- or booked as a walk-in (the app resolves names client-side). The strict
-- patient FKs silently rejected such orders, so they never reached the
-- Lab/Radiology dashboards. Drop them; columns stay for linking.
-- Fully idempotent: safe to re-run.
ALTER TABLE radiology_orders DROP CONSTRAINT IF EXISTS radiology_orders_patient_id_fkey;
ALTER TABLE lab_tests DROP CONSTRAINT IF EXISTS lab_tests_patient_id_fkey;
