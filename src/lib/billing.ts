export interface TaxLineInput {
  name?: string | null;
  percent?: number | string | null;
}

export interface TaxLine extends TaxLineInput {
  name: string;
  percent: number;
  amount: number;
}

export interface BillingPercents {
  discountPercent?: number | string | null;
  gstPercent?: number | string | null;
  cstPercent?: number | string | null;
  /** Flexible tax lines (migration 028). When present, GST/CST % are ignored. */
  taxes?: TaxLineInput[] | null;
}

export interface BillingTotals {
  subtotal: number;
  discountPercent: number;
  discount: number;
  taxableBase: number;
  taxes: TaxLine[];
  gstPercent: number;
  gstAmount: number;
  cstPercent: number;
  cstAmount: number;
  tax: number;
  total: number;
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? parseFloat(v) : (v ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

/**
 * Single source of truth for every bill in the app:
 *   discount  = subtotal × discount% / 100
 *   base      = subtotal − discount
 *   each tax  = base × percent / 100   (any names: GST, CGST, SGST, …)
 *   tax       = Σ tax amounts
 *   total     = subtotal − discount + tax
 * All modules, panels and dashboards read invoice.total, so taxes entered
 * once in Billing propagate everywhere automatically.
 */
export function calcInvoiceTotals(subtotal: number, percents: BillingPercents = {}): BillingTotals {
  const sub = num(subtotal);
  const discountPercent = Math.min(100, num(percents.discountPercent));
  const discount = Math.round((sub * discountPercent) / 100);
  const taxableBase = Math.max(0, sub - discount);
  // Flexible lines win; legacy GST/CST % degrade to two named lines.
  const rawLines: TaxLineInput[] = Array.isArray(percents.taxes) && percents.taxes.length > 0
    ? percents.taxes
    : [
      ...(num(percents.gstPercent) > 0 ? [{ name: "GST", percent: percents.gstPercent }] : []),
      ...(num(percents.cstPercent) > 0 ? [{ name: "CST", percent: percents.cstPercent }] : []),
    ];
  const taxes: TaxLine[] = rawLines
    .map((l) => ({
      name: String(l?.name ?? "").trim() || "Tax",
      percent: num(l?.percent),
      amount: 0,
    }))
    .filter((l) => l.percent > 0)
    .map((l) => ({ ...l, amount: Math.round((taxableBase * l.percent) / 100) }));
  const tax = taxes.reduce((s, l) => s + l.amount, 0);
  const total = Math.max(0, sub - discount + tax);
  const gst = taxes.find((l) => l.name.toUpperCase() === "GST");
  const cst = taxes.find((l) => l.name.toUpperCase() === "CST");
  return {
    subtotal: sub, discountPercent, discount, taxableBase, taxes,
    gstPercent: gst?.percent ?? 0, gstAmount: gst?.amount ?? 0,
    cstPercent: cst?.percent ?? 0, cstAmount: cst?.amount ?? 0,
    tax, total,
  };
}

export interface TaxPreset {
  name: string;
  percent: number;
  /** Optional sector label, e.g. "Lab", "Pharmacy", "Room". */
  sector?: string;
}

/** Admin-configured billing defaults (Settings → Tax & Currency). */
export function billingDefaults(settings: Record<string, string> = {}): { discountPercent: number; gstPercent: number; cstPercent: number } {
  return {
    discountPercent: num(settings.billing_discountPercent),
    gstPercent: num(settings.billing_gstPercent ?? settings.taxRate),
    cstPercent: num(settings.billing_cstPercent),
  };
}

/** Default tax lines for a new bill, from Admin presets (or legacy defaults). */
export function defaultTaxLines(settings: Record<string, string> = {}): TaxLineInput[] {
  const presets = parseTaxPresets(settings);
  if (presets.length > 0) return presets.filter((p) => !p.sector || p.sector === "All").map((p) => ({ name: p.name, percent: p.percent }));
  const d = billingDefaults(settings);
  const lines: TaxLineInput[] = [];
  if (num(d.gstPercent) > 0) lines.push({ name: "GST", percent: d.gstPercent });
  if (num(d.cstPercent) > 0) lines.push({ name: "CST", percent: d.cstPercent });
  return lines;
}

/** Display-ready tax lines for any invoice: stored lines first, legacy columns as fallback. */
export function displayTaxLines(inv: {
  taxes?: { name: string; percent: number; amount: number }[] | null;
  gstPercent?: number | null; gstAmount?: number | null;
  cstPercent?: number | null; cstAmount?: number | null;
  tax?: number | null;
}): TaxLine[] {
  if (Array.isArray(inv.taxes) && inv.taxes.length > 0) {
    return inv.taxes.map((l) => ({ name: l.name || "Tax", percent: l.percent ?? 0, amount: l.amount ?? 0 }));
  }
  const lines: TaxLine[] = [];
  if ((inv.gstAmount ?? 0) > 0 || (inv.gstPercent ?? 0) > 0) lines.push({ name: "GST", percent: inv.gstPercent ?? 0, amount: inv.gstAmount ?? 0 });
  if ((inv.cstAmount ?? 0) > 0 || (inv.cstPercent ?? 0) > 0) lines.push({ name: "CST", percent: inv.cstPercent ?? 0, amount: inv.cstAmount ?? 0 });
  if (lines.length === 0 && (inv.tax ?? 0) > 0) lines.push({ name: "Tax", percent: 0, amount: inv.tax ?? 0 });
  return lines;
}

/** Parse the Admin-managed sector tax presets (settings.billing_taxPresets JSON). */
export function parseTaxPresets(settings: Record<string, string> = {}): TaxPreset[] {
  try {
    const raw = settings.billing_taxPresets;
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((p) => p && typeof p.name === "string" && p.name.trim())
      .map((p) => ({ name: p.name.trim(), percent: num(p.percent), sector: typeof p.sector === "string" ? p.sector : "All" }));
  } catch {
    return [];
  }
}
