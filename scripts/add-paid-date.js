require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() => c.query("ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_date DATE"))
  .then(() => {
    console.log("invoices.paid_date ready");
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
