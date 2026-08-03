import {
  LayoutDashboard,
  Users,
  Stethoscope,
  CalendarClock,
  ConciergeBell,
  ClipboardList,
  BedDouble,
  Receipt,
  ShieldCheck,
  FlaskConical,
  ScanLine,
  Pill,
  FolderOpen,
  UserCog,
  Megaphone,
  BarChart3,
  IdCard,
  Package,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { ModuleKey } from "@/lib/types";

export interface ModuleConfig {
  key: ModuleKey;
  label: string;
  icon: LucideIcon;
  group: "Overview" | "Patient Care" | "Operations" | "Clinical" | "Business" | "Admin";
  badge?: string;
}

export const moduleConfig: ModuleConfig[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, group: "Overview" },
  { key: "patients", label: "Patients", icon: Users, group: "Patient Care" },
  { key: "doctors", label: "Doctors", icon: Stethoscope, group: "Patient Care" },
  { key: "appointments", label: "Appointments", icon: CalendarClock, group: "Patient Care", badge: "8" },
  { key: "reception", label: "Reception", icon: ConciergeBell, group: "Patient Care" },
  { key: "opd", label: "OPD", icon: ClipboardList, group: "Operations" },
  { key: "ipd", label: "IPD", icon: BedDouble, group: "Operations" },
  { key: "beds", label: "Beds", icon: BedDouble, group: "Operations" },
  { key: "billing", label: "Billing", icon: Receipt, group: "Business", badge: "3" },
  { key: "insurance", label: "Insurance", icon: ShieldCheck, group: "Business" },
  { key: "laboratory", label: "Laboratory", icon: FlaskConical, group: "Clinical", badge: "2" },
  { key: "radiology", label: "Radiology", icon: ScanLine, group: "Clinical" },
  { key: "pharmacy", label: "Pharmacy", icon: Pill, group: "Clinical" },
  { key: "records", label: "Medical Records", icon: FolderOpen, group: "Clinical" },
  { key: "crm", label: "CRM", icon: UserCog, group: "Business" },
  { key: "marketing", label: "Marketing", icon: Megaphone, group: "Business" },
  { key: "reports", label: "Reports", icon: BarChart3, group: "Admin" },
  { key: "staff", label: "Staff", icon: IdCard, group: "Admin" },
  { key: "inventory", label: "Inventory", icon: Package, group: "Admin" },
  { key: "settings", label: "Settings", icon: Settings, group: "Admin" },
];

export const moduleGroups = ["Overview", "Patient Care", "Operations", "Clinical", "Business", "Admin"] as const;
