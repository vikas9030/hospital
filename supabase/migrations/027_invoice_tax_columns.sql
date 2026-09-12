-- Percentage-based billing: discount %, GST %, CST % on every invoice.
-- Amounts are computed as:
--   discount   = subtotal * discount_percent / 100
--   base       = subtotal - discount
--   gst_amount = base * gst_percent / 100
--   cst_amount = base * cst_percent / 100
--   tax        = gst_amount + cst_amount
--   total      = subtotal - discount + tax
-- Fully idempotent: safe to re-run.
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_percent DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS gst_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cst_percent DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cst_amount DOUBLE PRECISION NOT NULL DEFAULT 0;
