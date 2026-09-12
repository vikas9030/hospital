import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Children first to respect foreign keys, then parents.
const tables = [
  "audit_logs",
  "appointment_reminders",
  "invoice_items",
  "invoice_taxes",
  "medicine_alerts",
  "patient_timeline",
  "notifications",
  "insurance_claims",
  "radiology_orders",
  "lab_tests",
  "leads",
  "campaigns",
  "invoices",
  "medicines",
  "inventory",
  "beds",
  "appointments",
  "doctors",
  "patients",
  "staff",
  "users",
  "revenue_trend",
  "patient_growth",
  "department_performance",
  "system_state",
  "branches",
];

let failed = false;
for (const t of tables) {
  const { error } = await sb.from(t).delete().neq("id", "__never_matches__");
  if (error) {
    failed = true;
    console.error(`FAILED ${t}: ${error.message}`);
  } else {
    console.log(`wiped ${t}`);
  }
}

console.log(failed ? "WIPE INCOMPLETE" : "ALL TABLES WIPED");
process.exit(failed ? 1 : 0);
