-- Accountant workspace: hospital expenses (money out) for day book,
-- profit and category reporting. Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Other',
  amount DOUBLE PRECISION NOT NULL DEFAULT 0,
  date TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'Cash',
  vendor TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  recorded_by TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_expenses_branch ON expenses(branch);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
