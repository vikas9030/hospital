-- Staff rows carry doctor fee/schedule fields the app reads and writes.
-- Without these, consultation fees and available days silently reset.
-- Fully idempotent: safe to re-run.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS consultation_fee DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_days TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_from TEXT NOT NULL DEFAULT '';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS available_to TEXT NOT NULL DEFAULT '';
-- photo/avatar columns (also in 010) kept here for completeness:
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
