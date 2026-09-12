require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(`
      ALTER TABLE invoice_items DROP CONSTRAINT IF EXISTS invoice_items_category_check;
      ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_category_check
        CHECK ((category = ANY (ARRAY['Consultation'::text, 'Lab'::text, 'Radiology'::text, 'Pharmacy'::text, 'Room'::text, 'Procedure'::text, 'Other'::text, 'OPD'::text, 'IPD'::text])));
    `)
  )
  .then(() => {
    console.log("category constraint extended");
    return c.query("SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = 'invoice_items_category_check'");
  })
  .then((r) => {
    console.log(r.rows[0]?.def);
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
