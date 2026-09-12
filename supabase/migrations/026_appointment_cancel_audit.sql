-- Appointment cancel audit: who cancelled a schedule, when, and why.
-- Cancelled visits stay in the table (status = 'Cancelled') so patient
-- history keeps showing them; hard deletes are reserved for duplicates.
-- Fully idempotent: safe to re-run.
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_by TEXT NOT NULL DEFAULT '';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancel_reason TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
