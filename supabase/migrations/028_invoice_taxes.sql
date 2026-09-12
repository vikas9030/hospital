-- Flexible per-bill tax lines: each invoice can carry any number of named
-- taxes (GST, CGST, SGST, service tax, …) with its own percentage.
-- Amounts are computed as: amount = (subtotal − discount) × percent / 100.
--   tax   = SUM(amount) over the bill's lines
--   total = subtotal − discount + tax
-- Sector presets (name + percent) live in app_settings under
-- billing_taxPresets (JSON array) and are managed from Admin Settings.
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS invoice_taxes (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'GST',
  percent DOUBLE PRECISION NOT NULL DEFAULT 0,
  amount DOUBLE PRECISION NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_invoice ON invoice_taxes(invoice_id);
ALTER TABLE invoice_taxes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read invoice_taxes" ON invoice_taxes;
CREATE POLICY "Authenticated read invoice_taxes" ON invoice_taxes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access invoice_taxes" ON invoice_taxes;
CREATE POLICY "Service role full access invoice_taxes" ON invoice_taxes FOR ALL USING (auth.role() = 'service_role');
