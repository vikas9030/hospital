require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(`
      ALTER TABLE doctors
        ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS available_from TEXT,
        ADD COLUMN IF NOT EXISTS available_to TEXT,
        ADD COLUMN IF NOT EXISTS shift TEXT;
      ALTER TABLE staff
        ADD COLUMN IF NOT EXISTS available_days TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS available_from TEXT,
        ADD COLUMN IF NOT EXISTS available_to TEXT,
        ADD COLUMN IF NOT EXISTS shift TEXT;
    `)
  )
  .then(() => {
    console.log("availability columns ensured");
    return c.query("SELECT table_name, column_name FROM information_schema.columns WHERE column_name IN ('available_days','available_from','available_to','shift') ORDER BY table_name");
  })
  .then((r) => {
    console.log(r.rows);
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
