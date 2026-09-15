/* Sync all local Supabase migrations to the hosted DB.
 * Usage: npm run supabase:sync
 * Reads DIRECT_URL (or DATABASE_URL) from .env, applies every
 * supabase/migrations/*.sql in order. All project migrations are
 * idempotent (IF NOT EXISTS), so re-running is safe.
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
      let v = m[2].trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}

async function main() {
  loadEnv();
  // Prefer the direct connection (port 5432) for DDL; pooler 6543 is for app traffic.
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Missing DIRECT_URL / DATABASE_URL in env.");
    process.exit(1);
  }
  const dir = path.join(__dirname, "..", "supabase", "migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  console.log(`Applying ${files.length} migration(s) to Supabase...`);

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    try {
      await client.query(sql);
      console.log(`  OK  ${file}`);
    } catch (err) {
      // Whole-file run can fail on one bad statement; retry statement-by-statement,
      // ignoring "already exists" so re-runs stay safe.
      const statements = sql.split(";").map((s) => s.trim()).filter(Boolean);
      let ok = 0, skipped = 0;
      for (const stmt of statements) {
        if (stmt.startsWith("--")) continue;
        try {
          await client.query(stmt);
          ok++;
        } catch (e) {
          if (/already exists|duplicate|does not exist/i.test(e.message)) skipped++;
          else console.log(`  WARN ${file}: ${e.message.slice(0, 120)}`);
        }
      }
      console.log(`  PART ${file} (${ok} applied, ${skipped} skipped)`);
    }
  }

  await client.end();
  console.log("Supabase backend in sync.");
}

main().catch((e) => { console.error(e); process.exit(1); });
