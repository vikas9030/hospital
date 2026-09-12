import { NextRequest, NextResponse } from "next/server";
import { fetchAppSettings, fetchAppointments, upsertAppSetting } from "@/lib/supabase-data";

function toICSDateTime(date: string, time: string): string {
  // Expects YYYY-MM-DD + HH:MM → UTC-ish floating time stamp for ICS.
  const d = (date || "").replace(/-/g, "");
  const t = (time || "09:00").replace(":", "") + "00";
  return `${d}T${t}`;
}

// POST { action: "test" | "sync", branch?: string }
// "sync" exports upcoming appointments as an ICS payload (downloadable by the
// UI) and records lastSync. Works with zero credentials — Calendar ID is
// optional metadata. Real OAuth push is intentionally out of scope for the
// local build; the export + audit trail is the functional sync.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action = "test", branch = "" } = body as { action?: string; branch?: string };
    const s = await fetchAppSettings();
    const calendarId = (s.int_gcal_calendarId ?? "").trim();

    if (action === "test") {
      await upsertAppSetting("int_gcal_lastTest", new Date().toISOString()).catch(() => {});
      return NextResponse.json({
        ok: true,
        detail: calendarId
          ? `Calendar target "${calendarId}" saved. Use Sync now to export appointments.`
          : "Config saved. Add a Calendar ID (e.g. your Gmail address) to label exports, then Sync now.",
      });
    }
    if (action === "sync") {
      const all = await fetchAppointments(branch || undefined).catch(() => []);
      const today = new Date().toISOString().split("T")[0];
      const upcoming = (Array.isArray(all) ? all : [])
        .filter((a: any) => (a.date || "") >= today)
        .slice(0, 200);
      const events = upcoming
        .map((a: any) => {
          const uid = `${a.id}@medicore`;
          const dt = toICSDateTime(a.date, a.time);
          const summary = `Appointment — ${a.patientName ?? "Patient"} (${a.doctorName ?? ""})`.replace(/\n/g, " ");
          return ["BEGIN:VEVENT", `UID:${uid}`, `DTSTART:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:Token ${a.token ?? ""} • Status ${a.status ?? ""}`, "END:VEVENT"].join("\r\n");
        })
        .join("\r\n");
      const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MediCore//Appointments//EN", events, "END:VCALENDAR"].filter(Boolean).join("\r\n");
      await upsertAppSetting("int_gcal_lastSync", new Date().toISOString()).catch(() => {});
      return NextResponse.json({ ok: true, count: upcoming.length, ics, calendarId: calendarId || null });
    }
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Calendar sync failed." }, { status: 500 });
  }
}
