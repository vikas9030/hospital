-- Per-day multi-shift doctor timings, e.g.
-- [{"day":"Mon","from":"09:00","to":"13:00","shift":"Morning"},
--  {"day":"Mon","from":"17:00","to":"21:00","shift":"Evening"}].
-- Fully idempotent: safe to re-run.
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS schedule_json TEXT NOT NULL DEFAULT '[]';
