-- Pharmacy alerts: near-expiry and low/out-of-stock warnings per medicine.
-- The app recomputes the desired active set on every Pharmacy load and
-- syncs it here (upsert by medicine + type, auto-resolve cleared ones), so
-- this table is the backend source of truth for the notification bell.
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS medicine_alerts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  medicine_id TEXT NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  medicine_name TEXT NOT NULL DEFAULT '',
  batch_no TEXT NOT NULL DEFAULT '',
  alert_type TEXT NOT NULL CHECK (alert_type IN ('expiry', 'expired', 'low_stock', 'out_of_stock')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('high', 'medium', 'low')),
  message TEXT NOT NULL DEFAULT '',
  days_to_expiry INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  threshold INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  branch TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (medicine_id, alert_type)
);
CREATE INDEX IF NOT EXISTS idx_medicine_alerts_branch ON medicine_alerts(branch);
CREATE INDEX IF NOT EXISTS idx_medicine_alerts_status ON medicine_alerts(status);
ALTER TABLE medicine_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated read medicine_alerts" ON medicine_alerts;
CREATE POLICY "Authenticated read medicine_alerts" ON medicine_alerts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role full access medicine_alerts" ON medicine_alerts;
CREATE POLICY "Service role full access medicine_alerts" ON medicine_alerts FOR ALL USING (auth.role() = 'service_role');
