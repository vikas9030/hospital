-- IPD admissions + admission-level financial ledger (charges, payments, refunds).
-- Patient → Admission → Charges → Invoices → Payments / Refunds.
-- Idempotent: safe to re-run. No existing data is touched.

-- ===== Admissions (one billing account per admission) =====
CREATE TABLE IF NOT EXISTS admissions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admission_no TEXT UNIQUE,
  patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  uhid TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  doctor_name TEXT NOT NULL DEFAULT '',
  department TEXT NOT NULL DEFAULT '',
  admission_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expected_discharge_date TEXT NOT NULL DEFAULT '',
  discharge_at TIMESTAMPTZ,
  bed_id TEXT NOT NULL DEFAULT '',
  bed_number TEXT NOT NULL DEFAULT '',
  room TEXT NOT NULL DEFAULT '',
  ward TEXT NOT NULL DEFAULT '',
  bed_rate INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Admitted' CHECK (status IN ('Admitted', 'Discharged', 'Cancelled')),
  billing_status TEXT NOT NULL DEFAULT 'Open' CHECK (billing_status IN ('Open', 'Interim Billing', 'Discharge Pending', 'Final Bill Generated', 'Payment Pending', 'Paid', 'Closed')),
  pay_mode TEXT NOT NULL DEFAULT 'Self' CHECK (pay_mode IN ('Self', 'Insurance')),
  insurance_provider TEXT NOT NULL DEFAULT '',
  insurance_policy TEXT NOT NULL DEFAULT '',
  insurance_auth TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admissions_patient ON admissions(patient_id);
CREATE INDEX IF NOT EXISTS idx_admissions_branch ON admissions(branch);
CREATE INDEX IF NOT EXISTS idx_admissions_status ON admissions(status);
CREATE INDEX IF NOT EXISTS idx_admissions_billing ON admissions(billing_status);

-- ===== Admission charges (every IPD charge belongs to an admission) =====
CREATE TABLE IF NOT EXISTS admission_charges (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admission_id TEXT NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
  patient_id TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  description TEXT NOT NULL DEFAULT '',
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  surgery_case_id TEXT,
  invoice_id TEXT,
  billed BOOLEAN NOT NULL DEFAULT false,
  idempotency_key TEXT UNIQUE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_adm_charges_admission ON admission_charges(admission_id);
CREATE INDEX IF NOT EXISTS idx_adm_charges_patient ON admission_charges(patient_id);
CREATE INDEX IF NOT EXISTS idx_adm_charges_invoice ON admission_charges(invoice_id);

-- ===== Payments (receipt ledger; never deleted, only reversed via refunds) =====
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  receipt_no TEXT UNIQUE,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  invoice_id TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Cash',
  txn_ref TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'Payment' CHECK (kind IN ('Payment', 'Advance')),
  idempotency_key TEXT UNIQUE,
  received_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_admission ON payments(admission_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_branch ON payments(branch);

-- ===== Payment → invoice allocations (one payment can split across bills) =====
CREATE TABLE IF NOT EXISTS payment_allocations (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_payment ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_pay_alloc_invoice ON payment_allocations(invoice_id);

-- ===== Refunds (reversal workflow; original payment is never deleted) =====
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  refund_no TEXT UNIQUE,
  patient_id TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL,
  invoice_id TEXT,
  payment_id TEXT REFERENCES payments(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  method TEXT NOT NULL DEFAULT 'Cash',
  reason TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  processed_by TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Requested' CHECK (status IN ('Requested', 'Approved', 'Rejected', 'Processed')),
  txn_ref TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_admission ON refunds(admission_id);
CREATE INDEX IF NOT EXISTS idx_refunds_patient ON refunds(patient_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- ===== Invoice extensions (backward compatible: all nullable/defaulted) =====
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS admission_id TEXT REFERENCES admissions(id) ON DELETE SET NULL;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_kind TEXT NOT NULL DEFAULT 'OPD';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS bill_status TEXT NOT NULL DEFAULT 'Draft' CHECK (bill_status IN ('Draft', 'Finalized', 'Cancelled'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_approved_by TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_invoices_admission ON invoices(admission_id);

ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS admission_id TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS charge_id TEXT;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS tax NUMERIC NOT NULL DEFAULT 0;

-- ===== RLS (same pattern as existing tables) =====
ALTER TABLE admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admission_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read admissions" ON admissions;
DROP POLICY IF EXISTS "Authenticated read admission_charges" ON admission_charges;
DROP POLICY IF EXISTS "Authenticated read payments" ON payments;
DROP POLICY IF EXISTS "Authenticated read payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Authenticated read refunds" ON refunds;
DROP POLICY IF EXISTS "Service role full access admissions" ON admissions;
DROP POLICY IF EXISTS "Service role full access admission_charges" ON admission_charges;
DROP POLICY IF EXISTS "Service role full access payments" ON payments;
DROP POLICY IF EXISTS "Service role full access payment_allocations" ON payment_allocations;
DROP POLICY IF EXISTS "Service role full access refunds" ON refunds;
CREATE POLICY "Authenticated read admissions" ON admissions FOR SELECT USING (true);
CREATE POLICY "Authenticated read admission_charges" ON admission_charges FOR SELECT USING (true);
CREATE POLICY "Authenticated read payments" ON payments FOR SELECT USING (true);
CREATE POLICY "Authenticated read payment_allocations" ON payment_allocations FOR SELECT USING (true);
CREATE POLICY "Authenticated read refunds" ON refunds FOR SELECT USING (true);
CREATE POLICY "Service role full access admissions" ON admissions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access admission_charges" ON admission_charges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payment_allocations" ON payment_allocations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access refunds" ON refunds FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_admissions_updated_at ON admissions;
DROP TRIGGER IF EXISTS update_admission_charges_updated_at ON admission_charges;
DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
DROP TRIGGER IF EXISTS update_refunds_updated_at ON refunds;
CREATE TRIGGER update_admissions_updated_at BEFORE UPDATE ON admissions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_admission_charges_updated_at BEFORE UPDATE ON admission_charges FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_refunds_updated_at BEFORE UPDATE ON refunds FOR EACH ROW EXECUTE FUNCTION update_updated_at();
