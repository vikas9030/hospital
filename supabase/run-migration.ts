import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function runMigration() {
  const sql = fs.readFileSync(
    path.join(__dirname, "migrations", "001_initial_hospital_schema.sql"),
    "utf8"
  );

  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Running ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i] + ";";
    try {
      const { error } = await supabase.rpc("exec_sql", { sql: stmt });
      if (error && !error.message.includes("already exists")) {
        console.log(`  [${i + 1}/${statements.length}] WARN: ${error.message.slice(0, 80)}`);
      }
    } catch {
      console.log(`  [${i + 1}/${statements.length}] SKIP (RPC not available)`);
    }
  }
}

runMigration().catch(console.error);
