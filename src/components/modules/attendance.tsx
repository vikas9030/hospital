"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import {
  Fingerprint, LogIn, LogOut, MonitorSmartphone, ClipboardList,
  CalendarDays, Download, Search, AlertTriangle, Trash2, Users, Pencil, Wifi, WifiOff,
} from "lucide-react";
import { canManageAttendance, isAdmin, samePerson } from "@/lib/utils";
import type { AttendanceRecord, StaffMember } from "@/lib/types";

type Tab = "myday" | "history" | "kiosk" | "register" | "records" | "monthly";

const STATUSES: AttendanceRecord["status"][] = ["Present", "Absent", "Leave", "Half Day", "Holiday", "Week Off"];

const nowTime = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const todayStr = () => new Date().toISOString().split("T")[0];

function statusBadge(status: AttendanceRecord["status"]) {
  if (status === "Present") return "bg-success/15 text-success border-success/30";
  if (status === "Half Day") return "bg-info/10 text-info border-info/30";
  if (status === "Leave" || status === "Holiday" || status === "Week Off") return "bg-muted text-muted-foreground";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

export function AttendanceModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const updateStaffMember = useAppStore((s) => s.updateStaffMember);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const { staffMembers, branch } = useBranchData();
  const { toast } = useToast();

  const admin = isAdmin(currentUser.role);
  const manager = canManageAttendance(currentUser.role);

  const [tab, setTab] = useState<Tab>("myday");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [backendOn, setBackendOn] = useState(false);
  const [loadTick, setLoadTick] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [regDate, setRegDate] = useState(todayStr());
  const [drafts, setDrafts] = useState<Record<string, { status: AttendanceRecord["status"]; checkIn: string; checkOut: string }>>({});
  const [savingReg, setSavingReg] = useState(false);
  const [fromDate, setFromDate] = useState(() => todayStr().slice(0, 7) + "-01");
  const [toDate, setToDate] = useState(() => todayStr());
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(() => todayStr().slice(0, 7));
  const [histMonth, setHistMonth] = useState(() => todayStr().slice(0, 7));
  const [kioskId, setKioskId] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AttendanceRecord | null>(null);
  const [editTarget, setEditTarget] = useState<AttendanceRecord | null>(null);
  const [editForm, setEditForm] = useState({ status: "Present" as AttendanceRecord["status"], checkIn: "", checkOut: "", notes: "" });

  // ---- backend load (staff_attendance table) ----
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        setLoadError("");
        const r = await fetch(`/api/attendance?branch=${encodeURIComponent(branch || "")}`);
        if (!r.ok) throw new Error(`Server ${r.status}`);
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setRecords(data);
          setBackendOn(true);
        }
      } catch (e: any) {
        if (live) {
          setBackendOn(false);
          setLoadError(e.message || "Could not reach the attendance table.");
        }
      }
    })();
    return () => { live = false; };
  }, [branch, loadTick]);
  const reloadRecords = () => setLoadTick((t) => t + 1);

  // ---- clinic WiFi gate ----
  // Presence punches need the device on the branch's saved clinic network
  // (Admin → Settings → Network & WiFi). The server re-verifies every punch.
  const [netStatus, setNetStatus] = useState<{ verified: boolean; enforced: boolean; ip: string; reason: string } | null>(null);
  const checkNetwork = async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/network-check?branch=${encodeURIComponent(branch || "")}`);
      if (!res.ok) return true; // check unavailable → let the server decide
      const data = await res.json();
      setNetStatus({ verified: !!data.verified, enforced: !!data.enforced, ip: data.ip ?? "", reason: data.reason ?? "" });
      if (data.enforced && !data.verified) {
        toast({ title: "Not on clinic WiFi", description: data.reason || "Connect to the clinic WiFi to mark attendance.", variant: "destructive" });
        return false;
      }
      return true;
    } catch {
      return true; // offline check → server decides on submit
    }
  };
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch(`/api/network-check?branch=${encodeURIComponent(branch || "")}`);
        if (!res.ok || !live) return;
        const data = await res.json();
        setNetStatus({ verified: !!data.verified, enforced: !!data.enforced, ip: data.ip ?? "", reason: data.reason ?? "" });
      } catch {
        // Status banner stays hidden; the server still gates every punch.
      }
    })();
    return () => { live = false; };
  }, [branch]);

  const myStaff: StaffMember | undefined = useMemo(
    () => staffMembers.find((s) => (s.email || "").toLowerCase() === (currentUser.email || "").toLowerCase()),
    [staffMembers, currentUser.email]
  );

  // Own rows: staff-id match first, tolerant name match as fallback
  // (covers punches saved before a staff re-import changed ids).
  const isMine = (r: AttendanceRecord) =>
    !!myStaff && (r.staffId === myStaff.id || samePerson(r.staffName, myStaff.name));
  const byDay = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of records) map.set(`${r.staffId}|${r.date}`, r);
    return map;
  }, [records]);

  const audit = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "attendance", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "attendance", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };

  const saveRow = async (row: Omit<AttendanceRecord, "id"> & { id?: string }): Promise<AttendanceRecord | null> => {
    if (!backendOn) {
      toast({ title: "Attendance table offline", description: "Run migration 023_staff_attendance.sql first.", variant: "destructive" });
      return null;
    }
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id || `att${Date.now()}`, ...row }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
      const saved = await res.json();
      setRecords((prev) => {
        const rest = prev.filter((r) => !(r.staffId === saved.staffId && r.date === saved.date));
        return [saved, ...rest];
      });
      return saved;
    } catch (e: any) {
      toast({ title: "Could not save attendance", description: e.message, variant: "destructive" });
      return null;
    }
  };

  // ---- monthly % → Staff table bars ----
  const monthPercent = (staffId: string, monthKey: string): number | null => {
    const rows = records.filter((r) => r.staffId === staffId && (r.date || "").startsWith(monthKey));
    if (rows.length === 0) return null;
    const [y, m] = monthKey.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const elapsed = monthKey === todayStr().slice(0, 7) ? Math.min(new Date().getDate(), dim) : dim;
    if (elapsed <= 0) return null;
    const equiv = rows.reduce((s, r) => s + (r.status === "Present" ? 1 : r.status === "Half Day" ? 0.5 : 0), 0);
    return Math.round((equiv / elapsed) * 100);
  };

  const syncPercent = async (staffId: string, staffName: string) => {
    const pct = monthPercent(staffId, todayStr().slice(0, 7));
    if (pct === null) return;
    updateStaffMember(staffId, { attendance: pct });
    try {
      await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staffId, attendance: pct }),
      });
    } catch {
      // Local % stands; server sync is best-effort.
    }
  };

  // ---- My Day (self punch) ----
  const myToday = myStaff ? records.find((r) => r.date === todayStr() && isMine(r)) : undefined;
  const punchSelf = async (kind: "in" | "out") => {
    if (!myStaff) {
      toast({ title: "No staff profile", description: "Your login email is not linked to a staff record.", variant: "destructive" });
      return;
    }
    if (!(await checkNetwork())) return;
    const saved = await saveRow({
      id: myToday?.id,
      staffId: myStaff.id,
      staffName: myStaff.name,
      date: todayStr(),
      checkIn: kind === "in" ? nowTime() : myToday?.checkIn || nowTime(),
      checkOut: kind === "out" ? nowTime() : myToday?.checkOut || "",
      status: "Present",
      mode: "Kiosk",
      markedBy: `${currentUser.name} (self)`,
      branch,
    });
    if (saved) {
      audit("ATTENDANCE_SELF", `${myStaff.name} checked ${kind === "in" ? "in" : "out"} at ${kind === "in" ? saved.checkIn : saved.checkOut}.`);
      toast({ title: kind === "in" ? "Checked in" : "Checked out", description: `${myStaff.name} • ${kind === "in" ? saved.checkIn : saved.checkOut}` });
      void syncPercent(myStaff.id, myStaff.name);
    }
  };

  // ---- Kiosk / device punch ----
  const kioskStaff = staffMembers.find((s) => s.id === kioskId);
  const kioskToday = kioskStaff ? byDay.get(`${kioskStaff.id}|${todayStr()}`) : undefined;
  const punchKiosk = async (kind: "in" | "out") => {
    if (!kioskStaff) {
      toast({ title: "Pick staff", description: "Select who is punching.", variant: "destructive" });
      return;
    }
    if (!(await checkNetwork())) return;
    const saved = await saveRow({
      id: kioskToday?.id,
      staffId: kioskStaff.id,
      staffName: kioskStaff.name,
      date: todayStr(),
      checkIn: kind === "in" ? nowTime() : kioskToday?.checkIn || nowTime(),
      checkOut: kind === "out" ? nowTime() : kioskToday?.checkOut || "",
      status: "Present",
      mode: "Device",
      markedBy: `${currentUser.name} (kiosk)`,
      branch,
    });
    if (saved) {
      audit("ATTENDANCE_KIOSK", `${kioskStaff.name} device-checked ${kind === "in" ? "in" : "out"} at ${kind === "in" ? saved.checkIn : saved.checkOut} (by ${currentUser.name}).`);
      toast({ title: `${kioskStaff.name} ${kind === "in" ? "checked in" : "checked out"}`, description: kind === "in" ? saved.checkIn : saved.checkOut });
      void syncPercent(kioskStaff.id, kioskStaff.name);
    }
  };

  // ---- Register (HR/Admin bulk mark) ----
  // Drafts fall back to the saved row (or Present) — no effect needed.
  const draftOf = (s: StaffMember) =>
    drafts[s.id] ?? (() => {
      const ex = byDay.get(`${s.id}|${regDate}`);
      return { status: ex?.status ?? "Present" as AttendanceRecord["status"], checkIn: ex?.checkIn ?? "", checkOut: ex?.checkOut ?? "" };
    })();
  const setDraft = (s: StaffMember, d: { status: AttendanceRecord["status"]; checkIn: string; checkOut: string }) =>
    setDrafts((p) => ({ ...p, [s.id]: d }));

  const saveRegister = async () => {
    if (!manager) return;
    setSavingReg(true);
    try {
      let n = 0;
      let skipped = 0;
      for (const s of staffMembers) {
        const d = draftOf(s);
        if (!d) continue;
        const ex = byDay.get(`${s.id}|${regDate}`);
        // HR fills blanks only; Admin may correct existing rows.
        if (ex && !admin) {
          skipped++;
          continue;
        }
        const unchanged = ex && ex.status === d.status && (ex.checkIn || "") === d.checkIn && (ex.checkOut || "") === d.checkOut;
        if (unchanged) continue;
        const saved = await saveRow({
          id: ex?.id,
          staffId: s.id,
          staffName: s.name,
          date: regDate,
          checkIn: d.checkIn,
          checkOut: d.checkOut,
          status: d.status,
          mode: "Manual",
          markedBy: currentUser.name,
          branch,
        });
        if (saved) {
          n++;
          void syncPercent(s.id, s.name);
        }
      }
      audit("ATTENDANCE_REGISTER", `${currentUser.name} saved attendance for ${regDate} (${n} row(s) changed${skipped ? `, ${skipped} existing skipped` : ""}).`);
      toast({ title: "Register saved", description: `${n} row(s) saved for ${regDate}${skipped ? ` • ${skipped} existing row(s) kept (Admin can edit them)` : ""}.` });
    } finally {
      setSavingReg(false);
    }
  };

  const openEdit = (r: AttendanceRecord) => {
    setEditTarget(r);
    setEditForm({ status: r.status, checkIn: r.checkIn || "", checkOut: r.checkOut || "", notes: r.notes || "" });
  };

  const saveEdit = async () => {
    if (!editTarget || !admin) return;
    const saved = await saveRow({
      id: editTarget.id,
      staffId: editTarget.staffId,
      staffName: editTarget.staffName,
      date: editTarget.date,
      checkIn: editForm.checkIn,
      checkOut: editForm.checkOut,
      status: editForm.status,
      mode: editTarget.mode,
      markedBy: `${currentUser.name} (correction)`,
      branch,
    });
    if (saved) {
      audit("ATTENDANCE_EDIT", `${currentUser.name} corrected ${saved.staffName}'s ${saved.date} record → ${saved.status} (in ${saved.checkIn || "—"}, out ${saved.checkOut || "—"}).`);
      toast({ title: "Record corrected" });
      setEditTarget(null);
      void syncPercent(saved.staffId, saved.staffName);
    }
  };

  // ---- Records list ----
  const listed = records.filter((r) => {
    if (!manager && myStaff && !isMine(r)) return false;
    if (r.date < fromDate || r.date > toDate) return false;
    if (statusFilter !== "All" && r.status !== statusFilter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${r.staffName} ${r.markedBy} ${r.notes ?? ""}`.toLowerCase().includes(q);
  }).sort((a, b) => (`${b.date}${b.checkIn || ""}`).localeCompare(`${a.date}${a.checkIn || ""}`));

  const todayRows = records.filter((r) => r.date === todayStr());
  const presentToday = todayRows.filter((r) => r.status === "Present").length;
  const absentToday = todayRows.filter((r) => r.status === "Absent").length;
  const leaveToday = todayRows.filter((r) => r.status === "Leave" || r.status === "Half Day").length;

  const monthRows = records.filter((r) => (r.date || "").startsWith(month));
  const toMin = (t: string) => {
    const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  };
  const minToStr = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(Math.round(mins % 60)).padStart(2, "0")}`;
  const dayNo = (d: string) => (d || "").slice(8, 10);
  const summary = staffMembers.map((s) => {
      const rows = monthRows.filter((r) => r.staffId === s.id);
      const datesOf = (st: AttendanceRecord["status"]) =>
        rows.filter((r) => r.status === st).map((r) => r.date).sort();
      const p = rows.filter((r) => r.status === "Present").length;
      const a = rows.filter((r) => r.status === "Absent").length;
      const l = rows.filter((r) => r.status === "Leave").length;
      const h = rows.filter((r) => r.status === "Half Day").length;
      const presentDates = datesOf("Present");
      const absentDates = datesOf("Absent");
      const leaveDates = datesOf("Leave");
      const halfDates = datesOf("Half Day");
    const pct = monthPercent(s.id, month);
    const ins = rows.map((r) => toMin(r.checkIn || "")).filter((x): x is number => x !== null);
    const avgIn = ins.length ? minToStr(ins.reduce((x, y) => x + y, 0) / ins.length) : "—";
    const hours = rows.reduce((sum, r) => {
      const aMin = toMin(r.checkIn || "");
      const bMin = toMin(r.checkOut || "");
      return aMin !== null && bMin !== null && bMin > aMin ? sum + (bMin - aMin) / 60 : sum;
    }, 0);
      return { staff: s, p, a, l, h, pct, avgIn, hours, presentDates, absentDates, leaveDates, halfDates };
    });

  // Printable monthly muster: staff × day grid (P/A/L/H/O/W) + date lists.
  const printMonthlyReport = () => {
    if (summary.length === 0) {
      toast({ title: "Nothing to print", description: "No staff in this branch.", variant: "destructive" });
      return;
    }
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const [y, m] = month.split("-").map(Number);
    const dim = new Date(y, m, 0).getDate();
    const monthName = new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const letter = (st?: string) =>
      st === "Present" ? "P" : st === "Absent" ? "A" : st === "Leave" ? "L" :
      st === "Half Day" ? "H" : st === "Holiday" ? "O" : st === "Week Off" ? "W" : "–";
    const cellColor = (st?: string) =>
      st === "Present" ? "#dcfce7" : st === "Absent" ? "#fee2e2" : st === "Leave" ? "#fef3c7" :
      st === "Half Day" ? "#dbeafe" : "transparent";
    const days = Array.from({ length: dim }, (_, i) => i + 1);
    const byDayMap = new Map<string, string>();
    for (const r of monthRows) byDayMap.set(`${r.staffId}|${r.date}`, r.status);
    const body = summary.map((x, i) => {
      const cells = days.map((d) => {
        const key = `${month}-${String(d).padStart(2, "0")}`;
        const st = byDayMap.get(`${x.staff.id}|${key}`);
        return `<td style="border:1px solid #e5e7eb;text-align:center;font-size:9px;font-weight:700;background:${cellColor(st)};padding:3px 1px;min-width:20px">${letter(st)}</td>`;
      }).join("");
      return `<tr><td style="border:1px solid #e5e7eb;padding:4px 6px;font-size:11px;white-space:nowrap">${i + 1}. ${esc(x.staff.name)}<br><span style="color:#6b7280;font-size:9px">${esc(x.staff.role)}</span></td>${cells}
        <td style="border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:700">${x.p}</td>
        <td style="border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:700">${x.a}</td>
        <td style="border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:700">${x.l}</td>
        <td style="border:1px solid #e5e7eb;text-align:center;font-size:10px;font-weight:700">${x.h}</td></tr>
        <tr><td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:9px;color:#374151;background:#f9fafb" colspan="${dim + 5}">
          <strong>Came:</strong> ${x.presentDates.length ? esc(x.presentDates.join(", ")) : "—"} &nbsp;•&nbsp;
          <strong>Leave:</strong> ${x.leaveDates.length ? esc(x.leaveDates.join(", ")) : "—"}${x.absentDates.length ? ` &nbsp;•&nbsp; <strong>Absent:</strong> ${esc(x.absentDates.join(", "))}` : ""}${x.halfDates.length ? ` &nbsp;•&nbsp; <strong>Half-day:</strong> ${esc(x.halfDates.join(", "))}` : ""}</td></tr>`;
    }).join("");
    const win = window.open("", "_blank", "width=1100,height=800");
    if (!win) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups to print the monthly report.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Attendance ${esc(month)}</title>
    <style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#111827;padding:24px;margin:0 auto}@page{size:landscape}table{width:100%;border-collapse:collapse;margin:12px 0}th{background:#f3f4f6;padding:4px 1px;border:1px solid #e5e7eb;font-size:9px}.legend{font-size:11px;color:#374151}@media print{body{padding:0}}</style></head><body>
    <h2 style="margin:0">Monthly Attendance — ${esc(monthName)}</h2>
    <p style="color:#6b7280;font-size:12px;margin:4px 0 0">Branch: ${esc(branch)} • Generated ${esc(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }))}</p>
    <p class="legend">P = Present • A = Absent • L = Leave • H = Half Day • O = Holiday • W = Week Off • – = no record</p>
    <table><thead><tr><th style="text-align:left;padding:4px 6px">Staff</th>${days.map((d) => `<th>${d}</th>`).join("")}<th>P</th><th>A</th><th>L</th><th>H</th></tr></thead><tbody>${body}</tbody></table>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const tabs: { id: Tab; label: string; mgr?: boolean }[] = [
    { id: "myday", label: "My Day" },
    { id: "history", label: "My History" },
    { id: "kiosk", label: "Kiosk / Device", mgr: true },
    { id: "register", label: "Register", mgr: true },
    { id: "records", label: "Records" },
    { id: "monthly", label: "Monthly", mgr: true },
  ];

  // HR/Admin import-export: Template + Export + Import. Import resolves staff
  // by staff-ID, email or name and upserts (same staff+day updates in place).
  const attendanceIO: EntityIOConfig<AttendanceRecord> = {
    entity: "attendance records",
    filename: "attendance",
    columns: [
      { header: "staffId", sample: "MC-26-00001" },
      { header: "staffName", sample: "Ravi Kumar" },
      { header: "date", sample: new Date().toISOString().split("T")[0] },
      { header: "checkIn", sample: "09:00" },
      { header: "checkOut", sample: "17:00" },
      { header: "status", sample: "Present" },
      { header: "notes", sample: "" },
    ],
    toRow: (r) => [r.staffId, r.staffName, r.date, r.checkIn || "", r.checkOut || "", r.status, r.notes || ""],
    fromRow: (row, i) => {
      const key = (row.staffId || "").trim().toLowerCase();
      const staff = staffMembers.find(
        (s) =>
          s.id.toLowerCase() === key ||
          (s.staffId || "").toLowerCase() === key ||
          (s.email || "").toLowerCase() === key ||
          samePerson(s.name, row.staffName || "")
      );
      if (!staff) throw new Error(`unknown staff "${row.staffId || row.staffName}". Use staff-ID, email or exact name.`);
      if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date.trim())) throw new Error("date must be YYYY-MM-DD.");
      const valid = ["Present", "Absent", "Leave", "Half Day", "Holiday", "Week Off"];
      return {
        id: `att${Date.now()}${i}`,
        staffId: staff.id,
        staffName: staff.name,
        date: row.date.trim(),
        checkIn: (row.checkIn || "").trim(),
        checkOut: (row.checkOut || "").trim(),
        status: valid.includes(row.status) ? row.status : "Present",
        mode: "Manual",
        markedBy: `${currentUser.name} (import)`,
        notes: row.notes || "",
        branch,
      };
    },
    endpoint: "/api/attendance",
    onImported: (saved) => {
      setRecords((prev) => {
        const rest = prev.filter((r) => !(r.staffId === saved.staffId && r.date === saved.date));
        return [saved, ...rest];
      });
      void syncPercent(saved.staffId, saved.staffName);
    },
  };

  // Personal all-months history (every staff member, own rows only).
  const myHistRows = useMemo(() => {
    if (!myStaff) return [];
    return records
      .filter((r) => isMine(r) && (r.date || "").startsWith(histMonth))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [records, myStaff, histMonth, backendOn]);
  const myHistPct = myStaff ? monthPercent(myStaff.id, histMonth) : null;

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Attendance"
        description={manager ? "Self punch, device kiosk, HR register, records and monthly summary." : "Punch your check-in/out and review your record."}
        icon={Fingerprint}
      />

        {!backendOn && (
          <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex flex-wrap items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs flex-1 min-w-[200px]">
              Attendance table is not reachable{loadError ? ` (${loadError})` : ""} — run <span className="font-mono">supabase/migrations/023_staff_attendance.sql</span> in Supabase for database storage.
            </p>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={reloadRecords}>Retry</Button>
          </div>
        )}

        {netStatus && (
          <div className={`rounded-xl border p-3 flex flex-wrap items-center gap-2 ${netStatus.enforced && !netStatus.verified ? "border-destructive/40 bg-destructive/5" : "border-success/30 bg-success/5"}`}>
            {netStatus.enforced && !netStatus.verified ? <WifiOff className="h-4 w-4 text-destructive shrink-0" /> : <Wifi className="h-4 w-4 text-success shrink-0" />}
            <p className="text-xs flex-1 min-w-[200px]">
              {netStatus.enforced
                ? (netStatus.verified
                  ? `On clinic WiFi (${netStatus.ip || "verified"}) — punching allowed.`
                  : `Off clinic network — ${netStatus.reason || "punching blocked until you join clinic WiFi."}`)
                : "No clinic IP restriction configured — punching allowed from anywhere."}
            </p>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => checkNetwork()}>Recheck</Button>
          </div>
        )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Present Today" value={String(presentToday)} icon={Users} color="success" subtitle={`${todayRows.length} marked`} />
        <StatCard title="Absent Today" value={String(absentToday)} icon={LogOut} color="destructive" />
        <StatCard title="Leave / Half Day" value={String(leaveToday)} icon={CalendarDays} color="warning" />
        <StatCard title="Staff Strength" value={String(staffMembers.length)} icon={ClipboardList} color="primary" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.filter((t) => !t.mgr || manager).map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} className="text-xs" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "myday" && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-4 sm:p-6 text-center space-y-3">
            <Fingerprint className="h-10 w-10 mx-auto text-primary" />
            {!myStaff ? (
              <p className="text-xs text-muted-foreground">Your login is not linked to a staff record — ask HR to match your email.</p>
            ) : (
              <>
                <p className="text-sm font-semibold">{myStaff.name} <span className="font-normal text-muted-foreground">• {myStaff.role} • {myStaff.shift} shift</span></p>
                {myToday ? (
                  <div className="flex flex-wrap justify-center gap-2 text-xs">
                    <Badge variant="outline" className={statusBadge(myToday.status)}>{myToday.status}</Badge>
                    {myToday.checkIn && <Badge variant="outline">In {myToday.checkIn}</Badge>}
                    {myToday.checkOut && <Badge variant="outline">Out {myToday.checkOut}</Badge>}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Not marked today yet.</p>
                )}
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={() => punchSelf("in")} disabled={!!myToday?.checkIn}><LogIn className="h-3.5 w-3.5 mr-1.5" /> Check In{myToday?.checkIn ? ` (${myToday.checkIn})` : ""}</Button>
                  <Button size="sm" variant="outline" onClick={() => punchSelf("out")} disabled={!myToday?.checkIn || !!myToday?.checkOut}><LogOut className="h-3.5 w-3.5 mr-1.5" /> Check Out{myToday?.checkOut ? ` (${myToday.checkOut})` : ""}</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "history" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            {!myStaff ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Your login is not linked to a staff record — ask HR to match your email.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <Input type="month" className="h-9 text-xs w-[160px]" value={histMonth} onChange={(e) => setHistMonth(e.target.value)} />
                  <div className="flex gap-2 text-[11px]">
                    <span className="rounded-full bg-success/15 text-success px-2 py-0.5 font-semibold">{myHistRows.filter((r) => r.status === "Present").length} Present</span>
                    <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-semibold">{myHistRows.filter((r) => r.status === "Absent").length} Absent</span>
                    <span className="rounded-full bg-warning/15 text-warning px-2 py-0.5 font-semibold">{myHistRows.filter((r) => r.status === "Leave").length} Leave</span>
                    <span className="rounded-full bg-info/10 text-info px-2 py-0.5 font-semibold">{myHistRows.filter((r) => r.status === "Half Day").length} Half</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{myHistPct === null ? "—" : `${myHistPct}%`}</span>
                  </div>
                </div>
                {myHistRows.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <p className="text-xs text-muted-foreground">
                      {loadError ? `Could not load attendance (${loadError}).` : "No attendance recorded for this month."}
                    </p>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={reloadRecords}>Reload from database</Button>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                    {myHistRows.map((r) => (
                      <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{r.date}</p>
                          <p className="text-[11px] text-muted-foreground">In {r.checkIn || "—"} • Out {r.checkOut || "—"} • {r.mode}</p>
                        </div>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${statusBadge(r.status)}`}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "kiosk" && manager && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> Device Kiosk</CardTitle>
            <CardDescription className="text-xs">Front-desk punch — mechanical style: pick staff, tap, timestamp is automatic.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={kioskId} onValueChange={setKioskId}>
              <SelectTrigger className="h-10 max-w-sm"><SelectValue placeholder="Select staff member…" /></SelectTrigger>
              <SelectContent>{staffMembers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} • {s.role} • {s.staffId}</SelectItem>)}</SelectContent>
            </Select>
            {kioskToday && (
              <div className="flex gap-2 text-xs">
                <Badge variant="outline" className={statusBadge(kioskToday.status)}>{kioskToday.status}</Badge>
                {kioskToday.checkIn && <Badge variant="outline">In {kioskToday.checkIn}</Badge>}
                {kioskToday.checkOut && <Badge variant="outline">Out {kioskToday.checkOut}</Badge>}
              </div>
            )}
            <div className="flex gap-2">
              <Button className="flex-1 h-14 text-base" onClick={() => punchKiosk("in")} disabled={!kioskStaff || !!kioskToday?.checkIn}><LogIn className="h-5 w-5 mr-2" /> CHECK IN</Button>
              <Button variant="outline" className="flex-1 h-14 text-base" onClick={() => punchKiosk("out")} disabled={!kioskStaff || !kioskToday?.checkIn || !!kioskToday?.checkOut}><LogOut className="h-5 w-5 mr-2" /> CHECK OUT</Button>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs font-semibold">Today&apos;s punches</p>
              {todayRows.length === 0 && <p className="text-[11px] text-muted-foreground">Nobody punched yet today.</p>}
              {todayRows.slice(0, 10).map((r) => (
                <p key={r.id} className="text-[11px] text-muted-foreground rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <span className="font-semibold text-foreground">{r.staffName}</span> — In {r.checkIn || "—"} • Out {r.checkOut || "—"} • {r.status} • {r.mode}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "register" && manager && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Input type="date" className="h-9 text-xs w-[160px]" value={regDate} max={todayStr()} onChange={(e) => setRegDate(e.target.value)} />
              <Button size="sm" variant="outline" className="h-9 text-[11px]" onClick={() => {
                const next: typeof drafts = {};
                for (const s of staffMembers) {
                  const cur = draftOf(s);
                  next[s.id] = { status: "Present", checkIn: cur.checkIn, checkOut: cur.checkOut };
                }
                setDrafts(next);
              }}>Mark all Present</Button>
              <Button size="sm" className="h-9 text-[11px] ml-auto" disabled={savingReg} onClick={saveRegister}>{savingReg ? "Saving…" : `Save Register (${regDate})`}</Button>
            </div>
            {!admin && <p className="text-[11px] text-muted-foreground mb-2">HR fills unmarked staff only — rows already saved stay untouched. Corrections are Admin-only (Records → pencil).</p>}
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {staffMembers.map((s) => {
                const d = draftOf(s);
                const saved = byDay.get(`${s.id}|${regDate}`);
                return (
                  <div key={s.id} className="rounded-lg border p-2.5 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold truncate flex-1">{s.name} <span className="font-normal text-muted-foreground">• {s.role}</span></p>
                      {saved && <Badge variant="outline" className={`text-[10px] ${statusBadge(saved.status)}`}>Saved</Badge>}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <Select value={d.status} onValueChange={(v) => setDraft(s, { ...d, status: v as AttendanceRecord["status"] })}>
                        <SelectTrigger className="h-8 text-[11px] col-span-3"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((st) => <SelectItem key={st} value={st}>{st}</SelectItem>)}</SelectContent>
                      </Select>
                      <div className="col-span-3 grid grid-cols-2 gap-1.5">
                        <div className="space-y-0.5"><Label className="text-[10px]">In</Label><Input type="time" className="h-8 text-[11px]" value={d.checkIn} onChange={(e) => setDraft(s, { ...d, checkIn: e.target.value })} /></div>
                        <div className="space-y-0.5"><Label className="text-[10px]">Out</Label><Input type="time" className="h-8 text-[11px]" value={d.checkOut} onChange={(e) => setDraft(s, { ...d, checkOut: e.target.value })} /></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {staffMembers.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No staff in this branch.</p>}
          </CardContent>
        </Card>
      )}

      {tab === "records" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="relative flex-1 min-w-[160px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search staff…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <Input type="date" className="h-9 text-xs w-[150px]" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <Input type="date" className="h-9 text-xs w-[150px]" value={toDate} min={fromDate} onChange={(e) => setToDate(e.target.value)} />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All statuses</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              {manager && <ImportExportButtons config={attendanceIO} items={listed} compact />}
            </div>
            {listed.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No records in this range.</p>
            ) : (
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                {listed.slice(0, 200).map((r) => (
                  <div key={r.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{r.staffName} <span className="font-normal text-muted-foreground">• {r.date}</span></p>
                      <p className="text-[11px] text-muted-foreground">In {r.checkIn || "—"} • Out {r.checkOut || "—"} • {r.mode} • by {r.markedBy || "—"}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${statusBadge(r.status)}`}>{r.status}</Badge>
                    {admin && (
                      <>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => openEdit(r)} title="Correct (Admin)"><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive shrink-0" onClick={() => setDeleteTarget(r)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </>
                    )}
                  </div>
                ))}
                {listed.length > 200 && <p className="text-[11px] text-muted-foreground text-center">Showing 200 of {listed.length} — export CSV for all.</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "monthly" && manager && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Input type="month" className="h-9 text-xs w-[160px]" value={month} onChange={(e) => setMonth(e.target.value)} />
              {admin && (
                <Button
                  size="sm" variant="outline" className="h-9 text-[11px]"
                  onClick={async () => {
                    for (const s of staffMembers) await syncPercent(s.id, s.name);
                    audit("ATTENDANCE_SYNC", `${currentUser.name} synced monthly % to Staff for ${month}.`);
                    toast({ title: "Staff % synced", description: "Attendance bars in Staff now reflect this month." });
                  }}
                >
                  Sync % to Staff table
                </Button>
              )}
              <span className="text-[11px] text-muted-foreground">% = present-equivalent ÷ elapsed days{admin ? "" : " • sync is Admin-only"}</span>
                <Button
                  size="sm" variant="ghost" className="h-9 text-[11px]"
                  onClick={() => {
                    const rows = [["Staff", "Role", "Present", "Absent", "Leave", "Half Day", "Present Dates", "Absent Dates", "Leave Dates", "Half-Day Dates", "Avg Check-in", "Hours Worked", "Month %"]];
                    for (const x of summary) rows.push([x.staff.name, x.staff.role, String(x.p), String(x.a), String(x.l), String(x.h), x.presentDates.join("; "), x.absentDates.join("; "), x.leaveDates.join("; "), x.halfDates.join("; "), x.avgIn, x.hours.toFixed(1), x.pct === null ? "—" : String(x.pct)]);
                    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
                    const el = document.createElement("a");
                    el.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                    el.download = `attendance-${month}.csv`;
                    el.click();
                    URL.revokeObjectURL(el.href);
                    audit("ATTENDANCE_EXPORT", `${currentUser.name} downloaded the monthly attendance CSV for ${month}.`);
                  }}
                  disabled={summary.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Monthly report (CSV)
                </Button>
                <Button
                  size="sm" variant="outline" className="h-9 text-[11px]"
                  onClick={() => { printMonthlyReport(); audit("ATTENDANCE_PRINT", `${currentUser.name} printed the monthly attendance muster for ${month}.`); }}
                  disabled={summary.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Print / PDF muster
                </Button>
            </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {summary.map(({ staff: s, p, a, l, h, pct, avgIn, hours, presentDates, absentDates, leaveDates, halfDates }) => (
                  <div key={s.id} className="rounded-lg border p-3 space-y-1.5">
                    <p className="text-xs font-semibold truncate">{s.name} <span className="font-normal text-muted-foreground">• {s.role}</span></p>
                    <div className="flex gap-2 text-[11px] text-muted-foreground">
                      <span className="text-success font-semibold">{p} P</span>
                      <span className="text-destructive font-semibold">{a} A</span>
                      <span className="text-warning font-semibold">{l} L</span>
                      <span className="text-info font-semibold">{h} H</span>
                    </div>
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Which days? (came / leave)</summary>
                      <div className="mt-1 space-y-0.5">
                        <p><span className="font-semibold text-success">Came ({presentDates.length}):</span> <span className="text-muted-foreground">{presentDates.length ? presentDates.map(dayNo).join(", ") : "—"}</span></p>
                        <p><span className="font-semibold text-warning">Leave ({leaveDates.length}):</span> <span className="text-muted-foreground">{leaveDates.length ? leaveDates.map(dayNo).join(", ") : "—"}</span></p>
                        {(absentDates.length > 0 || halfDates.length > 0) && (
                          <p className="text-muted-foreground">
                            {absentDates.length > 0 && <span>Absent: {absentDates.map(dayNo).join(", ")}</span>}
                            {absentDates.length > 0 && halfDates.length > 0 && <span> • </span>}
                            {halfDates.length > 0 && <span>Half-day: {halfDates.map(dayNo).join(", ")}</span>}
                          </p>
                        )}
                      </div>
                    </details>
                    <p className="text-[11px] text-muted-foreground">Avg in {avgIn} • {hours.toFixed(1)} hrs worked</p>
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${(pct ?? 0) >= 95 ? "bg-success" : (pct ?? 0) >= 90 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct ?? 0}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold">{pct === null ? "—" : `${pct}%`}</span>
                  </div>
                </div>
              ))}
            </div>
            {staffMembers.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">No staff in this branch.</p>}
          </CardContent>
        </Card>
      )}

      {editTarget && admin && (
        <Dialog open={!!editTarget} onOpenChange={(v) => { if (!v) setEditTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Correct record (Admin)</DialogTitle>
              <DialogDescription>{editTarget.staffName} • {editTarget.date} • originally {editTarget.mode} by {editTarget.markedBy || "—"}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as AttendanceRecord["status"] })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1"><Label className="text-xs">Check in</Label><Input type="time" className="h-9" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Check out</Label><Input type="time" className="h-9" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} /></div>
              </div>
              <div className="space-y-1"><Label className="text-xs">Correction note</Label><Input className="h-9" placeholder="Reason…" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button onClick={saveEdit}>Save Correction</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete record?</DialogTitle><DialogDescription>Remove {deleteTarget.staffName}’s {deleteTarget.date} entry permanently.</DialogDescription></DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/attendance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
                    if (!res.ok) throw new Error("Delete failed.");
                    setRecords((rows) => rows.filter((r) => r.id !== deleteTarget.id));
                    audit("ATTENDANCE_DELETE", `${currentUser.name} deleted ${deleteTarget.staffName}'s ${deleteTarget.date} record.`);
                    toast({ title: "Record deleted" });
                    setDeleteTarget(null);
                  } catch (e: any) {
                    toast({ title: "Could not delete", description: e.message, variant: "destructive" });
                  }
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
