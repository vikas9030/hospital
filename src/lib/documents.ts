import type { Admission, Appointment, CompleteBill, Invoice, LabTest, MedicalRecord, Patient, Payment, RadiologyOrder, Refund, SurgeryCase } from "@/lib/types";

// Central styled-document system: every bill, lab report, radiology report,
// medical record and OP summary prints with the clinic's branding (logo, name,
// address, accent colour) configured by the admin in Settings → Bills & Reports Design.
// Output goes to a print window so staff can print or "Save as PDF" — never .txt.

export interface DocBranding {
  hospitalName: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  accent: string;
  billFooter: string;
  reportFooter: string;
  signatory: string;
}

export function getBranding(settings: Record<string, string> = {}): DocBranding {
  return {
    hospitalName: settings.invoiceHospitalName || settings.hospitalName || "MediCore Hospital",
    logo: settings.invoiceLogo || "",
    address: settings.invoiceAddress || "",
    phone: settings.invoicePhone || "",
    email: settings.invoiceEmail || "",
    accent: settings.invoiceAccent || "#0f766e",
    billFooter: settings.invoiceFooter || "Thank you for choosing us. Wishing you a speedy recovery!",
    reportFooter: settings.reportFooter || "This is a computer-generated report and does not require a physical signature unless stamped.",
    signatory: settings.invoiceSignatory || "Authorised Signatory",
  };
}

export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

function docCss(accent: string): string {
  return `
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #111827; padding: 28px 32px; max-width: 760px; margin: 0 auto; }
    .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid ${accent}; padding-bottom: 14px; margin-bottom: 6px; }
    .logo { height: 56px; width: 56px; object-fit: contain; border-radius: 10px; border: 1px solid #e5e7eb; }
    .hname { font-size: 24px; font-weight: 800; letter-spacing: 0.3px; color: ${accent}; }
    .hsub { font-size: 11.5px; color: #6b7280; margin-top: 2px; }
    .doctype { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; }
    .dtitle { font-size: 17px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; }
    .badge { display: inline-block; padding: 3px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .pblock { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 13px; }
    .pblock .pname { font-size: 16px; font-weight: 800; }
    .puhid { font-family: monospace; color: #64748b; font-size: 12px; }
    .prow { display: flex; flex-wrap: wrap; gap: 6px 22px; margin-top: 6px; }
    .prow span { white-space: nowrap; }
    .lbl { color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; }
    h2 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: ${accent}; margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 10px; }
    th { background: ${accent}; color: #fff; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
    td { padding: 8px 10px; border: 1px solid #e5e7eb; }
    .kv { display: flex; justify-content: space-between; gap: 16px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    .kv .k { color: #64748b; }
    .kv .v { font-weight: 600; text-align: right; }
    .note { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 10px 12px; font-size: 13px; margin-top: 8px; white-space: pre-wrap; }
    .para { font-size: 13px; white-space: pre-wrap; margin: 6px 0; }
    .totals { margin-left: auto; width: 300px; font-size: 13px; }
    .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
    .grand { border-top: 2px solid ${accent}; margin-top: 4px; padding-top: 8px; font-size: 16px; font-weight: 800; }
    .sign { display: flex; justify-content: flex-end; margin-top: 40px; font-size: 12px; color: #374151; }
    .sign div { text-align: center; border-top: 1px solid #9ca3af; padding-top: 6px; min-width: 180px; }
    .foot { margin-top: 24px; text-align: center; font-size: 11.5px; color: #6b7280; border-top: 1px dashed #d1d5db; padding-top: 10px; }
    @media print { body { padding: 0; } }
  `;
}

function headerHtml(b: DocBranding): string {
  const contact = [b.address, b.phone, b.email].filter(Boolean).map(esc).join(" &nbsp;•&nbsp; ");
  return `<div class="head">
    ${b.logo ? `<img class="logo" src="${b.logo}" alt="Clinic logo" />` : ""}
    <div><div class="hname">${esc(b.hospitalName)}</div><div class="hsub">${contact}</div></div>
  </div>`;
}

function patientHtml(p?: Patient | null, extra?: string): string {
  if (!p) return extra ? `<div class="pblock">${extra}</div>` : "";
  return `<div class="pblock">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
      <div class="pname">${esc(p.name)}</div><div class="puhid">${esc(p.uhid || p.id)}</div>
    </div>
    <div class="prow">
      <span><span class="lbl">Age/Sex: </span><strong>${esc(p.age)} yrs / ${esc(p.gender)}</strong></span>
      ${p.phone ? `<span><span class="lbl">Phone: </span><strong>${esc(p.phone)}</strong></span>` : ""}
      ${p.bloodGroup ? `<span><span class="lbl">Blood: </span><strong>${esc(p.bloodGroup)}</strong></span>` : ""}
      ${extra || ""}
    </div>
  </div>`;
}

export function openPrintWindow(title: string, bodyInner: string, accent: string): boolean {
  const win = window.open("", "_blank", "width=800,height=960");
  if (!win) return false;
  win.document.write(fullDocHtml(title, bodyInner, accent));
  win.document.close();
  win.focus();
  win.print();
  return true;
}

/** A printable document that can be previewed inline (iframe srcDoc). */
export interface ReportDoc {
  title: string;
  body: string;
  accent: string;
  html: string;
}

function toDoc(title: string, body: string, accent: string): ReportDoc {
  return { title, body, accent, html: fullDocHtml(title, body, accent) };
}

export function fullDocHtml(title: string, bodyInner: string, accent: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${docCss(accent)}</style></head><body>${bodyInner}</body></html>`;
}

function brandingOf(settings: Record<string, string> = {}): { b: DocBranding; accent: string } {
  const b = getBranding(settings);
  return { b, accent: b.accent };
}

function footHtml(b: DocBranding, footer: string): string {
  return `<div class="sign"><div>${esc(b.signatory)}<br><span style="color:#6b7280">${esc(b.hospitalName)}</span></div></div>
  <div class="foot">${esc(footer)}<br>Generated on ${esc(new Date().toLocaleString("en-IN"))}</div>`;
}

// ===== Lab report =====
export function buildLabReportHtml(test: LabTest, patient: Patient | null | undefined, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const statusColor = test.status === "Approved" ? "#166534" : test.status === "Rejected" ? "#991b1b" : "#854d0e";
  const statusBg = test.status === "Approved" ? "#dcfce7" : test.status === "Rejected" ? "#fee2e2" : "#fef9c3";
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">Laboratory Report</div><span class="badge" style="background:${statusBg};color:${statusColor}">${esc(test.status)}</span></div>
    ${patientHtml(patient, `<span><span class="lbl">Order ID: </span><strong>${esc(test.orderId)}</strong></span><span><span class="lbl">Date: </span><strong>${esc((test.orderedOn || "").split("T")[0])}</strong></span>`)}
    <h2>Test Details</h2>
    <div class="kv"><span class="k">Test</span><span class="v">${esc(test.test)}</span></div>
    <div class="kv"><span class="k">Category</span><span class="v">${esc(test.category)}</span></div>
    <div class="kv"><span class="k">Ordered By</span><span class="v">${esc(test.orderedBy || "—")}</span></div>
    <h2>Result</h2>
    <p class="para">${esc(test.result || "Result pending")}</p>
    ${test.findings ? `<h2>Findings</h2><p class="para">${esc(test.findings)}</p>` : ""}
    ${test.problems ? `<h2>Problems / Diagnosis</h2><div class="note">${esc(test.problems)}</div>` : ""}
    ${footHtml(b, b.reportFooter)}`;
  return toDoc(`Lab Report — ${test.patientName}`, body, accent);
}

export function printLabReport(test: LabTest, patient: Patient | null | undefined, settings: Record<string, string> = {}): boolean {
  const doc = buildLabReportHtml(test, patient, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Radiology report =====
export function buildRadiologyReportHtml(order: RadiologyOrder, patient: Patient | null | undefined, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">Radiology Report</div><span class="badge" style="background:#e0f2fe;color:#075985">${esc(order.status)}</span></div>
    ${patientHtml(patient, `<span><span class="lbl">Order ID: </span><strong>${esc(order.orderId)}</strong></span><span><span class="lbl">Date: </span><strong>${esc((order.orderedOn || "").split("T")[0])}</strong></span>`)}
    <h2>Examination Details</h2>
    <div class="kv"><span class="k">Modality</span><span class="v">${esc(order.modality)}</span></div>
    <div class="kv"><span class="k">Region / Study</span><span class="v">${esc(order.region)}</span></div>
    <div class="kv"><span class="k">Ordered By</span><span class="v">${esc(order.orderedBy || "—")}</span></div>
    <h2>Findings</h2>
    <p class="para">${esc(order.findings || "Findings pending")}</p>
    ${order.problems ? `<h2>Impression / Diagnosis</h2><div class="note">${esc(order.problems)}</div>` : ""}
    ${footHtml(b, b.reportFooter)}`;
  return toDoc(`Radiology Report — ${order.patientName}`, body, accent);
}

export function printRadiologyReport(order: RadiologyOrder, patient: Patient | null | undefined, settings: Record<string, string> = {}): boolean {
  const doc = buildRadiologyReportHtml(order, patient, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Generic medical record =====
export function buildMedicalRecordHtml(record: MedicalRecord, patient: Patient | null | undefined, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">${esc(record.type)}</div><span class="badge" style="background:#f1f5f8;color:#334155">${esc(record.recordDate)}</span></div>
    ${patientHtml(patient)}
    <h2>${esc(record.title || record.type)}</h2>
    <p class="para">${esc(record.notes || "No details recorded.")}</p>
    <div class="kv"><span class="k">Doctor</span><span class="v">${esc(record.doctor || "—")}</span></div>
    <div class="kv"><span class="k">Recorded By</span><span class="v">${esc(record.createdBy || "—")}</span></div>
    ${footHtml(b, b.reportFooter)}`;
  return toDoc(`${record.type} — ${record.patientName}`, body, accent);
}

export function printMedicalRecord(record: MedicalRecord, patient: Patient | null | undefined, settings: Record<string, string> = {}): boolean {
  const doc = buildMedicalRecordHtml(record, patient, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Payment receipt (payments / advances ledger — money in, never deleted) =====
export function buildReceiptHtml(payment: Payment, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">${esc(payment.kind === "Advance" ? "Advance Receipt" : "Payment Receipt")} — ${esc(payment.receiptNo || payment.id)}</div><span class="badge" style="background:#dcfce7;color:#166534">PAID</span></div>
    <div class="pblock">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
        <div class="pname">${esc(payment.patientName || "Patient")}</div>
        ${payment.patientId ? `<div class="puhid">${esc(payment.patientId)}</div>` : ""}
      </div>
      <div class="prow">
        <span><span class="lbl">Amount: </span><strong>₹${(payment.amount ?? 0).toLocaleString("en-IN")}</strong></span>
        <span><span class="lbl">Method: </span><strong>${esc(payment.method || "Cash")}</strong></span>
        <span><span class="lbl">Date: </span><strong>${esc((payment.occurredAt || "").split("T")[0])}</strong></span>
        ${payment.txnRef ? `<span><span class="lbl">Txn: </span><strong>${esc(payment.txnRef)}</strong></span>` : ""}
        ${payment.admissionId ? `<span><span class="lbl">Admission: </span><strong>${esc(payment.admissionId)}</strong></span>` : ""}
        ${payment.receivedBy ? `<span><span class="lbl">Received by: </span><strong>${esc(payment.receivedBy)}</strong></span>` : ""}
      </div>
      ${payment.notes ? `<p class="para">${esc(payment.notes)}</p>` : ""}
    </div>
    ${footHtml(b, b.billFooter)}`;
  return toDoc(`Receipt ${payment.receiptNo || payment.id}`, body, accent);
}

export function printReceipt(payment: Payment, settings: Record<string, string> = {}): boolean {
  const doc = buildReceiptHtml(payment, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Refund advice (reversal workflow — original payment is kept) =====
export function buildRefundHtml(refund: Refund, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">Refund Advice — ${esc(refund.refundNo || refund.id)}</div><span class="badge" style="background:#fef9c3;color:#854d0e">${esc(refund.status)}</span></div>
    <div class="pblock">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
        <div class="pname">${esc(refund.patientName || "Patient")}</div>
        ${refund.patientId ? `<div class="puhid">${esc(refund.patientId)}</div>` : ""}
      </div>
      <div class="prow">
        <span><span class="lbl">Amount: </span><strong>₹${(refund.amount ?? 0).toLocaleString("en-IN")}</strong></span>
        <span><span class="lbl">Method: </span><strong>${esc(refund.method || "Cash")}</strong></span>
        ${refund.reason ? `<span><span class="lbl">Reason: </span><strong>${esc(refund.reason)}</strong></span>` : ""}
        ${refund.admissionId ? `<span><span class="lbl">Admission: </span><strong>${esc(refund.admissionId)}</strong></span>` : ""}
        ${refund.approvedBy ? `<span><span class="lbl">Approved by: </span><strong>${esc(refund.approvedBy)}</strong></span>` : ""}
        ${refund.processedBy ? `<span><span class="lbl">Processed by: </span><strong>${esc(refund.processedBy)}</strong></span>` : ""}
      </div>
    </div>
    ${footHtml(b, b.billFooter)}`;
  return toDoc(`Refund ${refund.refundNo || refund.id}`, body, accent);
}

export function printRefund(refund: Refund, settings: Record<string, string> = {}): boolean {
  const doc = buildRefundHtml(refund, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Complete IPD bill (admission ledger: charges + payments + refunds) =====
export function buildCompleteBillHtml(bill: CompleteBill, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const a: Admission = bill.admission;
  const chargeRows = bill.charges.length
    ? bill.charges.map((c, i) => `<tr><td>${i + 1}. ${esc(c.description)}</td><td style="text-align:center">${esc(c.category)}</td><td style="text-align:center">${c.quantity ?? 1}</td><td style="text-align:right">₹${(c.rate ?? 0).toLocaleString("en-IN")}</td><td style="text-align:right">₹${(c.net ?? 0).toLocaleString("en-IN")}</td></tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888">No charges recorded</td></tr>`;
  const ledgerRows = bill.ledger.length
    ? bill.ledger.map((l) => `<tr><td>${esc((l.date || "").split("T")[0])}</td><td>${esc(l.type)}</td><td>${esc(l.description)}</td><td style="text-align:right">${l.debit > 0 ? `₹${l.debit.toLocaleString("en-IN")}` : "—"}</td><td style="text-align:right">${l.credit > 0 ? `₹${l.credit.toLocaleString("en-IN")}` : "—"}</td><td style="text-align:right"><strong>₹${l.balance.toLocaleString("en-IN")}</strong></td></tr>`).join("")
    : `<tr><td colspan="6" style="text-align:center;color:#888">No ledger entries</td></tr>`;
  const catRows = bill.categoryTotals.map((c) => `<div class="kv"><span class="k">${esc(c.category)}</span><span class="v">₹${c.amount.toLocaleString("en-IN")}</span></div>`).join("");
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">IPD Final Bill — ${esc(a.admissionNo || a.id)}</div><span class="badge" style="background:#e0f2fe;color:#075985">${esc(a.billingStatus)} • ${esc(a.status)}</span></div>
    <div class="pblock">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
        <div class="pname">${esc(a.patientName)}</div><div class="puhid">${esc(a.uhid || a.patientId)}</div>
      </div>
      <div class="prow">
        <span><span class="lbl">Admitted: </span><strong>${esc((a.admissionAt || "").split("T")[0])}</strong></span>
        ${a.dischargeAt ? `<span><span class="lbl">Discharged: </span><strong>${esc(a.dischargeAt.split("T")[0])}</strong></span>` : ""}
        ${a.bedNumber ? `<span><span class="lbl">Bed: </span><strong>${esc(a.bedNumber)}${a.ward ? ` (${esc(a.ward)})` : ""}</strong></span>` : ""}
        ${a.doctorName ? `<span><span class="lbl">Doctor: </span><strong>${esc(a.doctorName)}</strong></span>` : ""}
        ${a.payMode ? `<span><span class="lbl">Pay mode: </span><strong>${esc(a.payMode)}${a.insuranceProvider ? ` • ${esc(a.insuranceProvider)}` : ""}</strong></span>` : ""}
      </div>
    </div>
    <h2>Charges (${bill.charges.length})</h2>
    <table><thead><tr><th>Charge</th><th style="text-align:center">Category</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Net</th></tr></thead><tbody>${chargeRows}</tbody></table>
    ${catRows ? `<h2>Category Totals</h2>${catRows}` : ""}
    <h2>Running Ledger</h2>
    <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th style="text-align:right">Debit</th><th style="text-align:right">Credit</th><th style="text-align:right">Balance</th></tr></thead><tbody>${ledgerRows}</tbody></table>
    <div class="totals">
      <div><span>Gross</span><span>₹${bill.gross.toLocaleString("en-IN")}</span></div>
      <div><span>Discount</span><span>− ₹${bill.discount.toLocaleString("en-IN")}</span></div>
      <div><span>Tax</span><span>+ ₹${bill.tax.toLocaleString("en-IN")}</span></div>
      <div class="grand"><span>Net payable</span><span>₹${bill.netPayable.toLocaleString("en-IN")}</span></div>
      <div><span>Advances</span><span>₹${bill.advancePaid.toLocaleString("en-IN")}</span></div>
      <div><span>Payments</span><span>₹${bill.previousPayments.toLocaleString("en-IN")}</span></div>
      ${bill.refundsTotal > 0 ? `<div><span>Refunds</span><span>₹${bill.refundsTotal.toLocaleString("en-IN")}</span></div>` : ""}
      <div class="grand"><span>Outstanding</span><span>₹${bill.outstanding.toLocaleString("en-IN")}</span></div>
    </div>
    ${footHtml(b, b.billFooter)}`;
  return toDoc(`IPD Bill ${a.admissionNo || a.id}`, body, accent);
}

export function printCompleteBill(bill: CompleteBill, settings: Record<string, string> = {}): boolean {
  const doc = buildCompleteBillHtml(bill, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== Surgery / OT schedule sheet =====
export function buildSurgeryScheduleHtml(s: SurgeryCase, settings: Record<string, string> = {}): ReportDoc {
  const { b, accent } = brandingOf(settings);
  const row = (label: string, value: unknown) =>
    `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(value ?? "—")}</span></div>`;
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">Surgery Schedule — ${esc(s.caseNo || s.id)}</div><span class="badge" style="background:#e0f2fe;color:#075985">${esc(s.status)}</span></div>
    <div class="pblock">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
        <div class="pname">${esc(s.patientName)}</div><div class="puhid">${esc(s.uhid || s.patientId)}</div>
      </div>
      <div class="prow">
        <span><span class="lbl">Surgery: </span><strong>${esc(s.surgeryName)}</strong></span>
        <span><span class="lbl">Planned: </span><strong>${esc(s.plannedDate)} ${esc(s.plannedTime)}</strong></span>
        <span><span class="lbl">Priority: </span><strong>${esc(s.priority)} (${esc(s.kind)})</strong></span>
      </div>
    </div>
    ${row("Department", s.department || "—")}
    ${row("Diagnosis", s.diagnosis || "—")}
    ${row("Surgeon", s.surgeon || "TBD")}
    ${row("Assistant surgeon", s.assistantSurgeon || "—")}
    ${row("Anesthetist", s.anesthetist || "—")}
    ${row("Theatre", s.theatre || "—")}
    ${row("Anesthesia", s.anesthesiaType || "—")}
    ${row("Admission", s.admissionId || "Day-care / OPD")}
    ${row("Bed", s.bedNumber || "—")}
    ${row("Consent", s.consentStatus)}
    ${row("Insurance auth", s.insuranceAuth || "—")}
    ${row("Estimate", s.estimate > 0 ? `₹${s.estimate.toLocaleString("en-IN")}` : "—")}
    ${s.preOpNotes ? `<h2>Pre-op Notes</h2><p class="para">${esc(s.preOpNotes)}</p>` : ""}
    ${s.postOpNotes ? `<h2>Post-op Notes</h2><p class="para">${esc(s.postOpNotes)}</p>` : ""}
    ${s.complications ? `<h2>Complications</h2><div class="note">${esc(s.complications)}</div>` : ""}
    ${footHtml(b, b.reportFooter)}`;
  return toDoc(`Surgery ${s.caseNo || s.id}`, body, accent);
}

export function printSurgerySchedule(s: SurgeryCase, settings: Record<string, string> = {}): boolean {
  const doc = buildSurgeryScheduleHtml(s, settings);
  return openPrintWindow(doc.title, doc.body, doc.accent);
}

// ===== OP summary (patient file: demographics + visits + billing) =====
export function printOPSummary(
  patient: Patient,
  appointments: Appointment[],
  invoices: Invoice[],
  settings: Record<string, string> = {}
): boolean {
  const b = getBranding(settings);
  const row = (label: string, value: unknown) =>
    `<div class="kv"><span class="k">${esc(label)}</span><span class="v">${esc(value)}</span></div>`;
  const visitRows = appointments.length
    ? appointments.map((a) => `<tr><td>${esc(a.date)} ${esc(a.time || "")}</td><td>${esc(a.doctorName || "—")}</td><td>${esc(a.department || a.type || "—")}</td><td>${esc(a.reason || "Visit")}</td><td>${esc(a.status)}</td></tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888">No visits recorded</td></tr>`;
  const totalBilled = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
  const billRows = invoices.length
    ? invoices.map((i) => `<tr><td>${esc(i.invoiceNo)}</td><td>${esc(i.date)}</td><td style="text-align:right">₹${(i.total || 0).toLocaleString("en-IN")}</td><td style="text-align:right">₹${(i.paidAmount || 0).toLocaleString("en-IN")}</td><td>${esc(i.status)}</td></tr>`).join("")
    : `<tr><td colspan="5" style="text-align:center;color:#888">No bills recorded</td></tr>`;
  const body = `${headerHtml(b)}
    <div class="doctype"><div class="dtitle">OP Patient File</div><span class="badge" style="background:#f1f5f8;color:#334155">${esc(patient.status)}</span></div>
    ${patientHtml(patient)}
    <h2>Demographics & Contact</h2>
    <div class="kv"><span class="k">Phone</span><span class="v">${esc(patient.phone || "—")}</span></div>
    <div class="kv"><span class="k">Address</span><span class="v">${esc(patient.address || "—")}</span></div>
    <div class="kv"><span class="k">Emergency Contact</span><span class="v">${esc(patient.emergencyContact || "—")}</span></div>
    <div class="kv"><span class="k">Insurance</span><span class="v">${esc(patient.insuranceProvider ? `${patient.insuranceProvider} (${patient.insurancePolicy})` : "—")}</span></div>
    <div class="kv"><span class="k">Allergies</span><span class="v">${esc(patient.allergies?.join(", ") || "None recorded")}</span></div>
    <div class="kv"><span class="k">Chronic Diseases</span><span class="v">${esc(patient.chronicDiseases?.join(", ") || "None recorded")}</span></div>
    ${row("Registered On", patient.registeredOn || "—")}
    ${row("Last Visit", patient.lastVisit || "—")}
    <h2>Visit History</h2>
    <table><thead><tr><th>Date</th><th>Doctor</th><th>Department</th><th>Reason</th><th>Status</th></tr></thead><tbody>${visitRows}</tbody></table>
    <h2>Billing Summary</h2>
    <table><thead><tr><th>Invoice</th><th>Date</th><th style="text-align:right">Total</th><th style="text-align:right">Paid</th><th>Status</th></tr></thead><tbody>${billRows}</tbody></table>
    <div class="totals">
      <div><span>Total billed</span><span>₹${totalBilled.toLocaleString("en-IN")}</span></div>
      <div><span>Total collected</span><span>₹${totalPaid.toLocaleString("en-IN")}</span></div>
      <div class="grand"><span>Outstanding</span><span>₹${Math.max(0, totalBilled - totalPaid).toLocaleString("en-IN")}</span></div>
    </div>
    ${footHtml(b, b.reportFooter)}`;
  return openPrintWindow(`OP File — ${patient.name}`, body, b.accent);
}
