import type { Invoice } from "@/lib/types";
import { displayTaxLines } from "@/lib/billing";
import { esc, getBranding, openPrintWindow, type ReportDoc } from "@/lib/documents";

export interface BillPatient {
  uhid?: string;
  phone?: string;
  age?: number | string;
  gender?: string;
}

// Builds the invoice document (previewable inline); printing reuses it.
export function buildInvoiceHtml(invoice: Invoice, settings: Record<string, string> = {}, patient?: BillPatient | null): ReportDoc {
  const b = getBranding(settings);
  const items = invoice.items ?? [];
  const total = invoice.total ?? 0;
  const paid = invoice.paidAmount ?? 0;
  const balance = Math.max(0, total - paid);
  const statusBg = invoice.status === "Paid" ? "#dcfce7" : invoice.status === "Partial" ? "#fef9c3" : "#fee2e2";
  const statusColor = invoice.status === "Paid" ? "#166534" : invoice.status === "Partial" ? "#854d0e" : "#991b1b";
  const contact = [b.address, b.phone, b.email].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ");
  const rows = items.length
    ? items
        .map(
          (it, i) => `<tr>
            <td>${i + 1}. ${esc(it.description)}</td>
            <td style="text-align:center">${esc(it.category)}</td>
            <td style="text-align:center">${it.quantity ?? 1}</td>
            <td style="text-align:right">₹${(it.rate ?? 0).toLocaleString("en-IN")}</td>
            <td style="text-align:right">₹${(it.amount ?? 0).toLocaleString("en-IN")}</td>
          </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888">No line items recorded</td></tr>`;
  const body = `<div class="head">
      ${b.logo ? `<img class="logo" src="${b.logo}" alt="Clinic logo" />` : ""}
      <div><div class="hname">${esc(b.hospitalName)}</div><div class="hsub">${contact}</div></div>
    </div>
    <div class="doctype">
      <div class="dtitle">Bill / Invoice — ${esc(invoice.invoiceNo)}</div>
      <span class="badge" style="background:${statusBg};color:${statusColor}">${esc(invoice.status)}</span>
    </div>
    <div class="pblock">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
        <div class="pname">${esc(invoice.patientName)}</div>
        ${patient?.uhid ? `<div class="puhid">${esc(patient.uhid)}</div>` : ""}
      </div>
      <div class="prow">
        <span><span class="lbl">Bill date: </span><strong>${esc(invoice.date)}</strong></span>
        ${invoice.dueDate && invoice.dueDate !== invoice.date ? `<span><span class="lbl">Due: </span><strong>${esc(invoice.dueDate)}</strong></span>` : ""}
        ${patient?.phone ? `<span><span class="lbl">Phone: </span><strong>${esc(patient.phone)}</strong></span>` : ""}
        ${patient?.age ? `<span><span class="lbl">Age/Sex: </span><strong>${esc(patient.age)} yrs / ${esc(patient.gender)}</strong></span>` : ""}
        ${invoice.paymentMethod ? `<span><span class="lbl">Paid via: </span><strong>${esc(invoice.paymentMethod)}</strong></span>` : ""}
      </div>
    </div>
    <table>
      <thead><tr><th>Service</th><th style="text-align:center">Category</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>₹${(invoice.subtotal ?? 0).toLocaleString("en-IN")}</span></div>
      <div><span>Discount (${invoice.discountPercent ?? 0}%)</span><span>− ₹${(invoice.discount ?? 0).toLocaleString("en-IN")}</span></div>
      ${displayTaxLines(invoice).map((tx) => `<div><span>${esc(tx.name)}${tx.percent > 0 ? ` (${tx.percent}%)` : ""}</span><span>+ ₹${(tx.amount ?? 0).toLocaleString("en-IN")}</span></div>`).join("")}
      <div class="grand"><span>Total</span><span>₹${total.toLocaleString("en-IN")}</span></div>
      <div><span>Paid</span><span>₹${paid.toLocaleString("en-IN")}</span></div>
      ${balance > 0 ? `<div style="color:#b91c1c;font-weight:700"><span>Balance due</span><span>₹${balance.toLocaleString("en-IN")}</span></div>` : ""}
    </div>
    <div class="sign"><div>${esc(b.signatory)}<br><span style="color:#6b7280">${esc(b.hospitalName)}</span></div></div>
    <div class="foot">${esc(b.billFooter)}<br>Generated on ${esc(new Date().toLocaleString("en-IN"))}</div>`;
  const title = `Invoice ${invoice.invoiceNo}`;
  return {
    title,
    body,
    accent: b.accent,
    html: `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${body}</body></html>`,
  };
}

// Opens a clean, printable invoice window (browser print dialog → Save as PDF).
// Design comes from Admin Settings → Bills & Reports Design: invoiceHospitalName,
// invoiceLogo, invoiceAddress, invoicePhone, invoiceEmail, invoiceAccent,
// invoiceFooter, invoiceSignatory.
export function printInvoice(invoice: Invoice, settings: Record<string, string> = {}, patient?: BillPatient | null): boolean {
  const doc = buildInvoiceHtml(invoice, settings, patient);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}
