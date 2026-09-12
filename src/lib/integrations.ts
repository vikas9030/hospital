// Central catalogue for Settings → Integrations.
// Non-secret values live in app_settings and are visible to the browser via
// GET /api/settings. Secrets (tokens, API keys) are write-only from the
// browser — the GET route strips them — but server routes read them directly
// via fetchAppSettings(), so test/send calls work.

export type IntegrationId =
  | "whatsapp"
  | "sms"
  | "email"
  | "payment"
  | "gcal"
  | "video";

export interface IntegrationMeta {
  id: IntegrationId;
  name: string;
  desc: string;
  docsUrl?: string;
}

export const INTEGRATIONS: IntegrationMeta[] = [
  { id: "whatsapp", name: "WhatsApp Business", desc: "Meta Cloud API appointment & report alerts" },
  { id: "sms", name: "SMS Gateway", desc: "Twilio / MSG91 OTP & reminder SMS" },
  { id: "email", name: "Email SMTP", desc: "SendGrid / SMTP receipts & reports" },
  { id: "payment", name: "Payment Gateway", desc: "Razorpay UPI online checkout" },
  { id: "gcal", name: "Google Calendar", desc: "Sync appointments to a calendar" },
  { id: "video", name: "Video Consultation", desc: "Jitsi / Zoom visit links" },
];

// ---- setting keys ----
export const INT_KEYS = {
  whatsapp: ["int_whatsapp_enabled", "int_whatsapp_phoneId", "int_whatsapp_token", "int_whatsapp_template", "int_whatsapp_lastTest"],
  sms: ["int_sms_enabled", "int_sms_provider", "int_sms_sid", "int_sms_token", "int_sms_from", "int_sms_sender", "int_sms_lastTest"],
  email: ["int_email_enabled", "int_email_provider", "int_email_apiKey", "int_email_from", "int_email_fromName", "int_email_lastTest"],
  gcal: ["int_gcal_enabled", "int_gcal_calendarId", "int_gcal_clientId", "int_gcal_lastSync", "int_gcal_lastTest"],
  video: ["int_video_enabled", "int_video_provider", "int_video_apiKey", "int_video_lastTest"],
} as Record<string, string[]>;

export function integrationStatus(
  id: IntegrationId,
  settings: Record<string, string>
): { state: "Connected" | "Disabled" | "Not Connected"; enabled: boolean; configured: boolean; lastTest?: string } {
  if (id === "payment") {
    const mode = settings.razorpayMode ?? "disabled";
    const keyId = (settings.razorpayKeyId ?? "").trim();
    const enabled = mode !== "disabled";
    const configured = enabled && keyId.length > 0;
    return {
      state: configured ? "Connected" : enabled ? "Not Connected" : "Disabled",
      enabled,
      configured,
    };
  }
  const enabled = (settings[`int_${id}_enabled`] ?? "false") === "true";
  let configured = false;
  if (id === "whatsapp") configured = !!(settings.int_whatsapp_phoneId ?? "").trim();
  if (id === "sms") configured = !!((settings.int_sms_from ?? "").trim() || (settings.int_sms_sender ?? "").trim());
  if (id === "email") configured = !!((settings.int_email_from ?? "").trim());
  if (id === "gcal") configured = !!((settings.int_gcal_calendarId ?? "").trim() || (settings.int_gcal_clientId ?? "").trim());
  if (id === "video") configured = true; // Jitsi works with zero keys
  const lastTest = settings[`int_${id}_lastTest`];
  return {
    state: configured && enabled ? "Connected" : !enabled && configured ? "Disabled" : "Not Connected",
    enabled,
    configured,
    lastTest,
  };
}

export async function logIntegrationAudit(entry: {
  actor: string;
  actorEmail?: string;
  action: string;
  branch?: string;
  details: string;
}) {
  try {
    await fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actor: entry.actor,
        actorEmail: entry.actorEmail ?? entry.actor,
        action: entry.action,
        target: "integrations",
        branch: entry.branch ?? "",
        details: entry.details,
      }),
    });
  } catch {
    // Audit is best-effort.
  }
}
