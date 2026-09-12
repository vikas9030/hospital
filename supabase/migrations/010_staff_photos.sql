-- Staff profile photos (data URL or hosted URL) + login avatar persistence.
-- Fully idempotent: safe to re-run.
ALTER TABLE staff ADD COLUMN IF NOT EXISTS photo TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT '';
