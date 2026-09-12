require("dotenv").config();
const { Client } = require("pg");
const c = new Client({ connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL });
c.connect()
  .then(() =>
    c.query(
      "ALTER TABLE patients ADD COLUMN IF NOT EXISTS op_date DATE, ADD COLUMN IF NOT EXISTS op_fees DOUBLE PRECISION DEFAULT 0, ADD COLUMN IF NOT EXISTS doctor_id TEXT, ADD COLUMN IF NOT EXISTS doctor_name TEXT"
    )
  )
  .then(() => {
    console.log("columns ensured");
    return c.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name='patients' AND column_name IN ('op_date','op_fees','doctor_id','doctor_name')"
    );
  })
  .then((r) => {
    console.log(r.rows);
    return c.end();
  })
  .catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
