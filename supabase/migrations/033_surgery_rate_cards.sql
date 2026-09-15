-- Surgery / operation price master: per-operation default price breakup.
-- Booking a surgery auto-expands the matching card into priced charge
-- components (surgeon / assistant / anesthesia / OT), line by line.
-- Idempotent: safe to re-run. No existing data is touched.

CREATE TABLE IF NOT EXISTS surgery_rate_cards (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  operation_name TEXT NOT NULL,
  surgery_category TEXT NOT NULL DEFAULT '',
  surgeon_fee NUMERIC NOT NULL DEFAULT 0,
  assistant_fee NUMERIC NOT NULL DEFAULT 0,
  anesthesia_charge NUMERIC NOT NULL DEFAULT 0,
  ot_charge NUMERIC NOT NULL DEFAULT 0,
  nursing_charge NUMERIC NOT NULL DEFAULT 0,
  consumables_estimate NUMERIC NOT NULL DEFAULT 0,
  branch TEXT NOT NULL DEFAULT '',
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rate_cards_operation ON surgery_rate_cards(operation_name);
CREATE INDEX IF NOT EXISTS idx_rate_cards_branch ON surgery_rate_cards(branch);
CREATE INDEX IF NOT EXISTS idx_rate_cards_active ON surgery_rate_cards(active);

ALTER TABLE surgery_rate_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read surgery_rate_cards" ON surgery_rate_cards;
DROP POLICY IF EXISTS "Service role full access surgery_rate_cards" ON surgery_rate_cards;
CREATE POLICY "Authenticated read surgery_rate_cards" ON surgery_rate_cards FOR SELECT USING (true);
CREATE POLICY "Service role full access surgery_rate_cards" ON surgery_rate_cards FOR ALL USING (auth.role() = 'service_role');

DROP TRIGGER IF EXISTS update_surgery_rate_cards_updated_at ON surgery_rate_cards;
CREATE TRIGGER update_surgery_rate_cards_updated_at BEFORE UPDATE ON surgery_rate_cards FOR EACH ROW EXECUTE FUNCTION update_updated_at();
