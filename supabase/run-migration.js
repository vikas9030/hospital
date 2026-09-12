const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

async function run() {
  const directUrl =
    "postgresql://postgres.rdghrhbwknlwxsamkcrh:HEMAVIKAS9900%40%40@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";

  const client = new Client({
    connectionString: directUrl,
    ssl: { rejectUnauthorized: false },
  });

  console.log("Connecting to Supabase PostgreSQL...");
  await client.connect();
  console.log("Connected!");

  const sql = fs.readFileSync(
    path.join(__dirname, "migrations", "001_initial_hospital_schema.sql"),
    "utf8"
  );

  console.log("Running migration...");
  try {
    await client.query(sql);
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err.message);
    console.log("\nTrying statement by statement...");

    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("--"));

    for (let i = 0; i < statements.length; i++) {
      try {
        await client.query(statements[i]);
        process.stdout.write(`\r  [${i + 1}/${statements.length}] OK`);
      } catch (e) {
        if (!e.message.includes("already exists")) {
          console.log(`\n  [${i + 1}] WARN: ${e.message.slice(0, 100)}`);
        }
      }
    }
    console.log("\nMigration completed (with some warnings)!");
  }

  await client.end();
}

run().catch(console.error);
