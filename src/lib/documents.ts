import type { Appointment, Invoice, LabTest, MedicalRecord, Patient, RadiologyOrder } from "@/lib/types";

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
