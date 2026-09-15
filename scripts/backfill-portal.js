/* One-time backfill: move portal rows stranded in app_settings
 * (portal_login_*, rx_*, appt_req_*) into their real tables, then delete
 * the stranded keys so reads come from one source of truth.
 * Usage: node scripts/backfill-portal.js
 */
const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      let v = m[2].trim().replace(/^["']|["']$/g, "");
      process.env[m[1]] = v;
    }
  }
}

async function main() {
  loadEnv();
  const cs = process.env.DIRECT_URL || process.env.DATABASE_URL;
  const client = new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await client.connect();
  const { rows } = await client.query(
    "SELECT key, value FROM app_settings WHERE key LIKE 'portal_login_%' OR key LIKE 'rx_%' OR key LIKE 'appt_req_%'"
  );
  console.log(`Found ${rows.length} fallback key(s).`);
  let moved = 0;
  const migratedKeys = [];

  for (const { key, value } of rows) {
    let v;
    try { v = JSON.parse(value); } catch { console.log(`  SKIP ${key} (corrupt JSON)`); continue; }
    try {
      if (key.startsWith("portal_login_")) {
        const patientId = key.slice("portal_login_".length);
        const exists = await client.query("SELECT 1 FROM patient_logins WHERE patient_id=$1", [patientId]);
        if (exists.rowCount === 0) {
          await client.query(
            "INSERT INTO patient_logins (patient_id, phone, password_hash, must_change_password) VALUES ($1,$2,$3,$4)",
            [patientId, v.phone, v.passwordHash, !!v.mustChangePassword]
          );
          console.log(`  MOVED ${key} -> patient_logins`);
        } else {
          console.log(`  SKIP ${key} (already in patient_logins)`);
        }
        moved++;
        migratedKeys.push(key);
      } else if (key.startsWith("appt_req_")) {
        if (!v.id || !v.patientId) { console.log(`  SKIP ${key} (missing id/patientId)`); continue; }
        const exists = await client.query("SELECT 1 FROM appointment_requests WHERE id=$1", [v.id]);
        if (exists.rowCount === 0) {
          await client.query(
            `INSERT INTO appointment_requests
             (id, patient_id, patient_name, phone, doctor_id, doctor_name, department, date, time, reason, fee, status, branch)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [v.id, v.patientId, v.patientName || "", v.phone || "", v.doctorId || "", v.doctorName || "",
             v.department || "", v.date || "", v.time || "", v.reason || "", v.fee ?? 0,
             v.status || "Requested", v.branch || ""]
          );
          console.log(`  MOVED ${key} -> appointment_requests`);
        } else {
          console.log(`  SKIP ${key} (already in appointment_requests)`);
        }
        moved++;
        migratedKeys.push(key);
      } else if (key.startsWith("rx_")) {
        if (!v.id || !v.patientId) { console.log(`  SKIP ${key} (missing id/patientId)`); continue; }
        const exists = await client.query("SELECT 1 FROM prescriptions WHERE id=$1", [v.id]);
        if (exists.rowCount === 0) {
          await client.query(
            `INSERT INTO prescriptions
             (id, patient_id, patient_name, appointment_id, doctor_name, diagnosis, notes, status, date, branch)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [v.id, v.patientId, v.patientName || "", v.appointmentId || null, v.doctorName || "",
             v.diagnosis || "", v.notes || "", v.status || "Issued", v.date || "", v.branch || ""]
          );
          for (const it of v.items || []) {
            await client.query(
              `INSERT INTO prescription_items
               (prescription_id, medicine_name, dosage, frequency, duration, quantity, unit, notes)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
              [v.id, it.medicineName, it.dosage || "", it.frequency || "", it.duration || "",
               it.quantity ?? 0, it.unit || "Tablet", it.notes || ""]
            );
          }
          console.log(`  MOVED ${key} -> prescriptions`);
        } else {
          console.log(`  SKIP ${key} (already in prescriptions)`);
        }
        moved++;
        migratedKeys.push(key);
      }
    } catch (e) {
      console.log(`  ERROR ${key}: ${e.message.slice(0, 150)}`);
    }
  }

  if (migratedKeys.length > 0) {
    await client.query("DELETE FROM app_settings WHERE key = ANY($1)", [migratedKeys]);
    console.log(`Deleted ${migratedKeys.length} stranded setting key(s).`);
  }
  console.log(`Done. ${moved} key(s) now live in real tables.`);
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
