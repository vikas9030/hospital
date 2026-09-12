-- Link insurance claims to billing invoices so approved amounts
-- can be applied straight to the patient's bill.
-- Fully idempotent: safe to re-run.
ALTER TABLE insurance_claims ADD COLUMN IF NOT EXISTS invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_insurance_claims_invoice ON insurance_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_insurance_claims_branch ON insurance_claims(branch);
