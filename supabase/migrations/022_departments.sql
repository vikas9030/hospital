-- Branch departments, managed by Admin in Settings → Departments.
-- Every branch gets its own list; forms pull dropdowns from here.
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT '',
  head TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_departments_branch ON departments(branch);
-- Seed the standard list for every branch that has none yet.
INSERT INTO departments (id, name, branch)
SELECT 'dep_seed_' || md5(b.name || '|' || n.name), n.name, b.name
FROM branches b
CROSS JOIN (
  SELECT unnest(ARRAY['General Medicine','Cardiology','Neurology','Orthopedics','Pediatrics','Gynecology','Dermatology','ENT','Ophthalmology','Emergency']) AS name
) AS n
WHERE NOT EXISTS (SELECT 1 FROM departments x WHERE x.branch = b.name)
ON CONFLICT (id) DO NOTHING;
