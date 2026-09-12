-- Claim → bill linkage was sent by the app but the column never existed,
-- so linked bills never persisted. Add it now.
-- Fully idempotent: safe to re-run.
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS invoice_id TEXT NOT NULL DEFAULT '';
