-- WiFi-gated attendance: every punch records the device IP seen by the
-- server and whether it matched the branch's saved clinic network
-- (Admin → Settings → Network & WiFi). Presence punches (Kiosk/Device)
-- are rejected when off-network; manager corrections (Manual) are exempt.
-- Fully idempotent: safe to re-run.
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS device_ip TEXT NOT NULL DEFAULT '';
ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS network_verified BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_staff_attendance_verified ON staff_attendance(network_verified);
