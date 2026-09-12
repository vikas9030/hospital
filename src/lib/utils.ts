import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Role, ModuleName } from "./types"
import { customAllows } from "./role-matrix"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Branch names are compared case-insensitively with surrounding whitespace
// ignored, so records saved as "Main" vs "main" (or with stray spaces) still
// show up in every module instead of silently disappearing from lists.
export function sameBranch(a: string | undefined | null, b: string | undefined | null): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

// Person names compared tolerantly ("Dr. Ravi" matches "Ravi Kumar"? No —
// exact after lowercasing, trimming, and dropping a leading "Dr." title).
export function samePerson(a: string | undefined | null, b: string | undefined | null): boolean {
  const norm = (s: string) => s.trim().toLowerCase().replace(/^dr\.?\s+/, "");
  return norm(a ?? "") === norm(b ?? "");
}

// Phone numbers compared by digits only, ignoring spaces, dashes, and any
// country-code prefix (last 10 digits). Empty numbers never match.
export function normalizePhone(phone: string | undefined | null): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// Branch-scoped settings: `key@@Branch` overrides the global `key`, so each
// branch keeps its own bed capacity/rates without mixing. Empty override
// falls back to the global default.
export function branchSetting(settings: Record<string, string>, branch: string | undefined | null, key: string): string {
  const b = (branch ?? "").trim();
  if (b) {
    const scoped = settings[`${key}@@${b}`];
    if (scoped !== undefined && scoped !== "") return scoped;
  }
  return settings[key] ?? "";
}

export function branchSettingKey(branch: string | undefined | null, key: string): string {
  const b = (branch ?? "").trim();
  return b ? `${key}@@${b}` : key;
}

export function samePhone(a: string | undefined | null, b: string | undefined | null): boolean {
  const x = normalizePhone(a);
  const y = normalizePhone(b);
  return x !== "" && x === y;
}

// Medicine expiry is typed month-first by staff (MM/YYYY) but stored as a
// Postgres DATE. Accepts MM/YYYY, MM-YYYY, MM/YY, YYYY-MM, YYYY-MM-DD and
// DD/MM/YYYY; returns YYYY-MM-DD (first of the month for month precision)
// or null when the input cannot be understood.
export function normalizeExpiryDate(input: string | undefined | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const valid = (y: number, m: number, d: number) => {
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return null;
    if (y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  let m: RegExpMatchArray | null;
  if ((m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return valid(+m[1], +m[2], +m[3]);
  if ((m = raw.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{4})$/)) || (m = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/))) return valid(+m[3], +m[2], +m[1]);
  if ((m = raw.match(/^(\d{1,2})[\/-](\d{4})$/))) return valid(+m[2], +m[1], 1);
  if ((m = raw.match(/^(\d{1,2})[\/-](\d{2})$/))) return valid(2000 + +m[2], +m[1], 1);
  if ((m = raw.match(/^(\d{4})-(\d{1,2})$/))) return valid(+m[1], +m[2], 1);
  return null;
}

// Display a stored YYYY-MM-DD expiry as MM/YYYY in inputs and tables.
export function formatExpiryMonth(isoDate: string | undefined | null): string {
  const m = (isoDate ?? "").trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return (isoDate ?? "").trim();
  return `${m[2].padStart(2, "0")}/${m[1]}`;
}

export async function fetchWithRetry(url: string, init?: RequestInit, retries = 2): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init);
      return res;
    } catch (err: any) {
      const isRetryable = /ECONNRESET|fetch failed|network/i.test(err?.message ?? "") || err?.data?.metadata?.code === "ECONNRESET";
      if (attempt < retries && isRetryable) {
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
}

export function isAdmin(role: Role) {
  return role === "Admin"
}

export function canAddPatient(role: Role) {
  const custom = customAllows(role, "patients", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Receptionist"
}

/** Doctor or any custom role with "doctor" in its name — shows in doctor lists, gets clinical tools. */
export function isDoctorLikeRole(role: Role | string | undefined | null): boolean {
  if (!role) return false;
  if (role === "Doctor") return true;
  return /doctor/i.test(String(role));
}

export function canEditPatient(role: Role) {
  const custom = customAllows(role, "patients", "edit");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Receptionist" || role === "Doctor"
}

export function canDeletePatient(role: Role) {
  const custom = customAllows(role, "patients", "del");
  if (custom !== undefined) return custom;
  return isAdmin(role)
}

/** Normalize a doctor name for ownership checks ("Dr. Vinay" === "vinay"). */
export function sameDoctorName(a: string | undefined | null, b: string | undefined | null): boolean {
  const norm = (n: string) => n.trim().toLowerCase().replace(/^dr\.?\s+/, "");
  return !!a && !!b && norm(a) === norm(b);
}

/** Identity stamp for appointment PATCH/DELETE calls (server-enforced). */
export function scheduleActor(role: Role | string | undefined | null, name: string | undefined | null) {
  return { actorRole: (role ?? "") as string, actorName: name ?? "" };
}

/**
 * Who may cancel or delete an appointment schedule:
 * Admin → everything; Receptionist → everything;
 * Doctor (or doctor-like custom role) → only visits where they are the doctor;
 * everyone else → nothing.
 */
export function canManageAppointment(
  role: Role | string | undefined | null,
  actorName: string | undefined | null,
  apt: { doctorName?: string; doctorId?: string },
  actorDoctorId?: string | undefined | null
): boolean {
  if (!role) return false;
  if (isAdmin(role as Role) || role === "Receptionist") return true;
  if (isDoctorLikeRole(role)) {
    if (actorDoctorId && apt.doctorId && actorDoctorId === apt.doctorId) return true;
    return sameDoctorName(actorName, apt.doctorName);
  }
  return false;
}

export function canAddAnything(role: Role) {
  if (isAdmin(role)) return true;
  const custom = customAllows(role, "staff", "add");
  if (custom !== undefined) return custom;
  return false;
}

export function canAddMedicine(role: Role) {
  const custom = customAllows(role, "pharmacy", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Pharmacist"
}

// Who may collect money against bills. Doctors are intentionally excluded —
// collection is a front-desk/accounts/clinical-support job.
// Notification type toggles (Settings → Notifications tab) actually gate what
// the header bell shows and what fires browser push alerts.
const NOTIF_TYPE_SETTING: Record<string, string> = {
  appointment: "Appointment Reminders",
  billing: "Bill Pending",
  lab: "Lab Report Ready",
  radiology: "Lab Report Ready",
  pharmacy: "Prescription Ready",
  insurance: "Insurance Approved",
  inventory: "Bill Pending",
  patient: "Appointment Reminders",
  doctor: "Shift Reminders",
};

export function notifSettingKeyForType(type: string): string {
  const title = NOTIF_TYPE_SETTING[type] ?? "";
  if (!title) return "";
  return `notif_${title.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`;
}

export function isNotifEnabled(settings: Record<string, string>, type: string): boolean {
  const key = notifSettingKeyForType(type);
  if (!key) return true;
  const v = settings[key];
  return v === undefined ? true : v === "true";
}

export function canCollectPayment(role: Role) {
  const custom = customAllows(role, "billing", "edit");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Receptionist" || role === "Accountant" || role === "Lab Technician" || role === "Radiologist"
}

export function canCreateInvoice(role: Role) {
  const custom = customAllows(role, "billing", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Accountant" || role === "Receptionist"
}

export function canManageLab(role: Role) {
  const custom = customAllows(role, "laboratory", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Lab Technician"
}

export function canManageRadiology(role: Role) {
  const custom = customAllows(role, "radiology", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Radiologist"
}

export function canManageNursing(role: Role) {
  const custom = customAllows(role, "nursing", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Nurse"
}

export function canManageAccounts(role: Role) {
  const custom = customAllows(role, "accounts", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Accountant"
}

export function canManageInsurance(role: Role) {
  const custom = customAllows(role, "insurance", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "Accountant"
}

export function canManageAttendance(role: Role) {
  const custom = customAllows(role, "attendance", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "HR"
}

export function canManageStaff(role: Role) {
  const custom = customAllows(role, "staff", "add");
  if (custom !== undefined) return custom;
  return isAdmin(role) || role === "HR"
}

export function isBranchAccessible(userBranch: string | undefined, targetBranch: string, userRole: Role, activeBranch: string): boolean {
  if (isAdmin(userRole)) {
    return targetBranch === activeBranch
  }
  return userBranch === targetBranch
}

export function weekdayOf(dateIso: string): string {
  if (!dateIso) return ""
  const [y, m, d] = dateIso.split("-").map(Number)
  if (!y || !m || !d) return ""
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" })
}

// A doctor is bookable on a date when the weekday is in their available days.
// Empty availableDays = unrestricted (legacy rows). On Leave / Off Duty always excluded.
// When per-branch schedules exist, the schedule for the doctor's email + branch wins.
export function isDoctorAvailableOn(
  doctor: { availableDays?: string[]; availability?: string; email?: string },
  dateIso: string,
  opts?: { schedules?: { doctorEmail: string; branch: string; availableDays: string[] }[]; branch?: string }
): boolean {
  if (!dateIso) return true
  if (doctor.availability === "On Leave" || doctor.availability === "Off Duty") return false
  let days = doctor.availableDays ?? []
  if (opts?.schedules && opts?.branch && doctor.email) {
    const branchSchedule = opts.schedules.find(
      (s) => s.doctorEmail === doctor.email!.toLowerCase() && s.branch === opts.branch
    )
    if (branchSchedule) days = branchSchedule.availableDays ?? []
  }
  if (days.length === 0) return true
  const weekday = weekdayOf(dateIso)
  return weekday ? days.includes(weekday) : true
}

const moduleEditRoles: Record<ModuleName, Role[]> = {
  patients: ["Admin", "Receptionist", "Doctor"],
  doctors: ["Admin"],
  appointments: ["Admin", "Receptionist", "Doctor"],
  opd: ["Admin", "Receptionist", "Doctor"],
  ipd: ["Admin", "Receptionist", "Doctor", "Nurse"],
  beds: ["Admin", "Nurse", "Receptionist"],
  billing: ["Admin", "Accountant", "Receptionist"],
  insurance: ["Admin", "Accountant"],
  accounts: ["Admin", "Accountant"],
  laboratory: ["Admin", "Lab Technician"],
  radiology: ["Admin", "Radiologist"],
  nursing: ["Admin", "Nurse"],
  pharmacy: ["Admin", "Pharmacist"],
  records: ["Admin", "Doctor", "Nurse"],
  crm: ["Admin", "Marketing"],
  marketing: ["Admin", "Marketing"],
  staff: ["Admin", "HR"],
  inventory: ["Admin", "Pharmacist"],
  attendance: ["Admin", "HR"],
}

const moduleDeleteRoles: Record<ModuleName, Role[]> = {
  patients: ["Admin"],
  doctors: ["Admin"],
  appointments: ["Admin"],
  opd: ["Admin"],
  ipd: ["Admin"],
  beds: ["Admin"],
  billing: ["Admin"],
  insurance: ["Admin"],
  accounts: ["Admin"],
  laboratory: ["Admin"],
  radiology: ["Admin"],
  nursing: ["Admin"],
  pharmacy: ["Admin"],
  records: ["Admin"],
  crm: ["Admin"],
  marketing: ["Admin"],
  staff: ["Admin"],
  inventory: ["Admin"],
  attendance: ["Admin"],
}

export function canEditModule(role: Role, module: ModuleName): boolean {
  const custom = customAllows(role, module, "edit");
  if (custom !== undefined) return custom;
  return moduleEditRoles[module]?.includes(role) ?? false
}

export function canDeleteModule(role: Role, module: ModuleName): boolean {
  const custom = customAllows(role, module, "del");
  if (custom !== undefined) return custom;
  return moduleDeleteRoles[module]?.includes(role) ?? false
}

export function generateStaffId(): string {
  const prefix = "MC"
  const year = new Date().getFullYear().toString().slice(-2)
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, "0")
  return `${prefix}-${year}-${seq}`
}

export function getDefaultModuleForRole(_role: Role): string {
  return "dashboard"
}
