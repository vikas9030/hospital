require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(`
      ALTER TABLE beds
        ADD COLUMN IF NOT EXISTS type TEXT,
        ADD COLUMN IF NOT EXISTS doctor_name TEXT,
        ADD COLUMN IF NOT EXISTS diagnosis TEXT;
    `)
  )
  .then(() => {
    console.log("beds columns ensured");
    return c.query("SELECT column_name FROM information_schema.columns WHERE table_name='beds' ORDER BY ordinal_position");
  })
  .then((r) => {
    console.log(r.rows.map((x) => x.column_name).join(", "));
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
