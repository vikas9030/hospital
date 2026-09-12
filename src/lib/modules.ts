import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarClock,
  ConciergeBell,
  ClipboardList,
  BedDouble,
  HeartPulse,
  Receipt,
  Wallet,
  ShieldCheck,
  FlaskConical,
  ScanLine,
  Pill,
  FolderOpen,
  UserCog,
  Megaphone,
  BarChart3,
  IdCard,
  Fingerprint,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey, Role } from "@/lib/types";
import { customAllows } from "@/lib/role-matrix";
import { getRoleModulesOverride, isRoleDeleted } from "@/lib/system-roles";

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  group: "Overview" | "Patient Care" | "Operations" | "Clinical" | "Business" | "Admin";
  badge?: string;
  roles: Role[];
}

export const moduleConfig: ModuleConfig[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview", roles: ["Admin", "Doctor", "Receptionist", "Nurse", "Pharmacist", "Lab Technician", "Radiologist", "Accountant", "HR", "Marketing"] },
  { key: "patients", label: "Patients", icon: Users, group: "Patient Care", roles: ["Admin", "Doctor", "Receptionist", "Nurse"] },
  { key: "doctors", label: "Doctors", icon: Stethoscope, group: "Patient Care", roles: ["Admin", "Doctor", "Receptionist", "Nurse"] },
  { key: "appointments", label: "Appointments", icon: CalendarClock, group: "Patient Care", badge: "8", roles: ["Admin", "Doctor", "Receptionist"] },
  { key: "reception", label: "Reception", icon: ConciergeBell, group: "Patient Care", roles: ["Admin", "Receptionist"] },
  { key: "opd", label: "OPD", icon: ClipboardList, group: "Operations", roles: ["Admin", "Doctor", "Receptionist", "Nurse"] },
  { key: "ipd", label: "IPD", icon: BedDouble, group: "Operations", roles: ["Admin", "Doctor", "Receptionist", "Nurse"] },
  { key: "beds", label: "Beds", icon: BedDouble, group: "Operations", roles: ["Admin", "Nurse", "Receptionist"] },
  { key: "billing", label: "Billing", icon: Receipt, group: "Business", badge: "3", roles: ["Admin", "Accountant", "Receptionist"] },
  { key: "accounts", label: "Accounts", icon: Wallet, group: "Business", roles: ["Admin", "Accountant"] },
  { key: "insurance", label: "Insurance", icon: ShieldCheck, group: "Business", roles: ["Admin", "Accountant"] },
  { key: "laboratory", label: "Laboratory", icon: FlaskConical, group: "Clinical", badge: "2", roles: ["Admin", "Lab Technician", "Doctor"] },
  { key: "radiology", label: "Radiology", icon: ScanLine, group: "Clinical", roles: ["Admin", "Radiologist", "Doctor"] },
  { key: "nursing", label: "Nursing", icon: HeartPulse, group: "Clinical", roles: ["Admin", "Nurse", "Doctor"] },
  { key: "pharmacy", label: "Pharmacy", icon: Pill, group: "Clinical", roles: ["Admin", "Pharmacist"] },
  { key: "records", label: "Medical Records", icon: FolderOpen, group: "Clinical", roles: ["Admin", "Doctor", "Nurse", "Lab Technician", "Radiologist"] },
  { key: "crm", label: "CRM", icon: UserCog, group: "Business", roles: ["Admin", "Marketing"] },
  { key: "marketing", label: "Marketing", icon: Megaphone, group: "Business", roles: ["Admin", "Marketing"] },
  { key: "reports", label: "Reports", icon: BarChart3, group: "Admin", roles: ["Admin", "Accountant"] },
  { key: "staff", label: "Staff", icon: IdCard, group: "Admin", roles: ["Admin", "HR"] },
  { key: "attendance", label: "Attendance", icon: Fingerprint, group: "Admin", roles: ["Admin", "HR", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "Radiologist", "Accountant", "Marketing"] },
  { key: "inventory", label: "Inventory", icon: Package, group: "Admin", roles: ["Admin", "Pharmacist"] },
  { key: "settings", label: "Settings", icon: Settings, group: "Admin", roles: ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "Radiologist", "Accountant", "HR", "Marketing"] },
];

export const moduleGroups = ["Overview", "Patient Care", "Operations", "Clinical", "Business", "Admin"] as const;

export function getModulesForRole(role: Role): ModuleConfig[] {
  return moduleConfig.filter((m) => {
    if (m.key === "dashboard" || m.key === "settings") return true;
    const custom = customAllows(role, m.key, "view");
    if (custom !== undefined) return custom;
    return m.roles.includes(role);
  });
}

export function getModuleKeysForRole(role: Role): ModuleKey[] {
  return getModulesForRole(role).map((m) => m.key);
}

/** Settings-aware module list: applies the admin's per-role edits
 *  (`role_<slug>_modules`) and soft-deletes. Dashboard + Settings stay
 *  visible for every non-deleted role. Reactive — pass fresh settings. */
export function getEffectiveModulesForRole(role: Role, settings: Record<string, string>): ModuleConfig[] {
  if (isRoleDeleted(settings, role)) return [];
  const validKeys = moduleConfig.map((m) => m.key);
  const override = getRoleModulesOverride(settings, role, validKeys);
  if (!override) return getModulesForRole(role);
  return moduleConfig.filter(
    (m) => m.key === "dashboard" || m.key === "settings" || override.includes(m.key)
  );
}
