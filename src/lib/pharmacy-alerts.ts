import type { Medicine } from "@/lib/types";

export interface DesiredAlert {
  medicineId: string;
  medicineName: string;
  batchNo: string;
  alertType: "expiry" | "expired" | "low_stock" | "out_of_stock";
  severity: "high" | "medium" | "low";
  message: string;
  daysToExpiry?: number | null;
  stock: number;
  threshold: number;
  branch: string;
}

const DAY_MS = 86400000;

/** Days from today until a stored YYYY-MM-DD expiry (null when unknown). */
export function daysToExpiry(expiryDate: string | undefined | null, today = new Date()): number | null {
  const m = (expiryDate ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const expiry = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const startToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.ceil((expiry - startToday) / DAY_MS);
}

/**
 * Desired active alert set for the current medicine list.
 * - stock === 0 → out_of_stock (high)
 * - stock <= reorderLevel → low_stock (medium)
 * - expiry within `expiryDays` → expiry (medium), already past → expired (high)
 */
export function computeDesiredAlerts(medicines: Medicine[], expiryDays = 30): DesiredAlert[] {
  const out: DesiredAlert[] = [];
  for (const med of medicines) {
    const stock = med.stock ?? 0;
    const threshold = med.reorderLevel ?? 0;
    if (stock <= 0) {
      out.push({
        medicineId: med.id, medicineName: med.name, batchNo: med.batchNo ?? "",
        alertType: "out_of_stock", severity: "high",
        message: `${med.name} is out of stock — reorder now.`,
        stock, threshold, branch: med.branch ?? "",
      });
      continue;
    }
    if (threshold > 0 && stock <= threshold) {
      out.push({
        medicineId: med.id, medicineName: med.name, batchNo: med.batchNo ?? "",
        alertType: "low_stock", severity: "medium",
        message: `${med.name} is low on stock (${stock} left, reorder at ${threshold}).`,
        stock, threshold, branch: med.branch ?? "",
      });
    }
    const days = daysToExpiry(med.expiryDate);
    if (days !== null && days < 0) {
      out.push({
        medicineId: med.id, medicineName: med.name, batchNo: med.batchNo ?? "",
        alertType: "expired", severity: "high",
        message: `${med.name} expired ${Math.abs(days)} day(s) ago — remove from shelf.`,
        daysToExpiry: days, stock, threshold, branch: med.branch ?? "",
      });
    } else if (days !== null && days <= expiryDays) {
      out.push({
        medicineId: med.id, medicineName: med.name, batchNo: med.batchNo ?? "",
        alertType: "expiry", severity: "medium",
        message: `${med.name} expires in ${days} day(s) — use or return soon.`,
        daysToExpiry: days, stock, threshold, branch: med.branch ?? "",
      });
    }
  }
  return out;
}
