-- Razorpay transaction ledger: every online order + verified collection.
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS razorpay_payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  invoice_no TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  razorpay_order_id TEXT NOT NULL DEFAULT '',
  razorpay_payment_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'paid', 'failed')),
  mode TEXT NOT NULL DEFAULT '' CHECK (mode IN ('', 'test', 'live')),
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_invoice ON razorpay_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_payments_branch ON razorpay_payments(branch);

ALTER TABLE razorpay_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read razorpay_payments" ON razorpay_payments;
DROP POLICY IF EXISTS "Service role full access razorpay_payments" ON razorpay_payments;
CREATE POLICY "Authenticated read razorpay_payments" ON razorpay_payments FOR SELECT USING (true);
CREATE POLICY "Service role full access razorpay_payments" ON razorpay_payments FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_razorpay_payments_updated_at ON razorpay_payments;
CREATE TRIGGER update_razorpay_payments_updated_at BEFORE UPDATE ON razorpay_payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
