import type {
  Admission, AdmissionCharge, CompleteBill, LedgerRow, Payment, Refund, Invoice,
} from "@/lib/types";

/** Billed days between admission and discharge (both days inclusive, min 1). */
export function stayDaysBetween(admittedOn: string, dischargeOn: string): number {
  const [y1, m1, d1] = admittedOn.split("-").map(Number);
  const [y2, m2, d2] = dischargeOn.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return 1;
  const diff = Math.floor(
    (new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000
  );
  return Math.max(1, diff + 1);
}

/** Net for one charge line: qty × rate − discount + tax (never negative). */
export function chargeNet(c: Pick<AdmissionCharge, "quantity" | "rate" | "discount" | "tax" | "amount">): number {
  const base = c.amount > 0 ? c.amount : (c.quantity || 0) * (c.rate || 0);
  return Math.max(0, base - (c.discount || 0) + (c.tax || 0));
}

const num = (v: unknown): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v as number) ?? 0;
  return Number.isFinite(n) ? n : 0;
};

/**
 * Server/client shared complete-bill calculator.
 * Gross = Σ charge nets; Net = gross − invoice-level discount + invoice-level tax;
 * Outstanding = Net − payments − advances + processed refunds.
 * Totals are recomputed here — never trusted from the browser.
 */
export function computeCompleteBill(
  admission: Admission,
  charges: AdmissionCharge[],
  payments: Payment[],
  refunds: Refund[],
  invoices: Invoice[],
  invoiceDiscount = 0,
  invoiceTax = 0
): CompleteBill {
  const mine = charges.filter((c) => c.admissionId === admission.id);
  const categoryMap = new Map<string, number>();
  let gross = 0, chargeDiscount = 0, chargeTax = 0;
  for (const c of mine) {
    const base = num(c.amount) > 0 ? num(c.amount) : num(c.quantity) * num(c.rate);
    const net = Math.max(0, base - num(c.discount) + num(c.tax));
    gross += net;
    chargeDiscount += num(c.discount);
    chargeTax += num(c.tax);
    categoryMap.set(c.category || "Other", (categoryMap.get(c.category || "Other") ?? 0) + net);
  }
  const discount = chargeDiscount + num(invoiceDiscount);
  const tax = chargeTax + num(invoiceTax);
  const myPayments = payments.filter((p) => (p.admissionId || "") === admission.id);
  const advancePaid = myPayments.filter((p) => p.kind === "Advance").reduce((s, p) => s + num(p.amount), 0);
  const previousPayments = myPayments.filter((p) => p.kind !== "Advance").reduce((s, p) => s + num(p.amount), 0);
  const refundsTotal = refunds
    .filter((r) => (r.admissionId || "") === admission.id && (r.status === "Approved" || r.status === "Processed"))
    .reduce((s, r) => s + num(r.amount), 0);
  const netPayable = Math.max(0, gross - num(invoiceDiscount) + num(invoiceTax));
  const outstanding = Math.max(0, netPayable - advancePaid - previousPayments + refundsTotal);

  // Running ledger: charges (debit) + payments/advances (credit) + refunds (debit).
  const events: { at: string; type: LedgerRow["type"]; description: string; debit: number; credit: number; refId: string }[] = [
    ...mine.map((c) => ({
      at: c.occurredAt || "", type: "Charge" as const,
      description: `${c.category} — ${c.description}`, debit: chargeNet(c as AdmissionCharge), credit: 0, refId: c.id,
    })),
    ...myPayments.map((p) => ({
      at: p.occurredAt || "", type: (p.kind === "Advance" ? "Advance" : "Payment") as LedgerRow["type"],
      description: `${p.kind} (${p.method})${p.receiptNo ? ` • ${p.receiptNo}` : ""}`, debit: 0, credit: num(p.amount), refId: p.id,
    })),
    ...refunds
      .filter((r) => (r.admissionId || "") === admission.id && (r.status === "Approved" || r.status === "Processed"))
      .map((r) => ({
        at: "", type: "Refund" as const,
        description: `Refund (${r.method}) — ${r.reason}`, debit: num(r.amount), credit: 0, refId: r.id,
      })),
  ].sort((a, b) => (a.at || "").localeCompare(b.at || ""));
  let balance = 0;
  const ledger: LedgerRow[] = events.map((e) => {
    balance += e.debit - e.credit;
    return { date: e.at, type: e.type, description: e.description, debit: e.debit, credit: e.credit, balance, refId: e.refId };
  });

  return {
    admission, charges: mine, payments: myPayments,
    refunds: refunds.filter((r) => (r.admissionId || "") === admission.id),
    invoices: invoices.filter((i) => (i.admissionId || "") === admission.id),
    categoryTotals: [...categoryMap.entries()].map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    gross, discount, tax, advancePaid, previousPayments, refundsTotal,
    netPayable, outstanding, ledger,
  };
}

/** Default auto-added surgery billing components (labels only — prices come from service pricing / packages). */
export const SURGERY_COMPONENTS = [
  "Surgery/Procedure Fee", "Surgeon Fee", "Assistant Surgeon Fee", "Anesthetist Fee",
  "OT / Theatre Charge", "Anesthesia Charge", "OT Nursing Charge", "Recovery Room Charge",
] as const;

/** Expand a package into billable components: base price + included items + extras − discount + tax. */
export function packageTotals(
  basePrice: number,
  included: { quantity: number; rate: number }[],
  extras: { quantity: number; rate: number }[],
  packageDiscount = 0,
  tax = 0
): { includedTotal: number; extrasTotal: number; finalTotal: number } {
  const includedTotal = included.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0);
  const extrasTotal = extras.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0);
  const finalTotal = Math.max(0, num(basePrice) + extrasTotal - num(packageDiscount) + num(tax));
  return { includedTotal, extrasTotal, finalTotal };
}
