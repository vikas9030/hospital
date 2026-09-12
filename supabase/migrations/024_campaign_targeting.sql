-- Marketing campaigns: structured audience targeting (who) + message body.
-- audience_kind: all-patients | patient | all-doctors | doctor | all-staff | staff
-- audience_ref_id/name: the picked person for individual kinds.
-- Fully idempotent: safe to re-run.
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_kind TEXT NOT NULL DEFAULT 'all-patients';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_ref_id TEXT NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience_ref_name TEXT NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS message TEXT NOT NULL DEFAULT '';
