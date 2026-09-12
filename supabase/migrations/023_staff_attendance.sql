-- Staff attendance: daily check-in/out, manual (HR) or kiosk/device punch.
-- One row per staff per day (upsert on conflict).
-- Fully idempotent: safe to re-run.
CREATE TABLE IF NOT EXISTS staff_attendance (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL DEFAULT '',
  staff_name TEXT NOT NULL DEFAULT '',
  date TEXT NOT NULL DEFAULT '',
  check_in TEXT NOT NULL DEFAULT '',
  check_out TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Present',
  mode TEXT NOT NULL DEFAULT 'Manual',
  marked_by TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  branch TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_attendance_day ON staff_attendance(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_branch ON staff_attendance(branch);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_date ON staff_attendance(date);
