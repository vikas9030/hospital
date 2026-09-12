-- Claims without a linked bill send NULL invoice_id; keep the column
-- nullable so unlinked claims always save. Fully idempotent.
ALTER TABLE insurance_claims ALTER COLUMN invoice_id DROP NOT NULL;
