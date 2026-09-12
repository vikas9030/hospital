require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(`
      ALTER TABLE staff ADD COLUMN IF NOT EXISTS consultation_fee DOUBLE PRECISION DEFAULT 0;
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT now()
      );
      INSERT INTO app_settings (key, value) VALUES ('opExpiryDays', '30') ON CONFLICT (key) DO NOTHING;
    `)
  )
  .then(() => {
    console.log("schema updated");
    return c.query("SELECT column_name FROM information_schema.columns WHERE table_name='staff' AND column_name='consultation_fee'");
  })
  .then((r) => {
    console.log(r.rows);
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
