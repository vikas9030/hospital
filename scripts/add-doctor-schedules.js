require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(`
      CREATE TABLE IF NOT EXISTS doctor_branch_schedules (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        doctor_email TEXT NOT NULL,
        branch TEXT NOT NULL,
        available_days TEXT[] DEFAULT '{}',
        available_from TEXT,
        available_to TEXT,
        shift TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE (doctor_email, branch)
      );
      CREATE INDEX IF NOT EXISTS idx_dbs_email ON doctor_branch_schedules (doctor_email);
    `)
  )
  .then(() => {
    console.log("doctor_branch_schedules ready");
    return c.query("SELECT column_name FROM information_schema.columns WHERE table_name='doctor_branch_schedules' ORDER BY ordinal_position");
  })
  .then((r) => {
    console.log(r.rows.map((x) => x.column_name).join(", "));
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
