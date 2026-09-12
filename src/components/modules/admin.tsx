"use client";

import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import {
  BarChart3, Download, FileText, TrendingUp, Users, Package,
  Settings as SettingsIcon, Plus, Search, Mail, Phone, Calendar,
  Shield, Bell, CreditCard, MessageSquare, Database, Building2, Palette, MonitorSmartphone, BedDouble,
  ConciergeBell, FolderOpen, IdCard, Wrench, AlertTriangle, XCircle,
  CheckCircle2, Clock, MapPin, UserPlus, QrCode, Printer, Trash2, Pencil, Eye,
  User, Stethoscope, ClipboardList, Wifi,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { isAdmin, canAddAnything, canAddPatient, canEditModule, canDeleteModule, generateStaffId, isDoctorAvailableOn, weekdayOf, samePhone, sameBranch, branchSetting, branchSettingKey, isDoctorLikeRole, canManageAccounts, canManageStaff, scheduleActor, canManageAppointment } from "@/lib/utils";
import type { Role, StaffMember, InventoryItem, Branch, Appointment, MedicalRecord, Invoice } from "@/lib/types";
import { NewAppointmentDialog } from "@/components/modules/appointments";
import { getEffectiveModulesForRole, moduleConfig } from "@/lib/modules";
import {
  SYSTEM_ROLES, roleModulesKey, roleDescKey, roleDeletedKey,
  getRoleDesc, isRoleDeleted, isRoleLoginEnabled,
} from "@/lib/system-roles";
import { LOGIN_THEMES } from "@/lib/branding";
import { ROLE_TEMPLATES, emptyMatrix, matrixToPermissions, countMatrixGrants } from "@/lib/role-matrix";
import type { RoleMatrix, MatrixAction } from "@/lib/role-matrix";
import type { RoleDefinition as RoleDefinitionShape } from "@/store/app-store";
import { ScheduleBuilder } from "@/components/shared/schedule-builder";
import type { DayShift } from "@/lib/types";
import { VisitRequestsInbox } from "@/components/shared/visit-requests-inbox";
import { printInvoice } from "@/lib/invoice-print";
import { printMedicalRecord, buildMedicalRecordHtml, buildLabReportHtml, buildRadiologyReportHtml, type ReportDoc } from "@/lib/documents";
import { ReportViewerDialog } from "@/components/shared/report-viewer";
import { usePagination, DataPagination } from "@/components/shared/data-pagination";
import { ImportExportButtons, type EntityIOConfig } from "@/components/shared/import-export-buttons";
import { CollectMoneyDialog } from "@/components/shared/collect-money-dialog";
import { parseServicePrices, stringifyServicePrices, type ServiceModule, type ServicePriceItem } from "@/lib/service-pricing";
import { parseTaxPresets, type TaxPreset } from "@/lib/billing";
import { IntegrationsTab } from "@/components/modules/integrations";
import { SecurityTab } from "@/components/modules/security";
import { DepartmentsManager, useDepartmentOptions } from "@/components/modules/departments";

function uniqueOptions(values: (string | undefined | null)[], fallback: string[] = []) {
  return Array.from(new Set([...fallback, ...values].map((v) => (v ?? "").trim()).filter(Boolean))).sort();
}

function SearchableField({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Search or type custom...",
  emptyLabel = "Use custom value",
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const customValue = query.trim();
  const hasExactMatch = options.some((option) => option.toLowerCase() === customValue.toLowerCase());
  const addCustomValue = () => {
    if (!customValue) return;
    onChange(customValue);
    setOpen(false);
    setQuery("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="h-9 w-full justify-between font-normal">
          <span className={`truncate ${value ? "" : "text-muted-foreground"}`}>{value || placeholder}</span>
          <Search className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command shouldFilter>
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => { onChange(option); setOpen(false); setQuery(""); }}>
                  {option}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          <div className="border-t p-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start"
              disabled={!customValue || hasExactMatch}
              onClick={addCustomValue}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {customValue ? `${emptyLabel}: ${customValue}` : "Type a custom name to add"}
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ===== Add Staff Dialog =====
// Legacy fallback only — live dropdowns come from useDepartmentOptions()
// (admin-managed per-branch list in Settings → Departments).
const DEPARTMENT_OPTIONS = [
  "General Medicine", "Cardiology", "Neurology", "Orthopedics", "Pediatrics",
  "Dermatology", "Gastroenterology", "Pulmonology", "ENT", "Ophthalmology",
  "Psychiatry", "Oncology", "Radiology", "Pathology", "Emergency Medicine",
];


function AddStaffDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addStaffMember = useAppStore((s) => s.addStaffMember);
  const addUser = useAppStore((s) => s.addUser);
  const upsertDoctorByEmail = useAppStore((s) => s.upsertDoctorByEmail);
  const storeBranches = useAppStore((s) => s.branches);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "", role: "" as Role | "", shift: "Morning", salary: "", password: "", confirmPassword: "", branch: "", branchId: "", photo: "", consultationFee: "", schedule: [] as DayShift[] });
  const scheduleDayUnion = Array.from(new Set(form.schedule.map((s) => s.day)));
  const staffId = generateStaffId();
  const roleDefinitions = useAppStore((s) => s.roleDefinitions);
  const customRoleNames = roleDefinitions.filter((r) => r.isActive && sameBranch(r.branch, form.branch || activeBranch)).map((r) => r.name);
  const deletedRoleSettings = useAppStore((s) => s.settings);
  const availableRoles = [...["Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "Radiologist", "Accountant", "HR", "Marketing"], ...customRoleNames].filter((r) => !isRoleDeleted(deletedRoleSettings, r));
  const roleLabel = (r: string) => (customRoleNames.includes(r) ? `${r} (custom)` : r);
  const photoRef = useRef<HTMLInputElement>(null);
  const handlePhotoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", description: "Choose a PNG/JPG photo.", variant: "destructive" }); return; }
    if (file.size > 700 * 1024) { toast({ title: "Photo too large", description: "Use a photo under 700 KB, or paste an image URL.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };
  const isDoctorRole = isDoctorLikeRole(form.role);
  const deptOptions = useDepartmentOptions(form.branch || activeBranch);
  const deptChoice = form.department && !deptOptions.includes(form.department) ? "Custom" : form.department;
  const handleBranchChange = (branchName: string) => {
    const b = storeBranches.find((br) => br.name === branchName);
    setForm({ ...form, branch: branchName, branchId: b?.id || "" });
  };
  const handleRoleChange = (role: Role) => {
    setForm({ ...form, role, department: "" });
  };
  const handleDeptChoice = (value: string) => {
    setForm({ ...form, department: value === "Custom" ? "" : value });
  };
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.role || !form.branch || !form.password) { toast({ title: "Missing fields", description: "Name, role, branch, and password are required.", variant: "destructive" }); return; }
    if (isDoctorRole && !form.department.trim()) { toast({ title: "Missing fields", description: "Department is required for doctors. Pick one or choose Custom.", variant: "destructive" }); return; }
    if (form.password.length < 8) { toast({ title: "Invalid password", description: "Password must be at least 8 characters.", variant: "destructive" }); return; }
    if (form.password !== form.confirmPassword) { toast({ title: "Passwords don't match", description: "Password and confirm password must match.", variant: "destructive" }); return; }
    const resolvedEmail = form.email.trim() || `${form.name.toLowerCase().replace(/\s+/g, ".").replace(/\.+/g, ".").replace(/^\./, "").replace(/\.$/, "")}@medicore.com`;
    const newStaff = {
      id: `s${Date.now()}`,
      staffId,
      name: form.name,
      photo: form.photo.trim(),
      role: form.role,
      department: form.department,
      phone: form.phone,
      email: resolvedEmail,
      password: form.password,
      mustChangePassword: false,
      consultationFee: isDoctorRole ? parseFloat(form.consultationFee) || 0 : 0,
      availableDays: isDoctorRole ? scheduleDayUnion : [],
      availableFrom: isDoctorRole ? form.schedule[0]?.from || "" : "",
      availableTo: isDoctorRole ? form.schedule[form.schedule.length - 1]?.to || "" : "",
      status: "Active" as const,
      shift: form.shift as "Morning" | "Evening" | "Night",
      attendance: 100,
      joinDate: new Date().toISOString().split("T")[0],
      salary: parseFloat(form.salary) || 0,
      branch: form.branch,
      branchId: form.branchId,
    };
    const newUser = {
      name: form.name,
      role: form.role,
      email: resolvedEmail,
      avatar: form.photo.trim() || form.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(),
      branch: form.branch,
      branchId: form.branchId,
      password: form.password,
      mustChangePassword: false,
      staffId,
    };
    setSaving(true);
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newStaff),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save staff member.");
      }
    } catch (e: any) {
      toast({ title: "Could not add staff", description: e.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create the login account.");
      }
    } catch (e: any) {
      toast({ title: "Staff saved, but login account failed", description: `${e.message} The staff member may not be able to sign in until this is fixed.`, variant: "destructive" });
    }
    setSaving(false);
    addStaffMember(newStaff);
    addUser(newUser);
    if (isDoctorRole) {
      // Persist the doctor profile to Supabase so it survives refresh and
      // works on every device (appointments reference it by id).
      try {
        const docRes = await fetch("/api/doctors/ensure", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: resolvedEmail,
            name: form.name,
            phone: form.phone,
            branch: form.branch,
            department: form.department,
            consultationFee: parseFloat(form.consultationFee) || 0,
            availableDays: scheduleDayUnion,
            shift: form.shift,
            schedule: form.schedule,
          }),
        });
        if (docRes.ok) {
          upsertDoctorByEmail(await docRes.json());
        } else {
          const b = await docRes.json().catch(() => ({}));
          toast({ title: "Doctor profile pending", description: `${b.error || "Doctor sync failed."} It will auto-retry on next sync — the doctor may be missing from lists until then.`, variant: "destructive" });
        }
      } catch {
        toast({ title: "Doctor profile pending", description: "Doctor sync failed and will auto-retry on next sync.", variant: "destructive" });
      }
    }
    toast({ title: "Staff Added", description: `${form.name} has been added as ${form.role}. Staff ID: ${staffId}. Login email: ${resolvedEmail}` });
    setForm({ name: "", email: "", phone: "", department: "", role: "" as Role | "", shift: "Morning", salary: "", password: "", confirmPassword: "", branch: "", branchId: "", photo: "", consultationFee: "", schedule: [] as DayShift[] });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add Staff Member</DialogTitle><DialogDescription>Create a new staff account with role, branch, and login credentials.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-2"><p className="text-xs text-primary font-medium">Staff ID: <span className="font-mono">{staffId}</span></p></div>
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoFile(e.target.files?.[0])} />
          {form.photo ? (
            <img src={form.photo} alt="Staff photo preview" className="h-14 w-14 rounded-full border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full border bg-muted text-[10px] text-muted-foreground">Photo</div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <Label>Profile Photo (optional)</Label>
            <Input className="h-8 text-xs" placeholder="Paste image URL or upload…" value={form.photo.startsWith("data:") ? "" : form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value.trim() })} />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => photoRef.current?.click()}>Upload</Button>
            {form.photo && <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => setForm({ ...form, photo: "" })}>Remove</Button>}
          </div>
        </div>
        <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="Staff name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Role *</Label><Select value={form.role as string} onValueChange={(v) => handleRoleChange(v as Role)}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{availableRoles.map((r) => <SelectItem key={r} value={r}>{roleLabel(r)}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2">
            <Label>Department {isDoctorRole && "*"}</Label>
            <>
              <Select value={deptChoice} onValueChange={handleDeptChoice}>
                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {deptOptions.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
              {deptChoice === "Custom" && (
                <Input placeholder="Enter custom department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} autoFocus />
              )}
            </>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Phone</Label><Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Branch *</Label><Select value={form.branch} onValueChange={handleBranchChange}><SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger><SelectContent>{storeBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Shift</Label><Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Evening">Evening</SelectItem><SelectItem value="Night">Night</SelectItem></SelectContent></Select></div>
        </div>
        {isDoctorRole && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Doctor: consultation & schedule</p>
            <div className="space-y-2"><Label>Consultation Fee (₹)</Label><Input type="number" min={0} placeholder="500" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} /></div>
            <ScheduleBuilder value={form.schedule} onChange={(schedule) => setForm({ ...form, schedule })} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Password *</Label><Input type="password" placeholder="Min 8 characters" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <div className="space-y-2"><Label>Confirm Password *</Label><Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Salary (₹)</Label><Input type="number" placeholder="Monthly salary" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Adding..." : "Add Staff"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Edit Staff Dialog =====
function EditStaffDialog({ open, onOpenChange, staff }: { open: boolean; onOpenChange: (v: boolean) => void; staff: StaffMember | null }) {
  const { toast } = useToast();
  const roleDefinitions = useAppStore((s) => s.roleDefinitions);
  const editDeletedSettings = useAppStore((s) => s.settings);
  const updateStaffMember = useAppStore((s) => s.updateStaffMember);
  const syncDoctorFromStaff = useAppStore((s) => s.syncDoctorFromStaff);
  const removeDoctorByStaff = useAppStore((s) => s.removeDoctorByStaff);
  const [form, setForm] = useState({ name: "", email: "", phone: "", department: "", role: "" as Role | "", shift: "Morning" as string, salary: "", status: "Active" as string, branch: "", branchId: "", photo: "", consultationFee: "", schedule: [] as DayShift[] });
  const editCustomNames = roleDefinitions.filter((r) => {
    const scope = form.branch || staff?.branch || "";
    return r.isActive && (!scope || sameBranch(r.branch, scope));
  }).map((r) => r.name);
  const editRoleOptions = [...["Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "Accountant", "HR"], ...editCustomNames].filter((r) => !isRoleDeleted(editDeletedSettings, r));
  const editDeptOptions = useDepartmentOptions(form.branch);
  const editDeptItems = form.department && !editDeptOptions.includes(form.department) ? [form.department, ...editDeptOptions] : editDeptOptions;
  const prevId = useState<string | null>(null);
  const editPhotoRef = useRef<HTMLInputElement>(null);
  const isEditDoctorRole = isDoctorLikeRole(form.role);

  if (staff && staff.id !== prevId[0]) {
    prevId[1](staff.id);
    const linkedDoctor = useAppStore.getState().doctors.find(
      (d) => d.email === staff.email || d.name === staff.name
    );
    setForm({
      name: staff.name, email: staff.email, phone: staff.phone, department: staff.department,
      role: staff.role, shift: staff.shift, salary: String(staff.salary), status: staff.status,
      branch: staff.branch, branchId: staff.branchId || "", photo: staff.photo || "",
      consultationFee: (staff as any).consultationFee ? String((staff as any).consultationFee) : linkedDoctor && linkedDoctor.consultationFee > 0 ? String(linkedDoctor.consultationFee) : "",
      schedule: linkedDoctor?.schedule ?? [],
    });
  }

  const handleEditPhotoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", description: "Choose a PNG/JPG photo.", variant: "destructive" }); return; }
    if (file.size > 700 * 1024) { toast({ title: "Photo too large", description: "Use a photo under 700 KB, or paste an image URL.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, photo: String(reader.result || "") }));
    reader.readAsDataURL(file);
  };

  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!staff || !form.name || !form.role) { toast({ title: "Missing fields", description: "Name and role are required.", variant: "destructive" }); return; }
    const wasDoctor = isDoctorLikeRole(staff.role);
    const isNowDoctor = isDoctorLikeRole(form.role);
    const editDayUnion = Array.from(new Set(form.schedule.map((s) => s.day)));
    const staffPatch = {
      name: form.name, role: form.role as Role, department: form.department,
      phone: form.phone, email: form.email, status: form.status as "Active" | "On Leave" | "Inactive" | "Follow Up",
      shift: form.shift as "Morning" | "Evening" | "Night", salary: parseFloat(form.salary) || 0,
      branch: form.branch, branchId: form.branchId, photo: form.photo.trim(),
      consultationFee: isEditDoctorRole ? parseFloat(form.consultationFee) || 0 : undefined,
      availableDays: isEditDoctorRole ? editDayUnion : undefined,
      availableFrom: isEditDoctorRole ? form.schedule[0]?.from || "" : undefined,
      availableTo: isEditDoctorRole ? form.schedule[form.schedule.length - 1]?.to || "" : undefined,
    };
    setSaving(true);
    try {
      // Staff row → Supabase first so edits survive refresh on every device.
      const staffRes = await fetch("/api/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: staff.id, ...staffPatch }),
      });
      if (!staffRes.ok) {
        const body = await staffRes.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update staff member.");
      }
      const savedStaff = await staffRes.json();
      // Linked login account follows the same changes.
      const store = useAppStore.getState();
      const userToUpdate = store.users.find((u) => u.email === staff.email || u.staffId === staff.staffId);
      if (userToUpdate) {
        try {
          await fetch("/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: userToUpdate.email,
              ...(form.email !== userToUpdate.email ? { newEmail: form.email } : {}),
              name: form.name, role: form.role, branch: form.branch, branchId: form.branchId,
              avatar: form.photo.trim(),
            }),
          });
        } catch {
          // Non-fatal: refreshed from the staff row on next sync.
        }
        useAppStore.setState((s) => ({
          users: s.users.map((u) =>
            u.email === staff.email || u.staffId === staff.staffId
              ? { ...u, name: form.name, role: form.role as Role, email: form.email, branch: form.branch, branchId: form.branchId, avatar: form.photo.trim() }
              : u
          ),
        }));
      }
      updateStaffMember(staff.id, savedStaff);
      if (isNowDoctor) {
        // Keep the doctor profile row in sync (fee/schedule/branch) so lists,
        // portal, and billing read the new values immediately.
        try {
          const doc = useAppStore.getState().doctors.find(
            (d) => d.email === form.email || d.name === form.name
          );
          if (doc) {
            const docRes = await fetch("/api/doctors", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: doc.id,
            department: form.department,
            phone: form.phone,
            consultationFee: parseFloat(form.consultationFee) || 0,
            availableDays: editDayUnion,
            availableFrom: form.schedule[0]?.from || "",
            availableTo: form.schedule[form.schedule.length - 1]?.to || "",
            shift: form.shift,
            schedule: form.schedule,
          }),
            });
            if (docRes.ok) {
              const savedDoc = await docRes.json();
              useAppStore.getState().updateDoctor(doc.id, savedDoc);
            }
          }
        } catch {
          // Non-fatal: editable from the Doctors module.
        }
      }
      // Editing your own profile updates the header avatar immediately.
      const me = useAppStore.getState().currentUser;
      if (me.email && (form.email === me.email || staff.email === me.email)) {
        useAppStore.setState((s) => ({
          currentUser: { ...s.currentUser, name: form.name, avatar: form.photo.trim() || s.currentUser.avatar },
        }));
      }
      const updatedStaff = { ...staff, ...savedStaff };
      if (isNowDoctor) {
        // Persisted doctor profile (create-or-find by email).
        try {
          const docRes = await fetch("/api/doctors/ensure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: form.email,
              name: form.name,
              phone: form.phone,
              branch: form.branch,
              department: form.department,
            }),
          });
          if (docRes.ok) useAppStore.getState().upsertDoctorByEmail(await docRes.json());
          else syncDoctorFromStaff(updatedStaff);
        } catch {
          syncDoctorFromStaff(updatedStaff);
        }
      } else if (wasDoctor && !isNowDoctor) {
        const doc = useAppStore.getState().doctors.find((d) => d.email === staff.email || d.name === staff.name);
        if (doc) {
          try {
            await fetch("/api/doctors", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: doc.id }),
            });
          } catch {
            // Non-fatal: local removal below still applies.
          }
        }
        removeDoctorByStaff(updatedStaff);
      }
      toast({ title: "Staff Updated", description: `${form.name} has been updated in Supabase.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update staff", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Staff Member</DialogTitle><DialogDescription>Update staff member information.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
          <input ref={editPhotoRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleEditPhotoFile(e.target.files?.[0])} />
          {form.photo ? (
            <img src={form.photo} alt="Staff photo" className="h-14 w-14 rounded-full border object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {form.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <Label>Profile Photo</Label>
            <Input className="h-8 text-xs" placeholder="Paste image URL or upload…" value={form.photo.startsWith("data:") ? "" : form.photo} onChange={(e) => setForm({ ...form, photo: e.target.value.trim() })} />
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => editPhotoRef.current?.click()}>Upload</Button>
            {form.photo && <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={() => setForm({ ...form, photo: "" })}>Remove</Button>}
          </div>
        </div>
        <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="Staff name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Role *</Label><Select value={form.role as string} onValueChange={(v) => setForm({ ...form, role: v as Role })}><SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger><SelectContent>{editRoleOptions.map((r) => <SelectItem key={r} value={r}>{editCustomNames.includes(r) ? `${r} (custom)` : r}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Department</Label><Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}><SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger><SelectContent>{editDeptItems.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Phone</Label><Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Shift</Label><Select value={form.shift} onValueChange={(v) => setForm({ ...form, shift: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Morning">Morning</SelectItem><SelectItem value="Evening">Evening</SelectItem><SelectItem value="Night">Night</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="On Leave">On Leave</SelectItem><SelectItem value="Inactive">Inactive</SelectItem><SelectItem value="Follow Up">Follow Up</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Salary (₹)</Label><Input type="number" placeholder="Monthly salary" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} /></div>
        </div>
        {isEditDoctorRole && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Doctor: consultation & schedule</p>
            <div className="space-y-2"><Label>Consultation Fee (₹)</Label><Input type="number" min={0} placeholder="500" value={form.consultationFee} onChange={(e) => setForm({ ...form, consultationFee: e.target.value })} /></div>
            <ScheduleBuilder value={form.schedule} onChange={(schedule) => setForm({ ...form, schedule })} />
          </div>
        )}
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Updating..." : "Update Staff"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Add Inventory Item Dialog =====
function AddItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addInventoryItem = useAppStore((s) => s.addInventoryItem);
  const branchData = useBranchData();
  const [form, setForm] = useState({ name: "", category: "Equipment", supplier: "", location: "", stock: "", reorderLevel: "", price: "", unit: "" });
  const handleSubmit = async () => {
    if (!form.name) { toast({ title: "Missing fields", description: "Item name is required.", variant: "destructive" }); return; }
    const stock = parseInt(form.stock) || 0;
    const reorder = parseInt(form.reorderLevel) || 0;
    const newItem = {
      id: `inv${Date.now()}`,
      name: form.name,
      category: form.category as "Equipment" | "Consumable" | "Furniture" | "IT",
      stock,
      reorderLevel: reorder,
      unit: form.unit || "pcs",
      supplier: form.supplier,
      price: parseFloat(form.price) || 0,
      location: form.location,
      lastRestocked: new Date().toISOString().split("T")[0],
      status: (stock <= 0 ? "Out of Stock" : stock <= reorder ? "Low Stock" : "In Stock") as "In Stock" | "Low Stock" | "Out of Stock" | "Follow Up",
      branch: branchData.branch,
    };
    try {
      const res = await fetch("/api/inventory", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newItem) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add item."); }
      const saved = await res.json();
      addInventoryItem(saved);
      toast({ title: "Item Added", description: `${form.name} has been added to inventory.` });
      setForm({ name: "", category: "Equipment", supplier: "", location: "", stock: "", reorderLevel: "", price: "", unit: "" });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add item", description: e.message, variant: "destructive" });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Add Inventory Item</DialogTitle><DialogDescription>Add a new item to inventory.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Item Name *</Label><Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Equipment">Equipment</SelectItem><SelectItem value="Consumable">Consumable</SelectItem><SelectItem value="Furniture">Furniture</SelectItem><SelectItem value="IT">IT</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Unit</Label><Input placeholder="e.g. pcs, boxes" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Stock Quantity</Label><Input type="number" placeholder="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
          <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" placeholder="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Price (₹)</Label><Input type="number" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="space-y-2"><Label>Supplier</Label><Input placeholder="Supplier name" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Location</Label><Input placeholder="Storage location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Add Item</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Add Branch Dialog =====
function AddBranchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addBranch = useAppStore((s) => s.addBranch);
  const [form, setForm] = useState({ name: "", location: "" });
  const handleSubmit = async () => {
    if (!form.name) { toast({ title: "Missing fields", description: "Branch name is required.", variant: "destructive" }); return; }
    const newBranch = {
      id: `br${Date.now()}`,
      name: form.name,
      location: form.location,
      patients: 0,
      revenue: 0,
      staff: 0,
      status: "Active" as const,
    };
    try {
      const res = await fetch("/api/branches", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newBranch) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add branch."); }
      const saved = await res.json();
      addBranch(saved);
      toast({ title: "Branch Added", description: `${form.name} has been added.` });
      setForm({ name: "", location: "" }); onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add branch", description: e.message, variant: "destructive" });
    }
  }; 
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Add Branch</DialogTitle><DialogDescription>Add a new hospital branch.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Branch Name *</Label><Input placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="space-y-2"><Label>Location</Label><Input placeholder="Address / city" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Add Branch</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Edit Branch Dialog =====
function EditBranchDialog({ open, onOpenChange, branch }: { open: boolean; onOpenChange: (v: boolean) => void; branch: Branch | null }) {
  const { toast } = useToast();
  const updateBranch = useAppStore((s) => s.updateBranch);
  const settings = useAppStore((s) => s.settings);
  const setAppSetting = useAppStore((s) => s.setAppSetting);
  const [form, setForm] = useState({ name: "", location: "", status: "Active" as "Active" | "Maintenance" });
  const [rzp, setRzp] = useState({ mode: "", keyId: "", secret: "" });
  const [rzpSaving, setRzpSaving] = useState(false);
  const [rzpTesting, setRzpTesting] = useState(false);
  const prevId = useState<string | null>(null);

  if (branch && branch.id !== prevId[0]) {
    prevId[1](branch.id);
    setForm({ name: branch.name, location: branch.location, status: branch.status });
    setRzp({
      mode: settings[branchSettingKey(branch.name, "razorpayMode")] ?? "",
      keyId: settings[branchSettingKey(branch.name, "razorpayKeyId")] ?? "",
      secret: "",
    });
  }

  const handleSubmit = async () => {
    if (!branch || !form.name) { toast({ title: "Missing fields", description: "Branch name is required.", variant: "destructive" }); return; }
    try {
      const res = await fetch("/api/branches", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: branch.id, name: form.name, location: form.location, status: form.status }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update branch."); }
      const saved = await res.json();
      updateBranch(branch.id, saved);
      toast({ title: "Branch Updated", description: `${form.name} has been updated.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update branch", description: e.message, variant: "destructive" });
    }
  };

  const cleanKey = (v: string) => (v || "").replace(/\s+/g, "");
  const handleRzpSave = async () => {
    if (!branch) return;
    if (rzp.mode && !["disabled", "test", "live"].includes(rzp.mode)) {
      toast({ title: "Invalid mode", description: "Choose Disabled, Test, or Live.", variant: "destructive" });
      return;
    }
    if (rzp.keyId && rzp.mode === "test" && !cleanKey(rzp.keyId).startsWith("rzp_test_")) {
      toast({ title: "Key/Mode Mismatch", description: "Test mode needs a key starting with rzp_test_.", variant: "destructive" });
      return;
    }
    if (rzp.keyId && rzp.mode === "live" && !cleanKey(rzp.keyId).startsWith("rzp_live_")) {
      toast({ title: "Key/Mode Mismatch", description: "Live mode needs a key starting with rzp_live_.", variant: "destructive" });
      return;
    }
    setRzpSaving(true);
    try {
      const ops = [
        setAppSetting(branchSettingKey(branch.name, "razorpayMode"), rzp.mode),
        setAppSetting(branchSettingKey(branch.name, "razorpayKeyId"), cleanKey(rzp.keyId)),
      ];
      if (cleanKey(rzp.secret)) ops.push(setAppSetting(branchSettingKey(branch.name, "razorpayKeySecret"), cleanKey(rzp.secret)));
      const results = await Promise.all(ops.map((p) => Promise.resolve(p)));
      const failed = results.find((r) => r && !r.ok);
      if (failed) throw new Error(failed.error || "Failed to save.");
      toast({ title: "Branch Razorpay Saved", description: rzp.mode === "disabled" || !rzp.keyId ? `${branch.name} uses the global keys.` : `Dedicated keys saved for ${branch.name}.` });
      setRzp((r) => ({ ...r, secret: "" }));
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setRzpSaving(false);
    }
  };

  const handleRzpClear = async () => {
    if (!branch) return;
    setRzpSaving(true);
    try {
      await Promise.all([
        setAppSetting(branchSettingKey(branch.name, "razorpayMode"), ""),
        setAppSetting(branchSettingKey(branch.name, "razorpayKeyId"), ""),
        setAppSetting(branchSettingKey(branch.name, "razorpayKeySecret"), ""),
      ]);
      setRzp({ mode: "", keyId: "", secret: "" });
      toast({ title: "Branch Override Cleared", description: `${branch.name} now uses the global Razorpay keys.` });
    } catch (e: any) {
      toast({ title: "Could not clear", description: e.message, variant: "destructive" });
    } finally {
      setRzpSaving(false);
    }
  };

  const handleRzpTest = async () => {
    if (!branch) return;
    setRzpTesting(true);
    try {
      const res = await fetch("/api/payments/razorpay/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branch.name }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Connection test failed.");
      toast({ title: "Razorpay Connected", description: `${branch.name}: credentials accepted in ${body.mode} mode (${body.keyPrefix}).` });
    } catch (e: any) {
      toast({ title: "Connection Failed", description: e.message, variant: "destructive" });
    } finally {
      setRzpTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Edit Branch</DialogTitle><DialogDescription>Update branch details.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Branch Name *</Label><Input placeholder="Branch name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        {branch && form.name !== branch.name && (
          <p className="text-[11px] text-warning">Renaming disconnects this branch&apos;s dedicated Razorpay keys (they are stored under the old name) — re-enter them below after renaming.</p>
        )}
        <div className="space-y-2"><Label>Location</Label><Input placeholder="Address / city" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
        <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Maintenance" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Maintenance">Maintenance</SelectItem></SelectContent></Select></div>
        <div className="rounded-lg border border-success/30 bg-success/5 p-3 space-y-3">
          <div>
            <p className="text-xs font-bold flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5 text-success" /> Razorpay for {branch?.name}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Dedicated keys for this branch only. Leave empty to use the global keys from Settings → Online Payments.</p>
          </div>
          <div className="space-y-2">
            <Label>Mode</Label>
            <Select value={rzp.mode} onValueChange={(v) => setRzp((r) => ({ ...r, mode: v }))}>
              <SelectTrigger><SelectValue placeholder="Use global" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled (use global)</SelectItem>
                <SelectItem value="test">Test mode</SelectItem>
                <SelectItem value="live">Live mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Key ID</Label><Input className="font-mono text-xs" placeholder="rzp_… (this branch)" value={rzp.keyId} onChange={(e) => setRzp((r) => ({ ...r, keyId: e.target.value.replace(/\s+/g, "") }))} /></div>
          <div className="space-y-2"><Label>Key Secret</Label><Input className="font-mono text-xs" type="password" placeholder="Enter to set/update" value={rzp.secret} onChange={(e) => setRzp((r) => ({ ...r, secret: e.target.value }))} /></div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" className="h-7 text-[11px]" onClick={handleRzpSave} disabled={rzpSaving}>{rzpSaving ? "Saving…" : "Save Branch Keys"}</Button>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleRzpTest} disabled={rzpTesting}>{rzpTesting ? "Testing…" : "Test"}</Button>
            <Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive" onClick={handleRzpClear} disabled={rzpSaving}>Use Global</Button>
          </div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update Branch</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Upload Record Dialog =====
function UploadRecordDialog({ open, onOpenChange, onUpload, patients, recordTypes }: { open: boolean; onOpenChange: (v: boolean) => void; onUpload?: (rec: { patient: string; type: string; notes: string }) => void; patients: string[]; recordTypes: string[] }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ patient: "", type: "Prescription", notes: "" });
  const handleSubmit = () => {
    if (!form.patient) { toast({ title: "Missing fields", description: "Patient name is required.", variant: "destructive" }); return; }
    onUpload?.({ patient: form.patient, type: form.type, notes: form.notes });
    toast({ title: "Record Uploaded", description: `${form.type} for ${form.patient} uploaded successfully.` });
    setForm({ patient: "", type: "Prescription", notes: "" }); onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Upload Record</DialogTitle><DialogDescription>Upload a medical record for a patient.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Patient Name *</Label><SearchableField value={form.patient} onChange={(patient) => setForm({ ...form, patient })} options={patients} placeholder="Search/add patient" searchPlaceholder="Search patient or type custom name..." emptyLabel="Add patient name" /></div>
        <div className="space-y-2"><Label>Record Type</Label><SearchableField value={form.type} onChange={(type) => setForm({ ...form, type })} options={recordTypes} placeholder="Search/add record type" /></div>
        <div className="space-y-2"><Label>Notes</Label><Textarea placeholder="Additional notes..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Upload</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Export Dialog =====
function ExportDialog({ open, onOpenChange, format }: { open: boolean; onOpenChange: (v: boolean) => void; format: string }) {
  const { toast } = useToast();
  const { invoices, patients, appointments, departmentNames } = useBranchData();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [department, setDepartment] = useState("all");
  const [reportType, setReportType] = useState("all");
  const handleExport = () => {
    const escCsv = (v: unknown) => {
      const s = String(v ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const inRange = (d?: string) => {
      if (!d) return true;
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
    let headers: string[];
    let rows: (string | number)[][];
    if (reportType === "patients") {
      headers = ["UHID", "Name", "Gender", "Age", "Phone", "Status", "Branch", "Registered On"];
      rows = patients.filter((p) => inRange(p.registeredOn)).map((p) => [p.uhid, p.name, p.gender, p.age, p.phone, p.status, p.branch, p.registeredOn]);
    } else if (reportType === "appointments") {
      headers = ["Token", "Patient", "Doctor", "Department", "Date", "Time", "Type", "Status", "Branch"];
      rows = appointments.filter((a) => inRange(a.date) && (department === "all" || (a.department || "").toLowerCase() === department)).map((a) => [a.token, a.patientName, a.doctorName, a.department, a.date, a.time, a.type, a.status, a.branch]);
    } else {
      headers = ["Invoice No", "Patient", "Date", "Subtotal", "Tax", "Discount", "Total", "Paid", "Status", "Branch"];
      rows = invoices.filter((i) => inRange(i.date)).map((i) => [i.invoiceNo, i.patientName, i.date, i.subtotal, i.tax, i.discount, i.total, i.paidAmount, i.status, i.branch]);
    }
    const csv = [headers, ...rows].map((r) => r.map(escCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `report-${reportType}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export Complete", description: `Reports exported as ${format} successfully.` });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Export as {format}</DialogTitle><DialogDescription>Choose what to include in your {format} export.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Date Range</Label><div className="grid grid-cols-2 gap-2"><Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /><Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div></div>
        <div className="space-y-2"><Label>Departments</Label><Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Departments</SelectItem>{departmentNames.map((d) => <SelectItem key={d} value={d.toLowerCase()}>{d}</SelectItem>)}</SelectContent></Select><p className="text-[11px] text-muted-foreground">Applies to appointment exports.</p></div>
        <div className="space-y-2"><Label>Report Type</Label><Select value={reportType} onValueChange={setReportType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Reports</SelectItem><SelectItem value="revenue">Revenue</SelectItem><SelectItem value="patients">Patient Reports</SelectItem><SelectItem value="appointments">Appointments</SelectItem></SelectContent></Select></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleExport}>Export {format}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Reports Module ===== 
export function ReportsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [exportFormat, setExportFormat] = useState<string | null>(null);
  const { invoices, patients, appointments, doctors, branch, medicines, insuranceClaims, campaigns, departmentNames } = useBranchData();

  // Department names for revenue attribution — admin-managed list first,
  // falling back to any department spelling already on doctors.
  const deptPattern = [...new Set([...departmentNames, ...doctors.map((d) => d.department).filter(Boolean)])]
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const deptRx = deptPattern ? new RegExp(`(?:${deptPattern})`) : null;

  // Month selector: "all" keeps every report all-time; picking a month
  // filters every report body + the snapshot below to that month.
  const [reportMonth, setReportMonth] = useState("all");
  const monthOptions = (() => {
    const opts: { value: string; label: string }[] = [];
    const now = new Date();
    for (let back = 0; back < 12; back++) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      opts.push({ value, label: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }) });
    }
    return opts;
  })();
  const monthLabel = reportMonth === "all" ? "All time" : (monthOptions.find((m) => m.value === reportMonth)?.label ?? reportMonth);
  const inMonth = (d?: string) => reportMonth === "all" || (d || "").startsWith(reportMonth);
  const mInvoices = invoices.filter((i) => inMonth(i.date));
  const mPatients = patients.filter((p) => inMonth(p.registeredOn || p.lastVisit || ""));
  const mAppointments = appointments.filter((a) => inMonth(a.date));
  const mClaims = insuranceClaims.filter((c) => inMonth(c.date));

  const totalRevenue = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const avgRevPerPatient = patients.length > 0 ? Math.round(totalRevenue / patients.length) : 0;
  const avgRating = doctors.length > 0 ? (doctors.reduce((s, d) => s + d.rating, 0) / doctors.length) : 0;

  const deptMap = new Map<string, { revenue: number; opd: number; ipd: number }>();
  for (const d of doctors) {
    const dept = d.department || "General Medicine";
    const existing = deptMap.get(dept) || { revenue: 0, opd: 0, ipd: 0 };
    deptMap.set(dept, existing);
  }
  for (const inv of invoices) {
    for (const item of inv.items) {
      const dept = deptRx ? item.description.match(deptRx)?.[0] : undefined;
      if (dept) {
        const existing = deptMap.get(dept) || { revenue: 0, opd: 0, ipd: 0 };
        existing.revenue += item.amount;
        deptMap.set(dept, existing);
      }
    }
  }
  const revenueByDept = Array.from(deptMap.entries()).map(([dept, data]) => ({ dept, ...data }));

  // Live monthly trend from this branch's own invoices, registrations, visits.
  const monthlyTrend = (() => {
    const months: { key: string; month: string; revenue: number; patients: number; appointments: number }[] = [];
    const now = new Date();
    for (let back = 7; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        month: d.toLocaleDateString("en-US", { month: "short" }),
        revenue: 0,
        patients: 0,
        appointments: 0,
      });
    }
    const bucket = (dateStr: string) => months.find((m) => (dateStr || "").startsWith(m.key));
    for (const inv of invoices) {
      const b = bucket(inv.date);
      if (b) b.revenue += inv.paidAmount || 0;
    }
    for (const p of patients) {
      const b = bucket(p.registeredOn || p.lastVisit || "");
      if (b) b.patients += 1;
    }
    for (const a of appointments) {
      const b = bucket(a.date);
      if (b && a.status !== "Cancelled") b.appointments += 1;
    }
    return months;
  })();

  const reportTypes = [
    { title: "Revenue Reports", desc: "Daily, weekly, monthly revenue", icon: TrendingUp, color: "primary" },
    { title: "Doctor Reports", desc: "Performance & consultations", icon: Users, color: "info" },
    { title: "Department Reports", desc: "Department-wise analytics", icon: Building2, color: "success" },
    { title: "Patient Reports", desc: "Demographics & history", icon: FileText, color: "warning" },
    { title: "Appointment Reports", desc: "Booking & no-show analysis", icon: Calendar, color: "primary" },
    { title: "Insurance Reports", desc: "Claims & settlements", icon: Shield, color: "info" },
    { title: "Inventory Reports", desc: "Stock & consumables", icon: Package, color: "success" },
    { title: "Marketing Reports", desc: "Campaign performance", icon: BarChart3, color: "warning" },
  ];

  const showExport = canAddAnything(currentUser.role) || canManageAccounts(currentUser.role);

  const openReport = (title: string) => {
    const hospital = settings.hospitalName || "MediCore Hospital";
    const generatedAt = new Date().toLocaleString();
    const admin = isAdmin(currentUser.role);
    const esc = (s: unknown) => String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
    const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
    const kv = (k: string, v: string) => `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;color:#6b7280">${esc(k)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb;text-align:right;font-weight:600">${esc(v)}</td></tr>`;
    const head = (cols: string[]) => `<tr>${cols.map((c) => `<th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f3f4f6;text-align:left;font-size:12px">${esc(c)}</th>`).join("")}</tr>`;
    const row = (vals: string[], right = -1) => `<tr>${vals.map((v, i) => `<td style="padding:8px 12px;border:1px solid #e5e7eb;${i === right ? "text-align:right;font-weight:600" : ""}">${esc(v)}</td>`).join("")}</tr>`;
    const section = (h: string, tableHtml: string) => `<h3 style="font-size:14px;margin:20px 0 8px">${esc(h)}</h3><table style="width:100%;border-collapse:collapse;font-size:13px">${tableHtml}</table>`;

    // Month-scoped datasets for this report (all-time when "All time").
    const F = (d?: string) => reportMonth === "all" || (d || "").startsWith(reportMonth);
    const rInvoices = invoices.filter((i) => F(i.date));
    const rPatients = patients.filter((p) => F(p.registeredOn || p.lastVisit || ""));
    const rAppointments = appointments.filter((a) => F(a.date));
    const rClaims = insuranceClaims.filter((c) => F(c.date));
    const rCampaigns = campaigns.filter((c) => F(c.startDate));
    const rCollected = rInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const rTitle = reportMonth === "all" ? title : `${title} — ${monthLabel}`;
    // Department revenue rebuilt from the scoped invoices.
    const rDeptMap = new Map<string, { revenue: number; opd: number; ipd: number }>();
    for (const d of doctors) rDeptMap.set(d.department || "General Medicine", rDeptMap.get(d.department || "General Medicine") || { revenue: 0, opd: 0, ipd: 0 });
    for (const inv of rInvoices) {
      for (const item of inv.items) {
        const dept = deptRx ? item.description.match(deptRx)?.[0] : undefined;
        if (dept) {
          const existing = rDeptMap.get(dept) || { revenue: 0, opd: 0, ipd: 0 };
          existing.revenue += item.amount;
          rDeptMap.set(dept, existing);
        }
      }
    }
    const rRevenueByDept = Array.from(rDeptMap.entries()).map(([dept, data]) => ({ dept, ...data }));

    let body = "";
    if (title === "Revenue Reports") {
      const trendRows = reportMonth === "all" ? monthlyTrend : monthlyTrend.filter((m) => m.key === reportMonth);
      body = `<table><tbody>${kv("Total Collected", inr(rCollected))}${kv("Invoices", String(rInvoices.length))}${kv("Outstanding", inr(rInvoices.reduce((s, i) => s + Math.max(0, (i.total || 0) - (i.paidAmount || 0)), 0)))}</tbody></table>` +
        section(`Month-wise Collection (branch) — ${monthLabel}`, head(["Month", "Collected", "Visits", "New Patients"]) + trendRows.map((m) => row([m.month, inr(m.revenue), String(m.appointments), String(m.patients)], 1)).join(""));
    } else if (title === "Doctor Reports") {
      body = section(`Doctor performance (branch) — ${monthLabel}`, head(["Doctor", "Department", "Visits", "Fee"]) + doctors.map((d) => {
        const visits = rAppointments.filter((a) => a.doctorName === d.name && a.status !== "Cancelled").length;
        return row([d.name, d.department || d.specialization || "—", String(visits), inr(d.consultationFee || 0)], 2);
      }).join(""));
    } else if (title === "Department Reports") {
      body = section(`Department analytics (branch) — ${monthLabel}`, head(["Department", "Revenue", "OPD", "IPD"]) + rRevenueByDept.map((d) => row([d.dept, inr(d.revenue), String(d.opd), String(d.ipd)], 1)).join(""));
    } else if (title === "Patient Reports") {
      const byStatus = new Map<string, number>();
      for (const p of rPatients) byStatus.set(p.status, (byStatus.get(p.status) || 0) + 1);
      body = `<table><tbody>${kv("Total Patients", String(rPatients.length))}${[...byStatus.entries()].map(([s, n]) => kv(s, String(n))).join("")}</tbody></table>` +
        section(`Recent registrations (branch) — ${monthLabel}`, head(["Name", "UHID", "Phone", "Status"]) + rPatients.slice(0, 30).map((p) => row([p.name, p.uhid, p.phone, p.status])).join(""));
    } else if (title === "Appointment Reports") {
      const byStatus = new Map<string, number>();
      for (const a of rAppointments) byStatus.set(a.status, (byStatus.get(a.status) || 0) + 1);
      const noShow = byStatus.get("No-show") || 0;
      body = `<table><tbody>${kv("Total Appointments", String(rAppointments.length))}${[...byStatus.entries()].map(([s, n]) => kv(s, String(n))).join("")}${kv("No-show Rate", rAppointments.length > 0 ? `${Math.round((noShow / rAppointments.length) * 100)}%` : "0%")}</tbody></table>`;
    } else if (title === "Insurance Reports") {
      const claimed = rClaims.reduce((s, c) => s + c.claimAmount, 0);
      const approved = rClaims.reduce((s, c) => s + c.approvedAmount, 0);
      const byStatus = new Map<string, number>();
      for (const c of rClaims) byStatus.set(c.status, (byStatus.get(c.status) || 0) + 1);
      body = `<table><tbody>${kv("Claims", String(rClaims.length))}${kv("Claimed", inr(claimed))}${kv("Approved", inr(approved))}${[...byStatus.entries()].map(([s, n]) => kv(s, String(n))).join("")}</tbody></table>` +
        section(`Claims (branch) — ${monthLabel}`, head(["Claim #", "Patient", "Provider", "Claimed", "Approved", "Status"]) + rClaims.slice(0, 30).map((c) => row([c.claimNo, c.patientName, c.provider, inr(c.claimAmount), c.approvedAmount > 0 ? inr(c.approvedAmount) : "—", c.status], 3)).join(""));
    } else if (title === "Inventory Reports") {
      const low = medicines.filter((m) => m.stock <= m.reorderLevel);
      body = `<table><tbody>${kv("Medicines", String(medicines.length))}${kv("Low / Out of Stock", String(low.length))}${kv("Stock Value", inr(medicines.reduce((s, m) => s + m.stock * m.price, 0)))}</tbody></table>` +
        section("Low stock (branch)", head(["Medicine", "Stock", "Reorder At", "Price"]) + low.slice(0, 30).map((m) => row([m.name, `${m.stock} (${m.stripSize || 10}/sheet)`, String(m.reorderLevel), inr(m.price)], 3)).join(""));
    } else if (title === "Marketing Reports") {
      const reach = rCampaigns.reduce((s, c) => s + c.audience, 0);
      const conv = rCampaigns.reduce((s, c) => s + c.conversions, 0);
      body = `<table><tbody>${kv("Campaigns", String(rCampaigns.length))}${kv("Reach", reach.toLocaleString("en-IN"))}${kv("Conversions", conv.toLocaleString("en-IN"))}</tbody></table>` +
        section(`Campaigns (branch) — ${monthLabel}`, head(["Name", "Type", "Status", "Audience", "Conversions"]) + rCampaigns.slice(0, 30).map((c) => row([c.name, c.type, c.status, c.audience.toLocaleString("en-IN"), String(c.conversions)], 3)).join(""));
    } else {
      const metrics: [string, string][] = [
        ["Total Patients", rPatients.length.toLocaleString("en-IN")],
        ["Total Doctors", doctors.length.toLocaleString("en-IN")],
        ["Total Appointments", rAppointments.length.toLocaleString("en-IN")],
        ["Total Invoices", rInvoices.length.toLocaleString("en-IN")],
      ];
      if (admin) {
        metrics.push(["Total Revenue", `₹${rCollected.toLocaleString("en-IN")}`]);
        metrics.push(["Avg Revenue / Patient", `₹${rPatients.length > 0 ? Math.round(rCollected / rPatients.length).toLocaleString("en-IN") : "0"}`]);
      }
      body = `<table><tbody>${metrics.map(([k, v]) => kv(k, v)).join("")}</tbody></table>`;
    }
    const win = window.open("", "_blank", "width=760,height=920");
    if (!win) {
      toast({ title: "Popup blocked", description: "Allow pop-ups to view this report.", variant: "destructive" });
      return;
    }
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(rTitle)} — ${esc(hospital)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 32px; max-width: 720px; margin: 0 auto; }
      .head { text-align: center; border-bottom: 3px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
      .hname { font-size: 26px; font-weight: 800; }
      .hsub { font-size: 14px; color: #374151; margin-top: 4px; font-weight: 600; }
      .meta { font-size: 12px; color: #6b7280; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 14px; }
      .foot { margin-top: 28px; text-align: center; font-size: 12px; color: #6b7280; border-top: 1px dashed #d1d5db; padding-top: 12px; }
      @media print { body { padding: 0; } }
    </style></head><body>
      <div class="head"><div class="hname">${esc(hospital)}</div><div class="hsub">${esc(rTitle)} — ${esc(branch)}</div></div>
      <p class="meta">Generated: ${esc(generatedAt)}</p>
      ${body}
      <div class="foot">System-generated ${esc(rTitle.toLowerCase())} for ${esc(branch)}.</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Reports & Analytics"
        description={`Live branch data — showing ${branch} only. Switch branch in the top bar to compare.`}
        icon={BarChart3}
        action={
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Select value={reportMonth} onValueChange={setReportMonth}>
              <SelectTrigger className="h-8 w-[160px] text-xs sm:text-sm" title="View a single month or all time"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                {monthOptions.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
            {showExport ? (
              <>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm hidden sm:flex" onClick={() => setExportFormat("PDF")}><FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> PDF</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm hidden sm:flex" onClick={() => setExportFormat("Excel")}><Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Excel</Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs sm:text-sm" onClick={() => setExportFormat("CSV")}><Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> CSV</Button>
              </>
            ) : undefined}
          </div>
        }
      />

      {reportMonth !== "all" && (
        <Card className="border-primary/30 bg-primary/[0.03]">
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs">
              <span className="font-semibold text-sm">{monthLabel} Snapshot</span>
              <span>Collected <strong>₹{mInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0).toLocaleString("en-IN")}</strong></span>
              <span>{mInvoices.length} bill{mInvoices.length === 1 ? "" : "s"}</span>
              <span>{mPatients.length} new patient{mPatients.length === 1 ? "" : "s"}</span>
              <span>{mAppointments.filter((a) => a.status !== "Cancelled").length} visits</span>
              <span>{mClaims.length} claim{mClaims.length === 1 ? "" : "s"} (₹{mClaims.reduce((s, c) => s + c.approvedAmount, 0).toLocaleString("en-IN")} approved)</span>
              <span className="text-muted-foreground">Every report below opens filtered to this month.</span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Total Revenue (YTD)" value={totalRevenue >= 10000000 ? `₹${(totalRevenue / 10000000).toFixed(2)}Cr` : `₹${(totalRevenue / 100000).toFixed(1)}L`} icon={TrendingUp} color="success" />
        <StatCard title="Total Patients" value={patients.length.toLocaleString()} icon={Users} color="primary" />
        <StatCard title="Avg Revenue/Patient" value={`₹${avgRevPerPatient.toLocaleString("en-IN")}`} icon={BarChart3} color="info" />
        <StatCard title="Satisfaction Score" value={`${avgRating.toFixed(1)}/5`} icon={CheckCircle2} color="warning" subtitle={`Based on ${doctors.length} doctor ratings`} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {reportTypes.map((r) => {
          const Icon = r.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
          };
          return (
            <Card key={r.title} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl mb-3 ${colorMap[r.color as keyof typeof colorMap]}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                <Button variant="ghost" size="sm" className="w-full mt-3 text-xs" onClick={() => openReport(r.title)}>View Report</Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Revenue by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={revenueByDept} layout="vertical" margin={{ left: 20, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 100000).toFixed(0)}L`} />
                <YAxis type="category" dataKey="dept" tick={{ fontSize: 10, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} width={80} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} cursor={{ fill: "oklch(0.96 0.005 240)" }} formatter={(v: number) => `₹${v.toLocaleString("en-IN")}`} />
                <Bar dataKey="revenue" radius={[0, 6, 6, 0]} fill="oklch(0.55 0.22 259)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Monthly Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyTrend} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.9 0.005 240)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.52 0.02 250)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}Cr`} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                <Line type="monotone" dataKey="revenue" stroke="oklch(0.55 0.22 259)" strokeWidth={2.5} dot={{ r: 3 }} name="Revenue" />
                <Line type="monotone" dataKey="patients" stroke="oklch(0.62 0.19 155)" strokeWidth={2} dot={{ r: 3 }} name="Patients" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {exportFormat && <ExportDialog open={!!exportFormat} onOpenChange={(v) => { if (!v) setExportFormat(null); }} format={exportFormat} />}
    </div>
  );
}

// ===== Staff Module =====
export function StaffModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const deleteStaffMember = useAppStore((s) => s.deleteStaffMember);
  const deleteUser = useAppStore((s) => s.deleteUser);
  const removeDoctorByStaff = useAppStore((s) => s.removeDoctorByStaff);
  const { staffMembers } = useBranchData();
  const [search, setSearch] = useState("");
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [editStaff, setEditStaff] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [resetTarget, setResetTarget] = useState<{ name: string; email: string } | null>(null);
  const filtered = staffMembers.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.role.toLowerCase().includes(search.toLowerCase()) ||
    (s.staffId && s.staffId.toLowerCase().includes(search.toLowerCase()))
  );

  const showAdd = canManageStaff(currentUser.role);
  const showAdminActions = isAdmin(currentUser.role);

  const handleDeleteStaff = async () => {
    if (!deleteTarget) return;
    const staff = staffMembers.find((s) => s.id === deleteTarget.id);
    try {
      const res = await fetch("/api/staff", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to delete staff member.");
      }
      if (staff) {
        // Remove the linked login account + doctor profile from Supabase too,
        // otherwise the deleted person could still sign in after a refresh.
        try {
          await fetch("/api/users", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: staff.email }),
          });
        } catch {
          // Non-fatal: user row may not exist.
        }
        const doc = useAppStore.getState().doctors.find((d) => d.email === staff.email || d.name === staff.name);
        if (doc) {
          try {
            await fetch("/api/doctors", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: doc.id }),
            });
          } catch {
            // Non-fatal: local removal below still applies.
          }
        }
        deleteUser(staff.email);
        removeDoctorByStaff({ email: staff.email, name: staff.name });
      }
      deleteStaffMember(deleteTarget.id);
      toast({ title: "Staff removed", description: `${deleteTarget.name} has been deleted from Supabase.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete staff", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Staff Management"
        description="Doctors, nurses, technicians, and administrative staff"
        icon={IdCard}
        action={showAdd ? <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => setAddStaffOpen(true)}><UserPlus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Staff</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Total Staff" value={staffMembers.length.toString()} icon={Users} color="primary" />
        <StatCard title="Active Today" value={staffMembers.filter(s => s.status === "Active").length.toString()} icon={CheckCircle2} color="success" />
        <StatCard title="On Leave" value={staffMembers.filter(s => s.status === "On Leave").length.toString()} icon={Calendar} color="warning" />
        <StatCard title="Avg Attendance" value={staffMembers.length > 0 ? `${Math.round(staffMembers.reduce((s, m) => s + m.attendance, 0) / staffMembers.length)}%` : "—"} icon={TrendingUp} color="info" />
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search staff..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="hidden md:table-cell">Department</TableHead>
                  <TableHead className="hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="hidden md:table-cell">Shift</TableHead>
                  <TableHead className="hidden lg:table-cell">Attendance</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Salary</TableHead>
                  <TableHead>Status</TableHead>
                    {(showAdd || showAdminActions) && <TableHead className="w-[120px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell className="font-mono text-xs text-muted-foreground">{s.staffId || s.id}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-9 w-9">
                          {s.photo ? (
                            <AvatarImage src={s.photo} alt={s.name} className="object-cover" />
                          ) : null}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {s.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{s.role}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.department}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs">{s.phone}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{s.shift}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${s.attendance >= 95 ? "bg-success" : s.attendance >= 90 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${s.attendance}%` }} />
                        </div>
                        <span className="text-xs">{s.attendance}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm font-medium">₹{s.salary.toLocaleString("en-IN")}</TableCell>
                    <TableCell><StatusBadge status={s.status} /></TableCell>
                    {(showAdd || showAdminActions) && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {showAdd && (
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Edit" onClick={() => setEditStaff(s)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {showAdminActions && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="Reset Password" onClick={() => setResetTarget({ name: s.name, email: s.email })}>
                              <Shield className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {showAdminActions && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" title="Delete" onClick={() => setDeleteTarget({ id: s.id, name: s.name })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AddStaffDialog open={addStaffOpen} onOpenChange={setAddStaffOpen} />
      <EditStaffDialog open={!!editStaff} onOpenChange={(v) => { if (!v) setEditStaff(null); }} staff={editStaff} />
      {resetTarget && <AdminResetPasswordDialog open={!!resetTarget} onOpenChange={(v) => { if (!v) setResetTarget(null); }} targetUser={resetTarget} />}
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Staff Member</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDeleteStaff}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Edit Inventory Item Dialog =====
function EditItemDialog({ open, onOpenChange, item }: { open: boolean; onOpenChange: (v: boolean) => void; item: InventoryItem | null }) {
  const { toast } = useToast();
  const updateInventoryItem = useAppStore((s) => s.updateInventoryItem);
  const [form, setForm] = useState({ name: "", category: "Equipment", supplier: "", location: "", stock: "", reorderLevel: "", price: "", unit: "", status: "In Stock" as string });
  const prevId = useState<string | null>(null);

  if (item && item.id !== prevId[0]) {
    prevId[1](item.id);
    setForm({
      name: item.name, category: item.category, supplier: item.supplier, location: item.location,
      stock: String(item.stock), reorderLevel: String(item.reorderLevel), price: String(item.price),
      unit: item.unit, status: item.status,
    });
  }

  const handleSubmit = async () => {
    if (!item || !form.name) { toast({ title: "Missing fields", description: "Item name is required.", variant: "destructive" }); return; }
    const updates = {
      name: form.name, category: form.category as "Equipment" | "Consumable" | "Furniture" | "IT",
      supplier: form.supplier, location: form.location, stock: parseInt(form.stock) || 0,
      reorderLevel: parseInt(form.reorderLevel) || 0, price: parseFloat(form.price) || 0,
      unit: form.unit, status: form.status as "In Stock" | "Low Stock" | "Out of Stock" | "Follow Up",
    };
    try {
      const res = await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, ...updates }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update item."); }
      const saved = await res.json();
      updateInventoryItem(item.id, saved);
      toast({ title: "Item Updated", description: `${form.name} has been updated.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update item", description: e.message, variant: "destructive" });
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Inventory Item</DialogTitle><DialogDescription>Update inventory item details.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Item Name *</Label><Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Category</Label><Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Equipment">Equipment</SelectItem><SelectItem value="Consumable">Consumable</SelectItem><SelectItem value="Furniture">Furniture</SelectItem><SelectItem value="IT">IT</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="In Stock">In Stock</SelectItem><SelectItem value="Low Stock">Low Stock</SelectItem><SelectItem value="Out of Stock">Out of Stock</SelectItem><SelectItem value="Follow Up">Follow Up</SelectItem></SelectContent></Select></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Stock Quantity</Label><Input type="number" placeholder="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
          <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" placeholder="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Price (₹)</Label><Input type="number" placeholder="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
          <div className="space-y-2"><Label>Supplier</Label><Input placeholder="Supplier name" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Location</Label><Input placeholder="Storage location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update Item</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface IssueRow { itemId: string; qty: string; }

function IssueItemDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addInvoice = useAppStore((s) => s.addInvoice);
  const updateInventoryItem = useAppStore((s) => s.updateInventoryItem);
  const settings = useAppStore((s) => s.settings);
  const branchData = useBranchData();
  const [issueTo, setIssueTo] = useState<"patient" | "internal">("patient");
  const [patientName, setPatientName] = useState("");
  const [department, setDepartment] = useState("");
  const [rows, setRows] = useState<IssueRow[]>([{ itemId: "", qty: "" }]);
  const [collected, setCollected] = useState(true);
  const [saving, setSaving] = useState(false);

  const patientOptions = branchData.patients.map((p) => p.name);
  const itemOptions = branchData.inventoryItems
    .filter((m) => m.stock > 0)
    .map((m) => `${m.name} — ₹${m.price}/${m.unit} (${m.stock} in stock)`);

  const resolveItem = (idOrName: string) =>
    branchData.inventoryItems.find((m) => m.id === idOrName || m.name === idOrName);

  const lines = rows.map((r) => {
    const item = resolveItem(r.itemId);
    const qty = Math.max(0, Math.round(parseFloat(r.qty) || 0));
    return { item, qty, amount: qty * (item?.price || 0) };
  });
  const validLines = lines.filter((l) => l.item && l.qty > 0);
  const total = validLines.reduce((s, l) => s + l.amount, 0);

  const handleSubmit = async () => {
    const patient = branchData.patients.find((p) => p.name === patientName);
    const billName = issueTo === "patient"
      ? patientName.trim() || patient?.name || ""
      : `Internal (${department.trim() || "Department"})`;
    if (!billName) { toast({ title: "Recipient required", description: "Search a patient or enter a department for internal use.", variant: "destructive" }); return; }
    if (validLines.length === 0) { toast({ title: "No items", description: "Add at least one item with quantity.", variant: "destructive" }); return; }
    const short = validLines.find((l) => l.qty > (l.item?.stock || 0));
    if (short) { toast({ title: "Insufficient stock", description: `Only ${short.item?.stock} ${short.item?.unit} of ${short.item?.name} available.`, variant: "destructive" }); return; }
    setSaving(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const invRes = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `inv${Date.now()}`,
          patientId: patient?.id || "",
          patientName: billName,
          date: today,
          dueDate: today,
          items: validLines.map((l) => ({
            description: `${l.item!.name} — ${l.qty} ${l.item!.unit}`,
            category: "Other",
            quantity: l.qty,
            rate: l.item!.price,
            amount: l.amount,
          })),
          subtotal: total,
          tax: 0,
          discount: 0,
          total,
          paidAmount: collected ? total : 0,
          status: collected ? "Paid" : "Pending",
          paymentMethod: collected ? "Cash" : "",
          branch: branchData.branch,
          paidDate: collected ? today : "",
        }),
      });
      if (!invRes.ok) { const b = await invRes.json().catch(() => ({})); throw new Error(b.error || "Failed to create the bill."); }
      const savedInv = await invRes.json();
      const stockNotes: string[] = [];
      for (const l of validLines) {
        const item = l.item!;
        const newStock = Math.max(0, item.stock - l.qty);
        const status = newStock === 0 ? "Out of Stock" : newStock <= item.reorderLevel ? "Low Stock" : "In Stock";
        const res = await fetch("/api/inventory", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, stock: newStock, status }) });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `Stock update failed for ${item.name}. Bill ${savedInv.invoiceNo} was still created.`); }
        updateInventoryItem(item.id, await res.json());
        stockNotes.push(`${item.name}: ${item.stock} → ${newStock} ${item.unit}`);
      }
      addInvoice(savedInv);
      if (!printInvoice(savedInv, settings, patient)) {
        toast({ title: "Bill ready to download", description: "Allow pop-ups for auto-print, or download it from Billing." });
      }
      toast({ title: "Items Issued", description: `${validLines.length} item(s) billed ₹${total.toLocaleString("en-IN")} ${collected ? "collected" : "pending"} (${savedInv.invoiceNo}). Stock: ${stockNotes.join("; ")}.` });
      setPatientName("");
      setDepartment("");
      setRows([{ itemId: "", qty: "" }]);
      setCollected(true);
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not issue items", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Issue Items</DialogTitle><DialogDescription>Take stock for a patient or department — bills to Billing and cuts stock automatically.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs grid grid-cols-3 gap-2">
            <div><p className="text-muted-foreground">Items</p><p className="text-base font-bold">{validLines.length}</p></div>
            <div><p className="text-muted-foreground">Quantity</p><p className="text-base font-bold">{validLines.reduce((s, l) => s + l.qty, 0)}</p></div>
            <div><p className="text-muted-foreground">Bill total</p><p className="text-base font-bold text-primary">₹{total.toLocaleString("en-IN")}</p></div>
          </div>
          <div className="space-y-2">
            <Label>Issue To</Label>
            <div className="flex gap-1.5">
              {(["patient", "internal"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setIssueTo(m)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${issueTo === m ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                >
                  {m === "patient" ? "Patient" : "Internal / Department"}
                </button>
              ))}
            </div>
            {issueTo === "patient" ? (
              <SearchableField value={patientName} onChange={setPatientName} options={patientOptions} placeholder="Search patient or type custom name" searchPlaceholder="Search patient or type custom name..." emptyLabel="Use custom name" />
            ) : (
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue placeholder="Select department…" /></SelectTrigger>
                <SelectContent>{branchData.departmentNames.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setRows((l) => [...l, { itemId: "", qty: "" }])}><Plus className="h-3 w-3 mr-1" /> Add Item</Button>
            </div>
            {rows.map((r, i) => {
              const line = lines[i];
              return (
                <div key={i} className="rounded-lg border p-2 space-y-1.5">
                  <div className="grid grid-cols-[1fr_90px_32px] gap-1.5 items-center">
                    <SearchableField
                      value={(() => { const m = resolveItem(r.itemId); return m ? `${m.name} — ₹${m.price}/${m.unit} (${m.stock} in stock)` : r.itemId; })()}
                      onChange={(v) => {
                        const name = v.split(" — ₹")[0].trim();
                        const m = branchData.inventoryItems.find((x) => x.name === name);
                        setRows((l) => l.map((x, j) => (j === i ? { ...x, itemId: m ? m.id : name } : x)));
                      }}
                      options={itemOptions}
                      placeholder="Search item"
                      searchPlaceholder="Search in-stock items..."
                      emptyLabel="No item found"
                    />
                    <Input className="h-8 text-xs" type="number" min={0} placeholder="Qty" title="Quantity" value={r.qty} onChange={(e) => setRows((l) => l.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setRows((l) => l.filter((_, j) => j !== i))} title="Remove"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground text-right font-medium">
                    {line?.item ? `${line.qty} ${line.item.unit} × ₹${line.item.price.toLocaleString("en-IN")} = ₹${(line.amount || 0).toLocaleString("en-IN")}${line.qty > (line.item.stock || 0) ? " — exceeds stock!" : ""}` : "Pick an item above"}
                  </p>
                </div>
              );
            })}
          </div>
          <div className="space-y-2">
            <Label>Payment</Label>
            <Select value={collected ? "collected" : "pending"} onValueChange={(v) => setCollected(v === "collected")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collected">Collected now — Paid bill in Billing</SelectItem>
                <SelectItem value="pending">Not collected — Pending bill, collect later</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Issuing…" : `Issue • ₹${total.toLocaleString("en-IN")}`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Inventory Module =====
export function InventoryModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const { toast } = useToast();
  const deleteInventoryItem = useAppStore((s) => s.deleteInventoryItem);
  const addInventoryItem = useAppStore((s) => s.addInventoryItem);
  const { inventoryItems, invoices, branch } = useBranchData();
  const [search, setSearch] = useState("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [collectInvoice, setCollectInvoice] = useState<Invoice | null>(null);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const filtered = inventoryItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.category.toLowerCase().includes(search.toLowerCase())
  );
  const {
    pageItems: pagedItems, page: invPage, setPage: setInvPage,
    pageSize: invPageSize, setPageSize: setInvPageSize, totalPages: invPages, total: invTotal,
  } = usePagination(filtered, search);

  const showAdd = canAddAnything(currentUser.role);
  const showAdminActions = isAdmin(currentUser.role);
  const showIssue = showAdd || canEditModule(currentUser.role, "inventory");
  const todayStr = new Date().toISOString().split("T")[0];
  const recentIssues = invoices
    .filter((i) => i.date === todayStr && (i.items ?? []).some((it) => it.category === "Other"))
    .slice(0, 8);

  const inventoryIO: EntityIOConfig<InventoryItem> = {
    entity: "inventory items",
    filename: "inventory",
    columns: [
      { header: "name", sample: "Syringe 5ml" },
      { header: "category", sample: "Consumable" },
      { header: "supplier", sample: "MediSupply" },
      { header: "location", sample: "Store A" },
      { header: "stock", sample: "200" },
      { header: "reorderLevel", sample: "50" },
      { header: "price", sample: "12" },
      { header: "unit", sample: "pcs" },
      { header: "status", sample: "In Stock" },
    ],
    toRow: (m) => [m.name, m.category, m.supplier, m.location, m.stock, m.reorderLevel, m.price, m.unit, m.status],
    fromRow: (row, i) => {
      if (!row.name) throw new Error("name is required.");
      if (!["Equipment", "Consumable", "Furniture", "IT"].includes(row.category)) throw new Error(`Unknown category "${row.category}". Use Equipment/Consumable/Furniture/IT.`);
      const stock = parseInt(row.stock) || 0;
      return {
        id: `inv-item${Date.now()}${i}`,
        name: row.name,
        category: row.category,
        supplier: row.supplier || "",
        location: row.location || "",
        stock,
        reorderLevel: parseInt(row.reorderLevel) || 0,
        price: parseFloat(row.price) || 0,
        unit: row.unit || "pcs",
        lastRestocked: todayStr,
        status: stock > 0 ? "In Stock" : "Out of Stock",
        branch,
      };
    },
    endpoint: "/api/inventory",
    onImported: (saved) => addInventoryItem(saved),
  };

  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch("/api/inventory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b.error || "Failed to delete item.");
      }
      deleteInventoryItem(deleteTarget.id);
      toast({ title: "Item removed", description: `${deleteTarget.name} has been deleted.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete item", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Inventory Management"
        description="Medical equipment, consumables, and supplies"
        icon={Package}
        action={
          <div className="flex items-center gap-1.5">
            {showAdd && <ImportExportButtons config={inventoryIO} items={filtered} compact />}
            {showIssue && <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm border-success/50" onClick={() => setIssueOpen(true)}><Package className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Issue Item</Button>}
            {showAdd && <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => setAddItemOpen(true)}><Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Item</Button>}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Total Items" value={inventoryItems.length.toString()} icon={Package} color="primary" />
        <StatCard title="Total Value" value={`₹${(inventoryItems.reduce((s, i) => s + (i.price * i.stock), 0) / 100000).toFixed(1)}L`} icon={TrendingUp} color="success" />
        <StatCard title="Low Stock" value={inventoryItems.filter(i => i.status === "Low Stock").length.toString()} icon={AlertTriangle} color="warning" /> 
        <StatCard title="Out of Stock" value={inventoryItems.filter(i => i.status === "Out of Stock").length.toString()} icon={XCircle} color="destructive" />
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search inventory..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          <div className="rounded-lg border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Item</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="hidden md:table-cell">Supplier</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead className="text-right hidden md:table-cell">Price</TableHead>
                  <TableHead>Status</TableHead>
                  {showAdminActions && <TableHead className="w-[80px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/40 cursor-pointer">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          item.category === "Equipment" ? "bg-primary/10 text-primary" :
                          item.category === "Consumable" ? "bg-warning/10 text-warning" :
                          item.category === "Furniture" ? "bg-info/10 text-info" :
                          "bg-success/10 text-success"
                        }`}>
                          <Package className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.unit} • Restocked {item.lastRestocked}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{item.category}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{item.supplier}</TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{item.location}</TableCell>
                    <TableCell>
                      <div className="w-24">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium">{item.stock}</span>
                          <span className="text-muted-foreground">/ {item.reorderLevel}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full ${
                            item.stock === 0 ? "bg-destructive" :
                            item.stock < item.reorderLevel ? "bg-warning" : "bg-success"
                          }`} style={{ width: `${Math.min((item.stock / (item.reorderLevel * 2)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right hidden md:table-cell text-sm font-medium">₹{item.price.toLocaleString("en-IN")}</TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    {showAdminActions && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditItem(item)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget({ id: item.id, name: item.name })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="px-4 pt-2">
            <DataPagination page={invPage} totalPages={invPages} pageSize={invPageSize} total={invTotal} onPage={setInvPage} onPageSize={setInvPageSize} />
          </div>
        </CardContent>
      </Card>

      {recentIssues.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-success" /> Today&apos;s Issues ({recentIssues.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border overflow-hidden mx-4 mb-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Bill</TableHead>
                    <TableHead>Issued To</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[60px]">Collect</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentIssues.map((inv) => {
                    const outstanding = Math.max(0, (inv.total || 0) - (inv.paidAmount || 0));
                    return (
                      <TableRow key={inv.id} className="hover:bg-muted/40">
                        <TableCell className="font-mono text-xs">{inv.invoiceNo}</TableCell>
                        <TableCell className="text-sm">{inv.patientName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {(inv.items ?? []).filter((it) => it.category === "Other").map((it) => it.description).join("; ").slice(0, 80)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-medium">₹{(inv.total || 0).toLocaleString("en-IN")}</TableCell>
                        <TableCell><StatusBadge status={inv.status} /></TableCell>
                        <TableCell>
                          {outstanding > 0
                            ? <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => setCollectInvoice(inv)} title={`Collect ₹${outstanding.toLocaleString("en-IN")}`}><TrendingUp className="h-3.5 w-3.5" /></Button>
                            : <span className="text-[11px] text-success">Paid</span>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <AddItemDialog open={addItemOpen} onOpenChange={setAddItemOpen} />
      <IssueItemDialog open={issueOpen} onOpenChange={setIssueOpen} />
      <CollectMoneyDialog invoice={collectInvoice} onOpenChange={(v) => { if (!v) setCollectInvoice(null); }} title="Collect Payment" />
      <EditItemDialog open={!!editItem} onOpenChange={(v) => { if (!v) setEditItem(null); }} item={editItem} />
      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete Item</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteTarget.name}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
            <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={handleDeleteItem}>Delete</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ===== Create Role Dialog =====
const ROLE_MATRIX_MODULES: { key: string; label: string }[] = [
  { key: "patients", label: "Patients" },
  { key: "doctors", label: "Doctors" },
  { key: "appointments", label: "Appointments" },
  { key: "reception", label: "Reception" },
  { key: "opd", label: "OPD" },
  { key: "ipd", label: "IPD" },
  { key: "beds", label: "Beds" },
  { key: "billing", label: "Billing" },
  { key: "insurance", label: "Insurance" },
  { key: "accounts", label: "Accounts" },
  { key: "laboratory", label: "Laboratory" },
  { key: "radiology", label: "Radiology" },
  { key: "nursing", label: "Nursing" },
  { key: "pharmacy", label: "Pharmacy" },
  { key: "records", label: "Records" },
  { key: "crm", label: "CRM" },
  { key: "marketing", label: "Marketing" },
  { key: "reports", label: "Reports" },
  { key: "staff", label: "Staff" },
  { key: "attendance", label: "Attendance" },
  { key: "inventory", label: "Inventory" },
];

const ROLE_MATRIX_GROUPS: { group: string; keys: string[] }[] = [
  { group: "Patient Care", keys: ["patients", "doctors", "appointments", "reception"] },
  { group: "Operations", keys: ["opd", "ipd", "beds"] },
  { group: "Clinical", keys: ["laboratory", "radiology", "nursing", "pharmacy", "records"] },
  { group: "Business", keys: ["billing", "insurance", "accounts", "crm", "marketing"] },
  { group: "Admin", keys: ["reports", "staff", "attendance", "inventory"] },
];

function describeMatrix(matrix: RoleMatrix): string {
  const can = (action: MatrixAction) =>
    ROLE_MATRIX_MODULES.filter((m) => matrix[m.key]?.[action]).map((m) => m.label);
  const view = can("view");
  if (view.length === 0) return "Nothing yet — tick at least View on one module.";
  const parts = [`Sees ${view.slice(0, 4).join(", ")}${view.length > 4 ? ` +${view.length - 4} more` : ""}`];
  const add = can("add").filter((l) => l !== undefined);
  if (add.length > 0) parts.push(`can add in ${add.slice(0, 3).join(", ")}${add.length > 3 ? "…" : ""}`);
  const edit = can("edit");
  if (edit.length > 0) parts.push(`can edit ${edit.length} area${edit.length === 1 ? "" : "s"}`);
  const del = can("del");
  if (del.length > 0) parts.push(`can delete in ${del.join(", ")}`);
  else parts.push("cannot delete anything");
  return parts.join(" • ") + ".";
}

function RoleMatrixEditor({ matrix, onChange }: { matrix: RoleMatrix; onChange: (m: RoleMatrix) => void }) {
  const toggle = (mod: string, action: MatrixAction) => {
    onChange({ ...matrix, [mod]: { ...matrix[mod], [action]: !matrix[mod]?.[action] } });
  };
  const toggleGroupView = (keys: string[]) => {
    const allOn = keys.every((k) => matrix[k]?.view);
    const next = { ...matrix };
    for (const k of keys) next[k] = { ...next[k], view: !allOn, ...(allOn ? { add: false, edit: false, del: false } : {}) };
    onChange(next);
  };
  const grants = countMatrixGrants(matrix);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>What can this role do? ({grants} permissions)</Label>
        <span className="text-[10px] text-muted-foreground text-right">View = see the page • Add = create • Edit = change/collect • Del = delete<br />Dashboard + Settings always visible</span>
      </div>
      <div className="rounded-lg border overflow-hidden">
        <div className="grid grid-cols-[1fr_44px_44px_44px_44px] gap-0 bg-muted/60 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          <span>Module</span><span className="text-center" title="See the page">View</span><span className="text-center" title="Create new records">Add</span><span className="text-center" title="Change records, collect money">Edit</span><span className="text-center" title="Delete records">Del</span>
        </div>
        <div className="max-h-72 overflow-y-auto divide-y">
          {ROLE_MATRIX_GROUPS.map((g) => (
            <div key={g.group}>
              <div className="flex items-center justify-between bg-muted/30 px-2 py-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{g.group}</span>
                <button
                  type="button"
                  onClick={() => toggleGroupView(g.keys)}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  {g.keys.every((k) => matrix[k]?.view) ? "Hide all" : "Show all"}
                </button>
              </div>
              {g.keys.map((key) => {
                const label = ROLE_MATRIX_MODULES.find((m) => m.key === key)?.label ?? key;
                return (
                  <div key={key} className="grid grid-cols-[1fr_44px_44px_44px_44px] gap-0 items-center px-2 py-1">
                    <span className="text-xs truncate pr-1">{label}</span>
                    {(["view", "add", "edit", "del"] as MatrixAction[]).map((a) => (
                      <span key={a} className="flex justify-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary cursor-pointer"
                          checked={!!matrix[key]?.[a]}
                          onChange={() => toggle(key, a)}
                          title={`${label} — ${a === "view" ? "see the page" : a === "add" ? "create new" : a === "edit" ? "change/collect" : "delete"}`}
                        />
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2">
        <p className="text-xs"><span className="font-semibold">In plain words: </span>{describeMatrix(matrix)}</p>
      </div>
    </div>
  );
}

const SYSTEM_ROLE_NAMES: readonly string[] = SYSTEM_ROLES;

function CreateRoleDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addRoleDefinition = useAppStore((s) => s.addRoleDefinition);
  const currentUser = useAppStore((s) => s.currentUser);
  const storeBranches = useAppStore((s) => s.branches);
  const existingCustom = useAppStore((s) => s.roleDefinitions);
  const [form, setForm] = useState({ name: "", branch: "", branchId: "", description: "", template: "frontdesk" });
  const [nameMode, setNameMode] = useState<"pick" | "custom">("pick");
  const [matrix, setMatrix] = useState<RoleMatrix>(() => structuredClone(ROLE_TEMPLATES.frontdesk.matrix));

  const handleBranchChange = (branchName: string) => {
    const b = storeBranches.find((br) => br.name === branchName);
    setForm({ ...form, branch: branchName, branchId: b?.id || "" });
  };

  const applyTemplate = (key: string) => {
    setForm({ ...form, template: key });
    setMatrix(structuredClone(ROLE_TEMPLATES[key].matrix));
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.branch || !form.branchId) {
      toast({ title: "Missing fields", description: "Role name and branch are required.", variant: "destructive" });
      return;
    }
    if (SYSTEM_ROLE_NAMES.some((r) => r.toLowerCase() === form.name.trim().toLowerCase())) {
      toast({ title: "Name reserved", description: `"${form.name.trim()}" is a built-in system role. Pick a different name so permissions don't clash.`, variant: "destructive" });
      return;
    }
    if (existingCustom.some((r) => r.name.toLowerCase() === form.name.trim().toLowerCase())) {
      toast({ title: "Role exists", description: `A custom role named "${form.name.trim()}" already exists — edit it instead.`, variant: "destructive" });
      return;
    }
    if (countMatrixGrants(matrix) === 0) {
      toast({ title: "No permissions", description: "Tick at least one permission — otherwise nobody with this role can see anything.", variant: "destructive" });
      return;
    }
    addRoleDefinition({
      id: `role-${Date.now()}`,
      name: form.name.trim(),
      branch: form.branch,
      branchId: form.branchId,
      description: form.description || ROLE_TEMPLATES[form.template].label,
      permissions: matrixToPermissions(matrix),
      matrix: structuredClone(matrix),
      template: form.template,
      isActive: true,
      createdAt: new Date().toISOString().split("T")[0],
      createdBy: currentUser.email,
    });
    toast({ title: "Role Created & Enforced", description: `${form.name} is live — assign it to staff and their sidebar, buttons and login follow the matrix.` });
    setForm({ name: "", branch: "", branchId: "", description: "", template: "frontdesk" });
    setNameMode("custom");
    setMatrix(structuredClone(ROLE_TEMPLATES.frontdesk.matrix));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create Role</DialogTitle><DialogDescription>Pick an existing name or type a custom one — it appears in Staff creation instantly with its own dashboard.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role Name *</Label>
              {nameMode === "pick" ? (
                <Select value={form.name} onValueChange={(v) => { if (v === "__custom__") { setNameMode("custom"); setForm({ ...form, name: "" }); } else setForm({ ...form, name: v }); }}>
                  <SelectTrigger><SelectValue placeholder="Pick a role name…" /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ROLE_NAMES.map((r) => <SelectItem key={r} value={r}>{r} (system)</SelectItem>)}
                    {existingCustom.map((r) => <SelectItem key={r.id} value={r.name}>{r.name} (custom — already exists)</SelectItem>)}
                    <SelectItem value="__custom__">＋ Type a new custom name…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-1.5">
                  <Input placeholder="e.g. Senior Nurse" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Button variant="outline" size="sm" className="h-9 shrink-0" onClick={() => setNameMode("pick")} title="Pick from existing names">Pick</Button>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">New names show up in Staff → Add/Edit automatically.</p>
            </div>
            <div className="space-y-2"><Label>Branch *</Label><Select value={form.branch} onValueChange={handleBranchChange}><SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger><SelectContent>{storeBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name} — {b.location}</SelectItem>)}</SelectContent></Select></div>
          </div>
          {form.branch && <div className="rounded-lg bg-info/5 border border-info/20 p-2"><p className="text-xs text-info">Scoped to <strong>{form.branch}</strong> — data stays within this branch.</p></div>}
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} placeholder="Describe this role's responsibilities" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Start From Template</Label>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(ROLE_TEMPLATES).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  title={t.desc}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${form.template === key ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <RoleMatrixEditor matrix={matrix} onChange={setMatrix} />
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Create Role</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRoleDialog({ role, onClose }: { role: RoleDefinitionShape; onClose: () => void }) {
  const { toast } = useToast();
  const updateRoleDefinition = useAppStore((s) => s.updateRoleDefinition);
  const [description, setDescription] = useState(role.description || "");
  const [matrix, setMatrix] = useState<RoleMatrix>(() => structuredClone(role.matrix ?? emptyMatrix()));

  const handleSubmit = () => {
    updateRoleDefinition(role.id, {
      description,
      permissions: matrixToPermissions(matrix),
      matrix: structuredClone(matrix),
    });
    toast({ title: "Role Updated", description: `${role.name} permissions are enforced immediately for everyone with this role.` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Role — {role.name}</DialogTitle><DialogDescription>{role.branch} • changes apply instantly to all staff with this role.</DialogDescription></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <RoleMatrixEditor matrix={matrix} onChange={setMatrix} />
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Save Permissions</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditSystemRoleDialog({ role, settings, onSave, onClose, onSaved }: {
  role: string;
  settings: Record<string, string>;
  onSave: (key: string, value: string) => Promise<{ ok: boolean; error?: string } | void> | void;
  onClose: () => void;
  onSaved: (details: string) => void;
}) {
  const { toast } = useToast();
  const locked = role === "Admin"; // Admin always keeps full access.
  const editable = moduleConfig.filter((m) => m.key !== "dashboard" && m.key !== "settings");
  const [desc, setDesc] = useState(() => getRoleDesc(settings, role));
  const [picked, setPicked] = useState<string[]>(() => {
    const eff = getEffectiveModulesForRole(role as Role, settings)
      .map((m) => m.key)
      .filter((k) => k !== "dashboard" && k !== "settings");
    return eff;
  });
  const [saving, setSaving] = useState(false);

  const toggleMod = (key: string) => {
    if (locked) return;
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));
  };

  const persist = async (modules: string[] | null, description: string) => {
    setSaving(true);
    try {
      const ops: Promise<any>[] = [];
      if (!locked) ops.push(Promise.resolve(onSave(roleModulesKey(role), modules === null ? "" : JSON.stringify(modules))));
      ops.push(Promise.resolve(onSave(roleDescKey(role), description.trim())));
      const results = await Promise.all(ops);
      const failed = results.find((r) => r && r.ok === false);
      if (failed) throw new Error(failed.error || "Failed to save.");
      return true;
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    const ok = await persist(locked ? null : picked, desc);
    if (!ok) return;
    onSaved(`${role} role updated: ${locked ? "description changed" : `${picked.length} module${picked.length === 1 ? "" : "s"} granted`} (Dashboard + Settings always on).`);
    toast({ title: `${role} updated`, description: locked ? "Description saved." : "Module access applies instantly — sidebars update on next navigation." });
    onClose();
  };

  const handleReset = async () => {
    const ok = await persist(null, "");
    if (!ok) return;
    onSaved(`${role} role reset to built-in defaults.`);
    toast({ title: `${role} reset`, description: "Built-in module access and description restored." });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Role — {role}</DialogTitle>
          <DialogDescription>Tick the modules this role may open. Dashboard + Settings stay on for everyone. Changes apply instantly.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2"><Label>Description</Label><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={role} /></div>
          {locked && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3"><p className="text-xs">Admin always keeps full system access — only the description can be changed.</p></div>
          )}
          <div>
            <Label>Module access ({picked.length} selected)</Label>
            <div className="grid gap-1.5 mt-2 sm:grid-cols-2">
              {editable.map((m) => (
                <label key={m.key} className={`flex items-center gap-2.5 rounded-lg border p-2.5 text-xs cursor-pointer transition-colors ${picked.includes(m.key) ? "border-primary/50 bg-primary/5" : "hover:border-muted-foreground/40"} ${locked ? "opacity-60 cursor-not-allowed" : ""}`}>
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary shrink-0"
                    checked={locked || picked.includes(m.key)}
                    disabled={locked}
                    onChange={() => toggleMod(m.key)}
                  />
                  <span className="flex-1"><span className="font-medium">{m.label}</span> <span className="text-muted-foreground">• {m.group}</span></span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset} disabled={saving}>Reset to defaults</Button>
          <div className="flex-1" />
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Admin Reset Password Dialog =====
function AdminResetPasswordDialog({ open, onOpenChange, targetUser }: { open: boolean; onOpenChange: (v: boolean) => void; targetUser: { name: string; email: string } | null }) {
  const { toast } = useToast();
  const adminResetPassword = useAppStore((s) => s.adminResetPassword);
  const currentUser = useAppStore((s) => s.currentUser);
  const [adminPassword, setAdminPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!adminPassword) {
      toast({ title: "Admin verification required", description: "You must enter your own password to authorize this reset.", variant: "destructive" });
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      toast({ title: "Invalid password", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" });
      return;
    }
    if (targetUser) {
      setSaving(true);
      const result = await adminResetPassword(currentUser.email, targetUser.email, newPassword, adminPassword);
      setSaving(false);
      if (!result.success) {
        toast({ title: "Reset Failed", description: result.error, variant: "destructive" });
        return;
      }
      toast({ title: "Password Reset", description: `Password for ${targetUser.name} has been reset in Supabase. They must change it on next login.` });
      setAdminPassword(""); setNewPassword(""); setConfirmPassword(""); onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Reset Password — {targetUser?.name}</DialogTitle><DialogDescription>Admin password reset requires your own password for verification. The user will be required to change it on next login.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="rounded-lg bg-warning/5 border border-warning/20 p-3"><p className="text-xs text-warning">This action is audited. The user will be forced to set a new password on their next login.</p></div>
        <div className="space-y-2"><Label>Your Admin Password *</Label><Input type="password" placeholder="Enter your password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label>New Password *</Label><Input type="password" placeholder="Min 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></div>
        <div className="space-y-2"><Label>Confirm New Password *</Label><Input type="password" placeholder="Re-enter password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Resetting..." : "Reset Password"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Delete All Data Dialog =====
function DeleteAllDataDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const deleteAllData = useAppStore((s) => s.deleteAllData);
  const currentUser = useAppStore((s) => s.currentUser);
  const [confirmText, setConfirmText] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [step, setStep] = useState<1 | 2>(1);

  const handleStep1 = () => {
    if (adminPassword !== currentUser.password) {
      toast({ title: "Verification Failed", description: "Admin password is incorrect.", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleConfirm = () => {
    if (confirmText !== "DELETE ALL DATA") {
      toast({ title: "Confirmation Failed", description: 'Type "DELETE ALL DATA" exactly to confirm.', variant: "destructive" });
      return;
    }
    deleteAllData();
    toast({ title: "All Data Deleted", description: "The database has been reset. You will be redirected to setup." });
    onOpenChange(false);
  };

  const handleClose = (v: boolean) => {
    if (!v) {
      setStep(1);
      setConfirmText("");
      setAdminPassword("");
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-destructive">Delete All Data</DialogTitle>
          <DialogDescription>
            This will permanently erase all patients, staff, branches, invoices, appointments, and user accounts. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {step === 1 && (
          <div className="grid gap-4 py-4">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-xs text-destructive font-medium">Warning: This will permanently delete ALL data and reset the application to its initial state.</p>
            </div>
            <div className="space-y-2">
              <Label>Your Admin Password *</Label>
              <Input type="password" placeholder="Enter your password to verify" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="grid gap-4 py-4">
            <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3">
              <p className="text-xs text-destructive font-medium">Final confirmation required. Type <code className="font-mono bg-destructive/10 px-1 py-0.5 rounded">DELETE ALL DATA</code> below to proceed.</p>
            </div>
            <div className="space-y-2">
              <Label>Type &quot;DELETE ALL DATA&quot; *</Label>
              <Input placeholder="DELETE ALL DATA" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
            </div>
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          {step === 1 && <Button variant="destructive" onClick={handleStep1}>Verify & Continue</Button>}
          {step === 2 && <Button variant="destructive" onClick={handleConfirm} disabled={confirmText !== "DELETE ALL DATA"}>Delete Everything</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Settings Module =====
const CAPACITY_FIELDS: { key: string; label: string }[] = [
  { key: "capacity_Total", label: "Total Beds" },
  { key: "capacity_ICU", label: "ICU" },
  { key: "capacity_General Ward", label: "General Ward" },
  { key: "capacity_Private Room", label: "Private Room" },
  { key: "capacity_Semi Private", label: "Semi Private" },
  { key: "capacity_Emergency", label: "Emergency" },
  { key: "capacity_Operation Theatre", label: "Operation Theatre" },
  { key: "capacity_OPD", label: "OPD Daily Target" },
];

function BedCapacityCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const activeBranch = useAppStore((s) => s.activeBranch);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of CAPACITY_FIELDS) d[f.key] = branchSetting(settings, activeBranch, f.key) ?? "";
    return d;
  });
  return (
    <Card className="md:col-span-2 border-info/30 bg-info/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Bed &amp; OPD Capacity — {activeBranch}</CardTitle>
        <CardDescription className="text-xs">
          Per-branch targets for Beds, IPD, and OPD (switch branch in the top bar to configure each). Blank falls back to the shared default. Leave 0/blank for a ward to use its actual bed count.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CAPACITY_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <Input
                type="number"
                min={0}
                className="h-9"
                placeholder="0"
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={async () => {
              for (const f of CAPACITY_FIELDS) {
                const raw = (draft[f.key] ?? "").trim();
                const n = parseInt(raw);
                await onSave(branchSettingKey(activeBranch, f.key), raw === "" || !Number.isFinite(n) || n < 0 ? "0" : String(n));
              }
              toast({ title: "Capacity saved", description: `Targets saved for ${activeBranch}.` });
            }}
          >
            Save Capacity
          </Button>
          <p className="text-xs text-muted-foreground">
            Current: {CAPACITY_FIELDS.map((f) => {
              const v = branchSetting(settings, activeBranch, f.key);
              return `${f.label} ${v && v !== "0" ? v : "—"}`;
            }).join(" • ")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const BED_RATE_FIELDS: { key: string; label: string }[] = [
  { key: "bedRate_ICU", label: "ICU" },
  { key: "bedRate_General Ward", label: "General Ward" },
  { key: "bedRate_Private Room", label: "Private Room" },
  { key: "bedRate_Semi Private", label: "Semi Private" },
  { key: "bedRate_Emergency", label: "Emergency" },
  { key: "bedRate_Operation Theatre", label: "Operation Theatre" },
];

function BedRateCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const activeBranch = useAppStore((s) => s.activeBranch);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of BED_RATE_FIELDS) d[f.key] = branchSetting(settings, activeBranch, f.key) ?? "";
    return d;
  });
  return (
    <Card className="md:col-span-2 border-warning/30 bg-warning/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Bed Charges (per day, per ward) — {activeBranch}</CardTitle>
        <CardDescription className="text-xs">
          Per-branch daily charges (switch branch in the top bar to configure each; blank falls back to the shared default). Admission and discharge amounts calculate automatically (a bed-level rate is used only when no ward rate is set).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {BED_RATE_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">₹</span>
                <Input
                  type="number"
                  min={0}
                  className="h-9 pl-7"
                  placeholder="0"
                  value={draft[f.key] ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={async () => {
              for (const f of BED_RATE_FIELDS) {
                const raw = (draft[f.key] ?? "").trim();
                const n = parseInt(raw);
                await onSave(branchSettingKey(activeBranch, f.key), raw === "" || !Number.isFinite(n) || n < 0 ? "0" : String(n));
              }
              toast({ title: "Bed charges saved", description: `Per-day rates saved for ${activeBranch}.` });
            }}
          >
            Save Charges
          </Button>
          <p className="text-xs text-muted-foreground">
            Current: {BED_RATE_FIELDS.map((f) => {
              const v = branchSetting(settings, activeBranch, f.key);
              return `${f.label} ₹${v && v !== "0" ? v : "—"}`;
            }).join(" • ")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const INVOICE_DESIGN_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "invoiceHospitalName", label: "Clinic / hospital name", placeholder: "MediCore Hospital" },
  { key: "invoiceAddress", label: "Address line", placeholder: "12 MG Road, Bengaluru 560001" },
  { key: "invoicePhone", label: "Phone", placeholder: "+91 80 1234 5678" },
  { key: "invoiceEmail", label: "Email", placeholder: "care@medicore.in" },
  { key: "invoiceSignatory", label: "Authorised signatory label", placeholder: "Authorised Signatory" },
  { key: "invoiceFooter", label: "Bill footer note", placeholder: "Thank you for choosing us!" },
  { key: "reportFooter", label: "Report footer note", placeholder: "Computer-generated report..." },
];

type SaveSettingResult = { ok: boolean; error?: string };
type SaveSetting = (key: string, value: string) => Promise<SaveSettingResult> | void;

function InvoiceDesignCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of INVOICE_DESIGN_FIELDS) d[f.key] = settings[f.key] ?? "";
    return d;
  });
  const [logo, setLogo] = useState(settings.invoiceLogo ?? "");
  const [accent, setAccent] = useState(settings.invoiceAccent || "#0f766e");

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", description: "Please choose an image file (PNG/JPG).", variant: "destructive" }); return; }
    if (file.size > 700 * 1024) { toast({ title: "Image too large", description: "Please use a logo under 700 KB, or paste an image URL instead.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  const previewContact = [draft.invoiceAddress, draft.invoicePhone, draft.invoiceEmail].filter((v) => (v ?? "").trim()).join(" • ");

  return (
    <Card className="md:col-span-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Bills & Reports Design</CardTitle>
        <CardDescription className="text-xs">
          Logo, header, colours and footers used on every bill, lab/radiology report, medical record and OP file download (print / Save as PDF).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {INVOICE_DESIGN_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <Input
                className="h-9"
                placeholder={f.placeholder}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Brand colour</label>
            <div className="flex items-center gap-2">
              <Input type="color" className="h-9 w-14 p-1 cursor-pointer" value={accent} onChange={(e) => setAccent(e.target.value)} />
              <Input className="h-9" value={accent} onChange={(e) => setAccent(e.target.value)} placeholder="#0f766e" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Logo image URL (optional)</label>
            <Input className="h-9" placeholder="https://.../logo.png" value={logo.startsWith("data:") ? "" : logo} onChange={(e) => setLogo(e.target.value.trim())} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
          {logo ? (
            <img src={logo} alt="Clinic logo preview" className="h-14 w-14 rounded-lg border object-contain bg-white" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted text-[10px] text-muted-foreground">No logo</div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Upload Logo</Button>
            {logo && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLogo("")}>Remove</Button>}
          </div>
          <p className="text-xs text-muted-foreground w-full">PNG/JPG under 700 KB, or paste a hosted image URL above.</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Live preview — document header</p>
          <div className="flex items-center gap-3 border-b-[3px] pb-3" style={{ borderColor: accent }}>
            {logo && <img src={logo} alt="" className="h-12 w-12 rounded-lg border object-contain" />}
            <div>
              <p className="text-lg font-extrabold" style={{ color: accent }}>{draft.invoiceHospitalName || "MediCore Hospital"}</p>
              <p className="text-[11px] text-muted-foreground">{previewContact || "Address • Phone • Email"}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={async () => {
              const entries: [string, string][] = [
                ...INVOICE_DESIGN_FIELDS.map((f) => [f.key, (draft[f.key] ?? "").trim()] as [string, string]),
                ["invoiceLogo", logo.trim()],
                ["invoiceAccent", accent.trim() || "#0f766e"],
              ];
              const results = await Promise.all(entries.map(([k, v]) => onSave(k, v)));
              const failed = results.find((r) => r && !r.ok);
              if (failed) {
                toast({ title: "Could not save design", description: failed.error || "Run pending Supabase migrations and try again.", variant: "destructive" });
                return;
              }
              toast({ title: "Design saved", description: "Bills, reports and OP files will use this branding." });
            }}
          >
            Save Design
          </Button>
          <p className="text-xs text-muted-foreground">
            Current header: <span className="font-semibold text-foreground">{settings.invoiceHospitalName || "MediCore Hospital"}</span>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

const SERVICE_MODULE_OPTIONS: ServiceModule[] = ["Laboratory", "Radiology", "Pharmacy", "Other"];

const PORTAL_PASSWORD_ACTIONS = ["PATIENT_PASSWORD_CHANGE", "ADMIN_PORTAL_PASSWORD_RESET", "ADMIN_PORTAL_ACCESS_ISSUED"];

function NotificationLiveCard() {
  const { toast } = useToast();
  const settings = useAppStore((s) => s.settings);
  const setAppSetting = useAppStore((s) => s.setAppSetting);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const currentUser = useAppStore((s) => s.currentUser);
  const [sending, setSending] = useState(false);
  const liveOn = settings.notif_liveAlerts === undefined ? true : settings.notif_liveAlerts === "true";
  const interval = settings.notif_pollInterval ?? "45";

  const sendTest = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: `nt-test-${Date.now()}`,
          userId: currentUser.email || "admin",
          type: "appointment",
          title: "Test notification",
          message: `Sent by ${currentUser.name || "admin"} at ${new Date().toLocaleTimeString("en-IN")} to verify the bell, push alerts and Supabase storage.`,
          time: new Date().toISOString(),
          read: false,
          priority: "medium",
          branch: activeBranch,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send.");
      }
      const saved = await res.json();
      useAppStore.getState().addNotification(saved);
      toast({ title: "Test Sent & Stored", description: "Check the header bell — it should appear instantly and in Supabase notifications." });
    } catch (e: any) {
      toast({ title: "Could not send test", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5 mb-3">
      <CardContent className="p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2.5 min-w-52">
          <Bell className="h-5 w-5 text-primary shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Live Alerts</p>
            <p className="text-[11px] text-muted-foreground">Auto-refresh bell + push for new events</p>
          </div>
          <Switch checked={liveOn} onCheckedChange={(v) => setAppSetting("notif_liveAlerts", String(v))} />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Check every</Label>
          <Select value={interval} onValueChange={(v) => setAppSetting("notif_pollInterval", v)}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15 seconds</SelectItem>
              <SelectItem value="45">45 seconds</SelectItem>
              <SelectItem value="120">2 minutes</SelectItem>
              <SelectItem value="300">5 minutes</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 ml-auto" onClick={sendTest} disabled={sending}>
          <Bell className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send Test Notification"}
        </Button>
      </CardContent>
    </Card>
  );
}

function SettingsSection({ icon: Icon, title, desc }: { icon: typeof Building2; title: string; desc: string }) {
  return (
    <div className="md:col-span-2 flex items-center gap-2.5 pt-2 min-w-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0"><Icon className="h-4 w-4" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold truncate">{title}</p>
        <p className="text-xs text-muted-foreground line-clamp-2">{desc}</p>
      </div>
      <div className="hidden sm:block flex-1 h-px bg-border ml-2 min-w-4" />
    </div>
  );
}

const APP_BRANDING_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: "appName", label: "Application name", placeholder: "MediCore CRM" },
  { key: "appTagline", label: "Application tagline", placeholder: "Enterprise Hospital Management" },
];

function AppBrandingCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const f of APP_BRANDING_FIELDS) d[f.key] = settings[f.key] ?? "";
    return d;
  });
  const [logo, setLogo] = useState(settings.appLogo ?? "");

  const handleLogoFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", description: "Choose a PNG/JPG image.", variant: "destructive" }); return; }
    if (file.size > 700 * 1024) { toast({ title: "Image too large", description: "Use a logo under 700 KB, or paste an image URL.", variant: "destructive" }); return; }
    const reader = new FileReader();
    reader.onload = () => setLogo(String(reader.result || ""));
    reader.readAsDataURL(file);
  };

  return (
    <Card className="md:col-span-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Palette className="h-4 w-4 text-primary" /> Application Logo & Title</CardTitle>
        <CardDescription className="text-xs">Shown in the sidebar, staff login screen, and patient portal login. Saved to Supabase instantly.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {APP_BRANDING_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">{f.label}</label>
              <Input className="h-9" placeholder={f.placeholder} value={draft[f.key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-background p-3">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoFile(e.target.files?.[0])} />
          {logo ? (
            <img src={logo} alt="App logo preview" className="h-14 w-14 rounded-xl border object-contain bg-white" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl border bg-muted text-[10px] text-muted-foreground">No logo</div>
          )}
          <div className="flex-1 min-w-40 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Logo image URL (optional)</label>
            <Input className="h-9" placeholder="https://.../logo.png" value={logo.startsWith("data:") ? "" : logo} onChange={(e) => setLogo(e.target.value.trim())} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>Upload</Button>
            {logo && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setLogo("")}>Remove</Button>}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={async () => {
              for (const f of APP_BRANDING_FIELDS) await onSave(f.key, (draft[f.key] ?? "").trim());
              const r = await onSave("appLogo", logo.trim());
              if (r && !r.ok) {
                toast({ title: "Could not save branding", description: r.error, variant: "destructive" });
                return;
              }
              toast({ title: "Branding saved", description: "Sidebar, login and portal screens update immediately." });
            }}
          >
            Save Branding
          </Button>
          <p className="text-xs text-muted-foreground">Preview: <span className="font-semibold text-foreground">{draft.appName || "MediCore CRM"}</span></p>
        </div>
      </CardContent>
    </Card>
  );
}

const LOGIN_DESIGN_THEMES = ["teal", "indigo", "slate", "rose"];

function OnlinePaymentsCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const activeBranch = useAppStore((s) => s.activeBranch);
  const storeBranches = useAppStore((s) => s.branches);
  const [selectedBranch, setSelectedBranch] = useState(activeBranch);
  const branchKeyId = branchSettingKey(selectedBranch, "razorpayKeyId");
  const branchKeySecret = branchSettingKey(selectedBranch, "razorpayKeySecret");
  const branchMode = branchSettingKey(selectedBranch, "razorpayMode");
  const [draft, setDraft] = useState({
    mode: settings.razorpayMode ?? "disabled",
    keyId: settings.razorpayKeyId ?? "",
    keySecret: "",
    useBranchOverride: false,
    branchMode: "",
    branchKeyId: "",
    branchKeySecret: "",
  });
  const [saving, setSaving] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [testing, setTesting] = useState(false);
  const save = (k: string, v: string) => Promise.resolve(onSave(k, v));
  // Razorpay keys never contain whitespace — pasted newlines/spaces are the
  // most common silent cause of "Authentication failed".
  const cleanKey = (v: string) => (v || "").replace(/\s+/g, "");

  const keyMatchesMode = (keyId: string, mode: string) => {
    if (!keyId.trim() || mode === "disabled") return true;
    if (mode === "test") return keyId.trim().startsWith("rzp_test_");
    if (mode === "live") return keyId.trim().startsWith("rzp_live_");
    return true;
  };

  const handleTest = async (branch?: string) => {
    setTesting(true);
    try {
      const res = await fetch("/api/payments/razorpay/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branch: branch || "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "Connection test failed.");
      toast({ title: "Razorpay Connected", description: `Credentials accepted in ${body.mode} mode (${body.keyPrefix}). Online checkout will work.` });
    } catch (e: any) {
      toast({ title: "Connection Failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  // Reload the per-branch fields whenever the selected branch (or saved
  // settings) change, so each branch is edited separately.
  useEffect(() => {
    setDraft((d) => ({
      ...d,
      useBranchOverride: (settings[branchSettingKey(selectedBranch, "razorpayKeyId")] ?? "") !== "",
      branchMode: settings[branchSettingKey(selectedBranch, "razorpayMode")] ?? "",
      branchKeyId: settings[branchSettingKey(selectedBranch, "razorpayKeyId")] ?? "",
      branchKeySecret: "",
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, settings]);

  const handleSave = async () => {
    if (!["disabled", "test", "live"].includes(draft.mode)) {
      toast({ title: "Invalid mode", description: "Choose Disabled, Test, or Live.", variant: "destructive" });
      return;
    }
    if (draft.mode !== "disabled" && !draft.useBranchOverride && !cleanKey(draft.keyId)) {
      toast({ title: "Key ID required", description: "Enter the Razorpay Key ID to enable online payments.", variant: "destructive" });
      return;
    }
    if (draft.mode !== "disabled" && !keyMatchesMode(cleanKey(draft.keyId), draft.mode)) {
      toast({ title: "Key/Mode Mismatch", description: "Test mode needs a key starting with rzp_test_, live mode needs rzp_live_. Fix the Key ID or switch mode.", variant: "destructive" });
      return;
    }
    if (draft.useBranchOverride && cleanKey(draft.branchKeyId) && !keyMatchesMode(cleanKey(draft.branchKeyId), draft.branchMode || draft.mode)) {
      toast({ title: "Branch Key/Mode Mismatch", description: `The ${selectedBranch} Key ID does not match its mode. Test keys start with rzp_test_, live keys with rzp_live_.`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const ops: Promise<any>[] = [
        save("razorpayMode", draft.mode),
        save("razorpayKeyId", cleanKey(draft.keyId)),
      ];
      if (cleanKey(draft.keySecret)) ops.push(save("razorpayKeySecret", cleanKey(draft.keySecret)));
      if (draft.useBranchOverride) {
        ops.push(save(branchMode, draft.branchMode || draft.mode));
        ops.push(save(branchKeyId, cleanKey(draft.branchKeyId)));
        if (cleanKey(draft.branchKeySecret)) ops.push(save(branchKeySecret, cleanKey(draft.branchKeySecret)));
      } else {
        ops.push(save(branchMode, ""));
        ops.push(save(branchKeyId, ""));
        ops.push(save(branchKeySecret, ""));
      }
      const results = await Promise.all(ops);
      const failed = results.find((r) => r && !r.ok);
      if (failed) throw new Error(failed.error || "Failed to save.");
      toast({ title: "Online Payments Saved", description: draft.mode === "disabled" ? "UPI checkout is turned off." : `UPI checkout enabled in ${draft.mode} mode${draft.useBranchOverride ? ` with dedicated keys for ${activeBranch}` : " for all branches"}.` });
      setDraft((d) => ({ ...d, keySecret: "", branchKeySecret: "" }));
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="md:col-span-2 border-success/30 bg-success/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2"><CreditCard className="h-4 w-4 text-success" /> Online Payments (Razorpay UPI)</CardTitle>
        <CardDescription className="text-xs">
          Collect bills online via UPI/cards. Secrets are stored server-side only and never shown back. Get keys from Razorpay Dashboard → Settings → API Keys.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Mode (all branches)</label>
            <Select value={draft.mode} onValueChange={(v) => setDraft((d) => ({ ...d, mode: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disabled">Disabled</SelectItem>
                <SelectItem value="test">Test mode</SelectItem>
                <SelectItem value="live">Live mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Key ID (all branches)</label>
            <Input className="h-9 font-mono text-xs" placeholder="rzp_test_…" value={draft.keyId} onChange={(e) => setDraft((d) => ({ ...d, keyId: e.target.value.replace(/\s+/g, "") }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Key Secret {showSecrets ? "" : "(hidden)"}</label>
            <div className="flex gap-1.5">
              <Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} placeholder={draft.keySecret ? "••••" : "Enter to set/update"} value={draft.keySecret} onChange={(e) => setDraft((d) => ({ ...d, keySecret: e.target.value.trim() }))} />
              <Button size="sm" variant="outline" className="h-9 shrink-0" onClick={() => setShowSecrets((s) => !s)}>{showSecrets ? "Hide" : "Show"}</Button>
            </div>
          </div>
        </div>
        <div className="rounded-lg border bg-background p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1.5">
              {storeBranches.map((b) => {
                const hasOwn = (settings[branchSettingKey(b.name, "razorpayKeyId")] ?? "") !== "";
                const selected = selectedBranch === b.name;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBranch(b.name)}
                    title={hasOwn ? `${b.name}: dedicated keys` : `${b.name}: uses global keys`}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                  >
                    {b.name} {hasOwn ? "•" : ""}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input id="rzp-branch-override" type="checkbox" className="h-4 w-4 accent-primary" checked={draft.useBranchOverride} onChange={(e) => setDraft((d) => ({ ...d, useBranchOverride: e.target.checked }))} />
            <label htmlFor="rzp-branch-override" className="text-xs font-medium">Use dedicated keys for <span className="font-bold">{selectedBranch}</span> (individual branch — otherwise it uses the global keys above)</label>
          </div>
          {draft.useBranchOverride && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Branch mode</label>
                <Select value={draft.branchMode || draft.mode} onValueChange={(v) => setDraft((d) => ({ ...d, branchMode: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Disabled</SelectItem>
                    <SelectItem value="test">Test mode</SelectItem>
                    <SelectItem value="live">Live mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Branch Key ID</label>
                <Input className="h-9 font-mono text-xs" placeholder="rzp_… (this branch)" value={draft.branchKeyId} onChange={(e) => setDraft((d) => ({ ...d, branchKeyId: e.target.value.replace(/\s+/g, "") }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Branch Key Secret</label>
                <Input className="h-9 font-mono text-xs" type={showSecrets ? "text" : "password"} placeholder="Enter to set/update" value={draft.branchKeySecret} onChange={(e) => setDraft((d) => ({ ...d, branchKeySecret: e.target.value.trim() }))} />
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Payment Settings"}</Button>
          <Button size="sm" variant="outline" onClick={() => handleTest()} disabled={testing}>{testing ? "Testing…" : "Test Global Keys"}</Button>
          <Button size="sm" variant="outline" onClick={() => handleTest(selectedBranch)} disabled={testing}>{testing ? "Testing…" : `Test ${selectedBranch} Keys`}</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoginDesignCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    loginTitle: settings.loginTitle ?? "",
    loginSubtitle: settings.loginSubtitle ?? "",
    loginTheme: settings.loginTheme ?? "teal",
    loginFooter: settings.loginFooter ?? "",
  });
  const theme = LOGIN_THEMES[draft.loginTheme] ?? LOGIN_THEMES.teal;
  return (
    <Card className="md:col-span-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2"><MonitorSmartphone className="h-4 w-4 text-primary" /> Login Screen Design</CardTitle>
        <CardDescription className="text-xs">Style the staff login hero panel yourself — headline, description, color theme, footer. Applies on next login screen load.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Hero headline (use \n for a line break)</label>
            <Input className="h-9" placeholder="Healthcare, reimagined." value={draft.loginTitle} onChange={(e) => setDraft((d) => ({ ...d, loginTitle: e.target.value }))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Hero description</label>
            <Textarea rows={2} placeholder="What staff see under the headline…" value={draft.loginSubtitle} onChange={(e) => setDraft((d) => ({ ...d, loginSubtitle: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Color theme</label>
            <Select value={draft.loginTheme} onValueChange={(v) => setDraft((d) => ({ ...d, loginTheme: v }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{LOGIN_DESIGN_THEMES.map((t) => <SelectItem key={t} value={t}>{LOGIN_THEMES[t].label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Footer line</label>
            <Input className="h-9" placeholder="© 2026 ..." value={draft.loginFooter} onChange={(e) => setDraft((d) => ({ ...d, loginFooter: e.target.value }))} />
          </div>
        </div>
        <div className={`rounded-xl bg-gradient-to-br ${theme.hero} p-4 text-white`}>
          <p className="text-[10px] uppercase tracking-widest opacity-80">Live preview</p>
          <p className="text-lg font-bold leading-snug whitespace-pre-line">{draft.loginTitle || "Healthcare, reimagined."}</p>
          <p className="text-xs opacity-85 mt-1 line-clamp-2">{draft.loginSubtitle || "Hero description…"}</p>
        </div>
        <Button
          size="sm"
          onClick={async () => {
            const results = await Promise.all([
              onSave("loginTitle", draft.loginTitle.trim()),
              onSave("loginSubtitle", draft.loginSubtitle.trim()),
              onSave("loginTheme", draft.loginTheme),
              onSave("loginFooter", draft.loginFooter.trim()),
            ]);
            const failed = results.find((r) => r && !r.ok);
            if (failed) {
              toast({ title: "Could not save design", description: failed.error, variant: "destructive" });
              return;
            }
            toast({ title: "Login design saved", description: "The staff login screen uses it immediately." });
          }}
        >
          Save Login Design
        </Button>
      </CardContent>
    </Card>
  );
}

function DatabaseStatusCard() {
  const [status, setStatus] = useState<{ migrations: { file: string; label: string; ok: boolean; missing: string[] }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/db-status");
        if (res.ok) setStatus(await res.json());
      } catch {
        // Backend unreachable; card stays empty.
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const pending = (status?.migrations ?? []).filter((m) => !m.ok);
  return (
    <Card className="md:col-span-2 border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Database className="h-4 w-4 text-primary" /> Database Migrations</CardTitle>
        <CardDescription className="text-xs">
          Live check of your Supabase tables. Every missing item below breaks the matching feature — run the listed files in Supabase → SQL Editor (all are safe to re-run).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Checking database…</p>
        ) : !status ? (
          <p className="text-xs text-destructive">Could not reach the database. Check your Supabase connection.</p>
        ) : pending.length === 0 ? (
          <p className="text-xs font-medium text-success">All migrations applied — database is up to date.</p>
        ) : (
          <div className="space-y-2">
            {status.migrations.map((m) => (
              <div key={m.file} className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${m.ok ? "bg-background" : "border-destructive/40 bg-destructive/5"}`}>
                <span className={`mt-0.5 h-2.5 w-2.5 rounded-full shrink-0 ${m.ok ? "bg-success" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-semibold">{m.file}</p>
                  <p className="text-muted-foreground">{m.label}</p>
                  {!m.ok && <p className="text-destructive mt-0.5">Missing: {m.missing.join(", ")}</p>}
                </div>
                {!m.ok && <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive shrink-0">RUN NEEDED</Badge>}
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">Files live in <span className="font-mono">supabase/migrations/</span> — paste each pending file&apos;s full contents into the SQL Editor and press Run, in numeric order.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordAuditCard() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/audit");
        if (res.ok) {
          const all = await res.json();
          setRows((Array.isArray(all) ? all : []).filter((r: any) => PORTAL_PASSWORD_ACTIONS.includes(r.action)));
        }
      } catch {
        // Audit table may predate migration 006 display; keep empty.
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return (
    <Card className="md:col-span-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Patient Password Audit</CardTitle>
        <CardDescription className="text-xs">Exact date and time of every patient portal password issue, reset, and patient-side change.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading audit trail…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No patient password events yet. Issue portal access from the Patients module to begin.</p>
        ) : (
          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date & Time</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Patient (phone)</TableHead>
                  <TableHead className="hidden md:table-cell">Done By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 30).map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs font-mono">{r.timestamp ? new Date(r.timestamp).toLocaleString("en-IN") : "—"}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline" className="text-[10px]">{r.action.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{r.target}</TableCell>
                    <TableCell className="hidden md:table-cell text-xs">{r.actor}{r.actorEmail && r.actorEmail !== r.actor ? ` (${r.actorEmail})` : ""}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ServicePricingCard({ settings, onSave }: { settings: Record<string, string>; onSave: SaveSetting }) {
  const { toast } = useToast();
  const initialItems = parseServicePrices(settings);
  const [items, setItems] = useState<ServicePriceItem[]>(initialItems);
  const [form, setForm] = useState({ module: "Laboratory" as ServiceModule, name: "", category: "", price: "" });
  const branchData = useBranchData();

  // Dropdown options per module: catalog entries plus values already used in
  // that module's data, so admins can pick existing names or add custom ones.
  const moduleItems = items.filter((item) => item.module === form.module);
  const nameOptions = uniqueOptions(
    form.module === "Laboratory"
      ? [...moduleItems.map((i) => i.name), ...branchData.labTests.map((t) => t.test)]
      : form.module === "Radiology"
      ? [...moduleItems.map((i) => i.name), ...branchData.radiologyOrders.map((o) => o.region)]
      : form.module === "Pharmacy"
      ? [...moduleItems.map((i) => i.name), ...branchData.medicines.map((m) => m.name)]
      : moduleItems.map((i) => i.name)
  );
  const categoryOptions = uniqueOptions(
    form.module === "Laboratory"
      ? [...moduleItems.map((i) => i.category), ...branchData.labTests.map((t) => t.category)]
      : form.module === "Radiology"
      ? [...moduleItems.map((i) => i.category), ...branchData.radiologyOrders.map((o) => o.modality)]
      : moduleItems.map((i) => i.category)
  );

  const saveItems = async (next: ServicePriceItem[]) => {
    setItems(next);
    const result = await onSave("clinicalServicePrices", stringifyServicePrices(next));
    return result ?? { ok: true as const };
  };

  const handleAdd = async () => {
    const name = form.name.trim();
    const category = form.category.trim();
    const price = parseFloat(form.price);
    if (!name || !category || !Number.isFinite(price) || price < 0) {
      toast({ title: "Invalid service", description: "Enter service/test name, category, and a valid price.", variant: "destructive" });
      return;
    }
    const next = [
      ...items.filter((item) => !(item.module === form.module && item.name.toLowerCase() === name.toLowerCase() && item.category.toLowerCase() === category.toLowerCase())),
      { id: `svc${Date.now()}`, module: form.module, name, category, price },
    ];
    const result = await saveItems(next);
    if (!result.ok) {
      toast({ title: "Could not save price", description: result.error || "The price was not saved. Run pending Supabase migrations and try again.", variant: "destructive" });
      return;
    }
    setForm({ module: form.module, name: "", category: "", price: "" });
    toast({ title: "Service price saved", description: `${name} will now auto-fill at ₹${price.toLocaleString("en-IN")} in ${form.module}.` });
  };

  return (
    <Card className="md:col-span-2 border-success/30 bg-success/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Clinical Service Prices</CardTitle>
        <CardDescription className="text-xs">
          Admin-added tests, categories, and prices appear automatically in module dropdowns. Selecting a priced service adds a pending invoice to the patient's billing profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Module</label>
            <Select value={form.module} onValueChange={(module) => setForm((f) => ({ ...f, module: module as ServiceModule, name: "", category: "", price: "" }))}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{SERVICE_MODULE_OPTIONS.map((module) => <SelectItem key={module} value={module}>{module}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Service / Test</label>
            <SearchableField
              value={form.name}
              onChange={(name) => {
                const svc = items.find((item) => item.module === form.module && item.name.toLowerCase() === name.toLowerCase());
                setForm((f) => ({ ...f, name, category: svc?.category ?? f.category, price: svc && !f.price ? String(svc.price) : f.price }));
              }}
              options={nameOptions}
              placeholder="Search/add service"
              searchPlaceholder="Search service or type custom name..."
              emptyLabel="Add service"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Category</label>
            <SearchableField
              value={form.category}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
              options={categoryOptions}
              placeholder="Search/add category"
              searchPlaceholder="Search category or type custom name..."
              emptyLabel="Add category"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Price (₹)</label>
            <Input className="h-9" type="number" min={0} placeholder="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
        </div>
        <Button size="sm" onClick={handleAdd}>Add / Update Service</Button>
        <div className="rounded-lg border bg-background/70 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="w-[60px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No custom service prices yet.</TableCell></TableRow>
              ) : items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><Badge variant="outline" className="text-[10px]">{item.module}</Badge></TableCell>
                  <TableCell className="text-sm font-medium">{item.name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                  <TableCell className="text-right text-sm font-medium">₹{item.price.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={async () => { const r = await saveItems(items.filter((i) => i.id !== item.id)); if (!r.ok) toast({ title: "Could not delete price", description: r.error, variant: "destructive" }); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// Stable settings-key slug from a label: non-alphanumerics collapse to "_".
const slugify = (s: string) => s.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");

// ===== Hospital Details Card (General settings) =====
function HospitalDetailsCard({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    hospitalName: settings.hospitalName ?? "MediCore Hospital",
    hospitalAddress: settings.hospitalAddress ?? "MH-BLR-2024-001234",
    hospitalPhone: settings.hospitalPhone ?? "+91 80 1234 5678",
    hospitalEmail: settings.hospitalEmail ?? "info@medicore.com",
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Hospital Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Hospital Name</label><Input value={draft.hospitalName} onChange={(e) => setDraft((d) => ({ ...d, hospitalName: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Registration Number</label><Input value={draft.hospitalAddress} onChange={(e) => setDraft((d) => ({ ...d, hospitalAddress: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Contact Number</label><Input value={draft.hospitalPhone} onChange={(e) => setDraft((d) => ({ ...d, hospitalPhone: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Email</label><Input value={draft.hospitalEmail} onChange={(e) => setDraft((d) => ({ ...d, hospitalEmail: e.target.value }))} className="mt-1 h-9" /></div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            onSave("hospitalName", draft.hospitalName.trim());
            onSave("hospitalAddress", draft.hospitalAddress.trim());
            onSave("hospitalPhone", draft.hospitalPhone.trim());
            onSave("hospitalEmail", draft.hospitalEmail.trim());
            toast({ title: "Hospital details saved" });
          }}
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== Tax & Currency Card (General settings) =====
function TaxCurrencyCard({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    currency: settings.currency ?? "INR (₹)",
    taxRate: settings.taxRate ?? "5",
    billing_discountPercent: settings.billing_discountPercent ?? "0",
    billing_gstPercent: settings.billing_gstPercent ?? settings.taxRate ?? "5",
    billing_cstPercent: settings.billing_cstPercent ?? "0",
    timezone: settings.timezone ?? "Asia/Kolkata (IST)",
    dateFormat: settings.dateFormat ?? "YYYY-MM-DD",
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Tax & Currency</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Currency</label><Input value={draft.currency} onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Default Tax Rate (%)</label><Input value={draft.taxRate} onChange={(e) => setDraft((d) => ({ ...d, taxRate: e.target.value }))} className="mt-1 h-9" /></div>
        <div className="grid grid-cols-3 gap-2">
          <div><label className="text-xs font-medium text-muted-foreground">Default Discount %</label><Input value={draft.billing_discountPercent} onChange={(e) => setDraft((d) => ({ ...d, billing_discountPercent: e.target.value }))} className="mt-1 h-9" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Default GST %</label><Input value={draft.billing_gstPercent} onChange={(e) => setDraft((d) => ({ ...d, billing_gstPercent: e.target.value }))} className="mt-1 h-9" /></div>
          <div><label className="text-xs font-medium text-muted-foreground">Default CST %</label><Input value={draft.billing_cstPercent} onChange={(e) => setDraft((d) => ({ ...d, billing_cstPercent: e.target.value }))} className="mt-1 h-9" /></div>
        </div>
        <p className="text-[11px] text-muted-foreground">These percentages auto-fill on every new bill across all modules.</p>
        <div><label className="text-xs font-medium text-muted-foreground">Timezone</label><Input value={draft.timezone} onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Date Format</label><Input value={draft.dateFormat} onChange={(e) => setDraft((d) => ({ ...d, dateFormat: e.target.value }))} className="mt-1 h-9" /></div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            onSave("currency", draft.currency.trim());
            onSave("taxRate", draft.taxRate.trim());
            onSave("billing_discountPercent", draft.billing_discountPercent.trim());
            onSave("billing_gstPercent", draft.billing_gstPercent.trim());
            onSave("billing_cstPercent", draft.billing_cstPercent.trim());
            onSave("timezone", draft.timezone.trim());
            onSave("dateFormat", draft.dateFormat.trim());
            toast({ title: "Tax & currency saved" });
          }}
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== Sector Tax Presets (General settings) =====
// Named taxes with percentages per sector (GST 18% for Pharmacy, CGST/SGST
// for OPD, …). Stored as JSON in app_settings.billing_taxPresets and offered
// as one-tap presets inside every bill editor.
const TAX_SECTORS = ["All", "OPD", "IPD", "Lab", "Radiology", "Pharmacy", "Room", "Procedure", "Consultation", "Other"];
function TaxPresetsCard({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState<TaxPreset[]>(() => {
    const p = parseTaxPresets(settings);
    return p.length > 0 ? p : [{ name: "GST", percent: 5, sector: "All" }];
  });
  const setRow = (i: number, patch: Partial<TaxPreset>) =>
    setDraft((d) => d.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Tax Presets by Sector</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {draft.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_72px_110px_32px] gap-1.5 items-center">
            <Input value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className="h-9" placeholder="GST / CGST / SGST…" />
            <Input type="number" min={0} value={String(r.percent)} onChange={(e) => setRow(i, { percent: Math.max(0, parseFloat(e.target.value) || 0) })} className="h-9" title="Percent %" />
            <Select value={r.sector ?? "All"} onValueChange={(v) => setRow(i, { sector: v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-9 w-8 text-destructive" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} title="Remove preset"><Trash2 className="h-4 w-4" /></Button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={() => setDraft((d) => [...d, { name: "", percent: 0, sector: "All" }])}><Plus className="h-3.5 w-3.5 mr-1" /> Add Tax</Button>
          <Button
            size="sm"
            onClick={() => {
              const clean = draft.filter((r) => r.name.trim());
              onSave("billing_taxPresets", JSON.stringify(clean));
              toast({ title: "Tax presets saved", description: `${clean.length} preset(s) available in every bill editor.` });
            }}
          >
            Save Presets
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===== Attendance WiFi Card (General settings) =====
// Branch-scoped clinic IP used ONLY by the attendance WiFi gate
// (same app_settings keys the /api/network-check + attendance APIs read).
// No password gate, no SSID/subnet fields — just the check + the IP.
function isValidIPv4(v: string): boolean {
  const m = v.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return !!m && m.slice(1).every((o) => +o >= 0 && +o <= 255);
}
function AttendanceWifiCard({ settings, branch, onSave }: { settings: Record<string, string>; branch: string; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState((branchSetting(settings, branch, "network_mode") || "DHCP") === "Static");
  const [ipAddress, setIpAddress] = useState(branchSetting(settings, branch, "network_ipAddress") ?? "");
  const save = () => {
    if (enabled && !isValidIPv4(ipAddress)) {
      toast({ title: "Invalid IP address", description: "Use IPv4 format, e.g. 192.168.1.50.", variant: "destructive" });
      return;
    }
    onSave(branchSettingKey(branch, "network_mode"), enabled ? "Static" : "DHCP");
    onSave(branchSettingKey(branch, "network_ipAddress"), ipAddress.trim());
    toast({
      title: enabled ? "Attendance WiFi check on" : "Attendance WiFi check off",
      description: enabled
        ? `Staff punches for ${branch || "this site"} now require the clinic network (${ipAddress.trim()}).`
        : "Attendance can be marked from anywhere.",
    });
  };
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Wifi className="h-4 w-4 text-primary" /> Attendance WiFi
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Require clinic WiFi for punches at {branch || "this site"}</p>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        {enabled && (
          <div><label className="text-xs font-medium text-muted-foreground">Clinic IP Address</label><Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} className="mt-1 h-9" placeholder="192.168.1.50" /></div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {enabled
            ? "Self + kiosk punches are allowed only from this IP (or the same WiFi network). Manager corrections stay exempt."
            : "Turn on and save the clinic IP to lock attendance to the site WiFi."}
        </p>
        <Button size="sm" onClick={save}>Save</Button>
      </CardContent>
    </Card>
  );
}

// ===== My Preferences Card (General settings, non-admin) =====
function PreferencesCard({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState({
    pref_language: settings.pref_language ?? "English",
    pref_timezone: settings.pref_timezone ?? "Asia/Kolkata (IST)",
    pref_dateFormat: settings.pref_dateFormat ?? "DD/MM/YYYY",
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">My Preferences</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Language</label><Input value={draft.pref_language} onChange={(e) => setDraft((d) => ({ ...d, pref_language: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Timezone</label><Input value={draft.pref_timezone} onChange={(e) => setDraft((d) => ({ ...d, pref_timezone: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Date Format</label><Input value={draft.pref_dateFormat} onChange={(e) => setDraft((d) => ({ ...d, pref_dateFormat: e.target.value }))} className="mt-1 h-9" /></div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            onSave("pref_language", draft.pref_language.trim());
            onSave("pref_timezone", draft.pref_timezone.trim());
            onSave("pref_dateFormat", draft.pref_dateFormat.trim());
            toast({ title: "Preferences saved" });
          }}
        >
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== My Profile — Personal Information Card =====
function ProfileInfoCard({ settings, onSave }: { settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const [draft, setDraft] = useState({
    profile_name: settings.profile_name ?? currentUser.name,
    profile_email: settings.profile_email ?? currentUser.email,
  });
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Personal Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Full Name</label><Input value={draft.profile_name} onChange={(e) => setDraft((d) => ({ ...d, profile_name: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Email</label><Input value={draft.profile_email} onChange={(e) => setDraft((d) => ({ ...d, profile_email: e.target.value }))} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Role</label><Input defaultValue={currentUser.role} className="mt-1 h-9" disabled /></div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            onSave("profile_name", draft.profile_name.trim());
            onSave("profile_email", draft.profile_email.trim());
            toast({ title: "Profile updated" });
          }}
        >
          Update Profile
        </Button>
      </CardContent>
    </Card>
  );
}

// ===== My Profile — Change Password Card =====
function ChangePasswordCard() {
  const { toast } = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm sm:text-base">Change Password</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div><label className="text-xs font-medium text-muted-foreground">Current Password</label><Input type="password" placeholder="••••••••" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">New Password</label><Input type="password" placeholder="••••••••" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 h-9" /></div>
        <div><label className="text-xs font-medium text-muted-foreground">Confirm New Password</label><Input type="password" placeholder="••••••••" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 h-9" /></div>
        <Button
          size="sm"
          className="mt-2"
          onClick={() => {
            if (!next || !confirm) { toast({ title: "Missing fields", description: "Enter and confirm your new password.", variant: "destructive" }); return; }
            if (next !== confirm) { toast({ title: "Passwords don't match", description: "New password and confirmation must match.", variant: "destructive" }); return; }
            setCurrent(""); setNext(""); setConfirm("");
            toast({ title: "Password updated" });
          }}
        >
          Change Password
        </Button>
      </CardContent>
    </Card>
  );
}

export function SettingsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const roleDefinitions = useAppStore((s) => s.roleDefinitions);
  const updateRoleDefinition = useAppStore((s) => s.updateRoleDefinition);
  const deleteRoleDefinition = useAppStore((s) => s.deleteRoleDefinition);
  const storeBranches = useAppStore((s) => s.branches);
  const deleteBranch = useAppStore((s) => s.deleteBranch);
  const allBranchPatients = useAppStore((s) => s.patients);
  const allBranchInvoices = useAppStore((s) => s.invoices);
  const allBranchStaff = useAppStore((s) => s.staffMembers);
  const allUsers = useAppStore((s) => s.users);
  const branchYear = new Date().getFullYear().toString();
  const branchLiveStats = (name: string) => {
    const bp = allBranchPatients.filter((p) => sameBranch(p.branch, name)).length;
    const rev = allBranchInvoices
      .filter((i) => sameBranch(i.branch, name) && (i.date || "").startsWith(branchYear))
      .reduce((s, i) => s + (i.paidAmount || 0), 0);
    const st = allBranchStaff.filter((s) => sameBranch(s.branch, name)).length;
    return { patients: bp, revenue: rev, staff: st };
  };
  const settings = useAppStore((s) => s.settings);
  const setAppSetting = useAppStore((s) => s.setAppSetting);
  const settingsBranch = useAppStore((s) => s.activeBranch);
  // Branch-scoped custom roles for the active view (admin included).
  const visibleCustomRoles = roleDefinitions.filter((r) => {
    const scope = isAdmin(currentUser.role) ? settingsBranch : currentUser.branch;
    return sameBranch(r.branch, scope);
  });
  const { toast } = useToast();
  const [opExpiryInput, setOpExpiryInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState("general");
  const [addBranchOpen, setAddBranchOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDefinitionShape | null>(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleteRoleTarget, setDeleteRoleTarget] = useState<{ id: string; name: string } | null>(null);
  const [editSystemRole, setEditSystemRole] = useState<string | null>(null);
  const [deleteSystemRole, setDeleteSystemRole] = useState<string | null>(null);
  const [deleteAllDataOpen, setDeleteAllDataOpen] = useState(false);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const auditRole = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "roles", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "roles", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };
  const role = currentUser.role;
  const isAdminRole = isAdmin(role);

  const tabs: { value: string; label: string; roles: Role[] }[] = [
    { value: "general", label: "General", roles: ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "HR", "Accountant"] },
    { value: "branches", label: "Branches", roles: ["Admin"] },
    { value: "departments", label: "Departments", roles: ["Admin"] },
    { value: "roles", label: "Roles", roles: ["Admin"] },
    { value: "notifications", label: "Notifications", roles: ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "HR", "Accountant"] },
    { value: "integrations", label: "Integrations", roles: ["Admin"] },
    { value: "security", label: "Security", roles: ["Admin"] },
    { value: "danger", label: "Danger Zone", roles: ["Admin"] },
    { value: "profile", label: "My Profile", roles: ["Admin", "Doctor", "Nurse", "Receptionist", "Pharmacist", "Lab Technician", "HR", "Accountant"] },
  ];

  const visibleTabs = tabs.filter((t) => t.roles.includes(role));

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Settings"
        description="Configure hospital, branches, roles, integrations, and preferences"
        icon={SettingsIcon}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {visibleTabs.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs sm:text-sm">{t.label}</TabsTrigger>
          ))}
        </TabsList>

        {isAdminRole && (
          <TabsContent value="general" className="mt-4">
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 [&>*]:min-w-0">
              <SettingsSection icon={Building2} title="Clinic Identity" desc="Hospital details, app logo & title, login screen design" />
              <HospitalDetailsCard
                key={`hd-${settings.hospitalName ?? ""}|${settings.hospitalAddress ?? ""}|${settings.hospitalPhone ?? ""}|${settings.hospitalEmail ?? ""}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <TaxCurrencyCard
                key={`tc-${settings.currency ?? ""}|${settings.taxRate ?? ""}|${settings.billing_discountPercent ?? ""}|${settings.billing_gstPercent ?? ""}|${settings.billing_cstPercent ?? ""}|${settings.timezone ?? ""}|${settings.dateFormat ?? ""}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <TaxPresetsCard
                key={`tp-${settings.billing_taxPresets ?? ""}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <AttendanceWifiCard
                key={`net-${settingsBranch}|${settings[branchSettingKey(settingsBranch, "network_mode")] ?? ""}|${settings[branchSettingKey(settingsBranch, "network_ipAddress")] ?? ""}`}
                settings={settings}
                branch={settingsBranch}
                onSave={setAppSetting}
              />
              <AppBrandingCard
                key={`ab-${settings.appName ?? ""}|${settings.appTagline ?? ""}|${(settings.appLogo ?? "").slice(0, 32)}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <LoginDesignCard
                key={`ld-${settings.loginTitle ?? ""}|${settings.loginTheme ?? ""}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <SettingsSection icon={CreditCard} title="Bills & Reports Design" desc="Letterhead, colors and footers on every bill, report and OP file" />
              <InvoiceDesignCard key={INVOICE_DESIGN_FIELDS.map((f) => settings[f.key] ?? "").join("|")} settings={settings} onSave={setAppSetting} />
              <SettingsSection icon={CreditCard} title="Online Payments" desc="Razorpay UPI checkout — global keys plus per-branch overrides" />
              <OnlinePaymentsCard
                key={`rzp-${settings.razorpayMode ?? ""}|${settings.razorpayKeyId ?? ""}|${settings[branchSettingKey(settingsBranch, "razorpayKeyId")] ?? ""}`}
                settings={settings}
                onSave={setAppSetting}
              />
              <SettingsSection icon={BedDouble} title="Bed & Clinical Operations" desc="OP validity, capacities, bed charges, service prices" />
              <Card className="md:col-span-2 border-primary/30 bg-primary/5">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base">OP Registration — Expiry (days)</CardTitle>
                  <CardDescription className="text-xs">Single global setting. Applies to every patient: each OP registration is valid from its OP date for this many days.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="space-y-1 w-full sm:w-40">
                      <label className="text-xs font-medium text-muted-foreground">Expiry after (days)</label>
                      <Input
                        type="number"
                        min={0}
                        className="h-9"
                        placeholder={settings.opExpiryDays ?? "30"}
                        value={opExpiryInput}
                        onChange={(e) => setOpExpiryInput(e.target.value)}
                      />
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        const days = parseInt(opExpiryInput);
                        if (isNaN(days) || days < 0) {
                          toast({ title: "Invalid value", description: "Enter a number of days (0 or more).", variant: "destructive" });
                          return;
                        }
                        setAppSetting("opExpiryDays", String(days));
                        setOpExpiryInput("");
                        toast({ title: "Setting saved", description: `All OP registrations now expire after ${days} day${days === 1 ? "" : "s"} from their OP date.` });
                      }}
                    >
                      Save Setting
                    </Button>
                    <p className="text-xs text-muted-foreground sm:ml-auto">Current: <span className="font-semibold text-foreground">{settings.opExpiryDays ?? "30"} days</span></p>
                  </div>
                </CardContent>
              </Card>
              <BedCapacityCard key={`cap-${settingsBranch}|${CAPACITY_FIELDS.map((f) => branchSetting(settings, settingsBranch, f.key) ?? "").join("|")}`} settings={settings} onSave={setAppSetting} />
              <BedRateCard key={`rate-${settingsBranch}|${BED_RATE_FIELDS.map((f) => branchSetting(settings, settingsBranch, f.key) ?? "").join("|")}`} settings={settings} onSave={setAppSetting} />
              <ServicePricingCard key={settings.clinicalServicePrices ?? ""} settings={settings} onSave={setAppSetting} />
              <SettingsSection icon={Database} title="System & Security" desc="Database health and password audit trail" />
              <DatabaseStatusCard />
              <PasswordAuditCard />
            </div>
          </TabsContent>
        )}

        {!isAdminRole && (
          <TabsContent value="general" className="mt-4">
            <PreferencesCard
              key={`pf-${settings.pref_language ?? ""}|${settings.pref_timezone ?? ""}|${settings.pref_dateFormat ?? ""}`}
              settings={settings}
              onSave={setAppSetting}
            />
          </TabsContent>
        )}

        {isAdminRole && (
          <TabsContent value="branches" className="mt-4">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm sm:text-base">Hospital Branches</CardTitle>
                <Button size="sm" className="gap-2" onClick={() => setAddBranchOpen(true)}><Plus className="h-3.5 w-3.5" /> Add Branch</Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="rounded-lg border overflow-hidden mx-4 mb-4">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Branch Name</TableHead>
                        <TableHead className="hidden md:table-cell">Location</TableHead>
                        <TableHead className="text-right">Patients</TableHead>
                        <TableHead className="text-right hidden md:table-cell">Revenue (YTD)</TableHead>
                        <TableHead className="text-right hidden lg:table-cell">Staff</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {storeBranches.map((b) => {
                        const live = branchLiveStats(b.name);
                        return (
                        <TableRow key={b.id} className="hover:bg-muted/40 cursor-pointer">
                          <TableCell className="font-medium text-sm">{b.name}</TableCell>
                          <TableCell className="hidden md:table-cell text-xs text-muted-foreground"><span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.location}</span></TableCell>
                          <TableCell className="text-right text-sm" title="Live count of patients in this branch">{live.patients.toLocaleString()}</TableCell>
                          <TableCell className="text-right hidden md:table-cell text-sm font-medium" title="Collected this year in this branch">₹{(live.revenue / 100000).toFixed(1)}L</TableCell>
                          <TableCell className="text-right hidden lg:table-cell text-sm" title="Live staff count in this branch">{live.staff}</TableCell>
                          <TableCell><StatusBadge status={b.status} /></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditBranch(b)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteBranchTarget({ id: b.id, name: b.name })}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
            <AddBranchDialog open={addBranchOpen} onOpenChange={setAddBranchOpen} />
            <EditBranchDialog open={!!editBranch} onOpenChange={(v) => { if (!v) setEditBranch(null); }} branch={editBranch} />
            {deleteBranchTarget && (
              <Dialog open={!!deleteBranchTarget} onOpenChange={(v) => { if (!v) setDeleteBranchTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Delete Branch</DialogTitle><DialogDescription>Are you sure you want to delete <strong>{deleteBranchTarget.name}</strong>? All associated data will be lost.</DialogDescription></DialogHeader>
                  <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={async () => {
                    try {
                      const res = await fetch("/api/branches", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteBranchTarget.id }) });
                      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete branch."); }
                      deleteBranch(deleteBranchTarget.id);
                      toast({ title: "Branch deleted", description: `${deleteBranchTarget.name} has been removed.` });
                      setDeleteBranchTarget(null);
                    } catch (e: any) {
                      toast({ title: "Could not delete branch", description: e.message, variant: "destructive" });
                      setDeleteBranchTarget(null);
                    }
                  }}>Delete</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
        )}

        {isAdminRole && (
          <TabsContent value="departments" className="mt-4">
            <DepartmentsManager />
          </TabsContent>
        )}

        {isAdminRole && (
          <TabsContent value="roles" className="mt-4">
            <div className="rounded-xl border bg-muted/30 px-4 py-3 mb-4 grid gap-2 sm:grid-cols-3 text-xs">
              <p><span className="font-bold">1. Create</span> <span className="text-muted-foreground">a role from a template, tick what it may do.</span></p>
              <p><span className="font-bold">2. Assign</span> <span className="text-muted-foreground">it to staff from Staff → Add/Edit (role dropdown).</span></p>
              <p><span className="font-bold">3. Enforced</span> <span className="text-muted-foreground">sidebar, buttons, collection and login follow it instantly.</span></p>
            </div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-muted-foreground">Manage roles and their branch associations</p>
              <Button size="sm" className="gap-2" onClick={() => setCreateRoleOpen(true)}><Plus className="h-3.5 w-3.5" /> Create Role</Button>
            </div>
            {visibleCustomRoles.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-2">Custom Roles</h3>
                <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {visibleCustomRoles.map((r) => (
                    <Card key={r.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Shield className="h-4 w-4" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px]">{r.branch}</Badge>
                            <Switch checked={r.isActive} onCheckedChange={(checked) => updateRoleDefinition(r.id, { isActive: checked })} />
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteRoleTarget({ id: r.id, name: r.name })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm font-semibold">{r.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.description || "Custom role"}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {ROLE_MATRIX_MODULES.filter((m) => r.matrix?.[m.key]?.view).slice(0, 6).map((m) => (
                            <span key={m.key} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">{m.label}</span>
                          ))}
                          {ROLE_MATRIX_MODULES.filter((m) => r.matrix?.[m.key]?.view).length > 6 && (
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{ROLE_MATRIX_MODULES.filter((m) => r.matrix?.[m.key]?.view).length - 6} more</span>
                          )}
                          {ROLE_MATRIX_MODULES.filter((m) => r.matrix?.[m.key]?.view).length === 0 && (
                            <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px]">Sees nothing — edit below</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">Created by {r.createdBy} • enforced live</p>
                        <Button size="sm" variant="outline" className="h-7 text-[11px] mt-2 w-full" onClick={() => setEditRole(r)}>Edit Permissions</Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {visibleCustomRoles.length === 0 && (
              <div className="mb-6 p-6 rounded-lg border border-dashed text-center">
                <Shield className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">No custom roles yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create a role to define branch-scoped permissions</p>
              </div>
            )}
            <h3 className="text-sm font-semibold mb-2">Default System Roles</h3>
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
              {SYSTEM_ROLES.map((r) => {
                const mods = getEffectiveModulesForRole(r as Role, settings).filter((m) => m.key !== "dashboard" && m.key !== "settings");
                // Display counts follow the active branch; the delete guard
                // stays global because system roles are shared org-wide.
                const scopeBranch = isAdmin(currentUser.role) ? settingsBranch : currentUser.branch;
                const staffCount = allBranchStaff.filter((s) => s.role === r && sameBranch(s.branch, scopeBranch)).length;
                const loginCount = allUsers.filter((u) => u.role === r && sameBranch(u.branch, scopeBranch)).length;
                const assigned = staffCount + loginCount;
                const globalAssigned = allBranchStaff.filter((s) => s.role === r).length + allUsers.filter((u) => u.role === r).length;
                const deleted = isRoleDeleted(settings, r);
                const enabled = !deleted && isRoleLoginEnabled(settings, r);
                return (
                <Card key={r} className={`hover:shadow-md transition-shadow ${deleted ? "opacity-70 border-dashed" : ""}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Shield className="h-4 w-4" />
                      </div>
                      {deleted ? (
                        <Badge variant="outline" className="text-[10px] border-destructive/50 text-destructive">Deleted</Badge>
                      ) : (
                        <div className="flex items-center gap-2" title={enabled ? "Logins allowed — toggle off to block" : "Logins blocked — toggle on to allow"}>
                          <span className={`text-[10px] font-medium ${enabled ? "text-success" : "text-destructive"}`}>{enabled ? "Active" : "Blocked"}</span>
                          <Switch
                            checked={enabled}
                            onCheckedChange={(v) => {
                              setAppSetting(`role_${slugify(r)}`, String(v));
                              auditRole(v ? "ROLE_ENABLED" : "ROLE_BLOCKED", `${currentUser.name} ${v ? "enabled" : "blocked"} logins for the ${r} role.`);
                              toast({ title: v ? `${r} logins enabled` : `${r} logins blocked`, description: v ? `Staff with the ${r} role can sign in.` : `Nobody with the ${r} role can sign in until re-enabled.` });
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{r}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {getRoleDesc(settings, r)}
                      {" • "}{staffCount} staff{loginCount !== staffCount ? ` • ${loginCount} logins` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {mods.slice(0, 6).map((m) => (
                        <span key={m.key} className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-medium">{m.label}</span>
                      ))}
                      {mods.length > 6 && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">+{mods.length - 6} more</span>
                      )}
                      {mods.length === 0 && !deleted && (
                        <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 text-[10px]">No modules — edit to grant access</span>
                      )}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {deleted ? (
                        <Button
                          size="sm" variant="outline" className="h-7 flex-1 text-[11px]"
                          onClick={async () => {
                            const res: any = await setAppSetting(roleDeletedKey(r), "false");
                            if (res && res.ok === false) {
                              toast({ title: "Could not restore", description: res.error, variant: "destructive" });
                              return;
                            }
                            auditRole("ROLE_RESTORED", `${currentUser.name} restored the deleted ${r} role.`);
                            toast({ title: `${r} restored`, description: "The role is usable again with its default access." });
                          }}
                        >
                          Restore role
                        </Button>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" className="h-7 flex-1 text-[11px]" onClick={() => setEditSystemRole(r)}>
                            <Pencil className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm" variant="ghost" className="h-7 text-[11px] text-destructive hover:bg-destructive/10"
                            onClick={() => {
                              if (r === "Admin") {
                                toast({ title: "Cannot delete Admin", description: "The Admin role is built in and can never be deleted.", variant: "destructive" });
                                return;
                              }
                              if (globalAssigned > 0) {
                                toast({ title: `Cannot delete ${r}`, description: `${r} is still used somewhere (any branch). Reassign those staff/logins to another role first.`, variant: "destructive" });
                                return;
                              }
                              setDeleteSystemRole(r);
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
            <CreateRoleDialog open={createRoleOpen} onOpenChange={setCreateRoleOpen} />
            {editRole && <EditRoleDialog role={editRole} onClose={() => setEditRole(null)} />}
            {editSystemRole && (
              <EditSystemRoleDialog
                role={editSystemRole}
                settings={settings}
                onSave={setAppSetting}
                onClose={() => setEditSystemRole(null)}
                onSaved={(details) => auditRole("ROLE_EDITED", details)}
              />
            )}
            {deleteSystemRole && (
              <Dialog open={!!deleteSystemRole} onOpenChange={(v) => { if (!v) setDeleteSystemRole(null); }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Delete {deleteSystemRole} role?</DialogTitle><DialogDescription>The <strong>{deleteSystemRole}</strong> role will stop working everywhere: no logins, no sidebar access, and it disappears from staff assignment. This can be undone with Restore.</DialogDescription></DialogHeader>
                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        const role = deleteSystemRole;
                        const res: any = await setAppSetting(roleDeletedKey(role), "true");
                        if (res && res.ok === false) {
                          toast({ title: "Could not delete", description: res.error, variant: "destructive" });
                          return;
                        }
                        auditRole("ROLE_DELETED", `${currentUser.name} deleted the ${role} role.`);
                        toast({ title: `${role} deleted`, description: "Logins and access for this role are now blocked. Restore anytime." });
                        setDeleteSystemRole(null);
                      }}
                    >
                      Delete role
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
            {deleteRoleTarget && (
              <Dialog open={!!deleteRoleTarget} onOpenChange={(v) => { if (!v) setDeleteRoleTarget(null); }}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Delete Role</DialogTitle><DialogDescription>Are you sure you want to delete the <strong>{deleteRoleTarget.name}</strong> role?</DialogDescription></DialogHeader>
                  <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={() => { deleteRoleDefinition(deleteRoleTarget.id); setDeleteRoleTarget(null); }}>Delete</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>
        )}

          <TabsContent value="notifications" className="mt-4">
            <NotificationLiveCard />
            <div className="grid gap-3 sm:gap-4 md:grid-cols-2 mt-3">
            {[
              { title: "Appointment Reminders", desc: "Send SMS/Email 24h before appointment", icon: Calendar, roles: ["Admin", "Doctor", "Receptionist"] },
              { title: "Prescription Ready", desc: "Notify patient when prescription is ready", icon: FileText, roles: ["Admin", "Doctor", "Pharmacist"] },
              { title: "Lab Report Ready", desc: "Notify patient when lab results are available", icon: Bell, roles: ["Admin", "Lab Technician"] },
              { title: "Bill Pending", desc: "Remind patient of pending payments", icon: CreditCard, roles: ["Admin", "Accountant", "Receptionist"] },
              { title: "Insurance Approved", desc: "Notify on insurance claim approval", icon: Shield, roles: ["Admin", "Accountant"] },
              { title: "Shift Reminders", desc: "Remind staff about upcoming shifts", icon: Clock, roles: ["Admin", "Nurse", "Doctor"] },
            ].filter((n) => n.roles.includes(role)).map((n) => {
              const Icon = n.icon;
              return (
                <Card key={n.title}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{n.title}</p>
                      <p className="text-xs text-muted-foreground">{n.desc}</p>
                    </div>
                    <Switch
                      checked={settings[`notif_${slugify(n.title)}`] !== undefined ? settings[`notif_${slugify(n.title)}`] === "true" : true}
                      onCheckedChange={(v) => setAppSetting(`notif_${slugify(n.title)}`, String(v))}
                    />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {isAdminRole && (
          <TabsContent value="integrations" className="mt-4">
            <IntegrationsTab settings={settings} onSave={setAppSetting} onGotoPayments={() => setActiveTab("general")} />
          </TabsContent>
        )}

        {isAdminRole && (
          <TabsContent value="security" className="mt-4">
            <SecurityTab settings={settings} onSave={setAppSetting} />
          </TabsContent>
        )}

        {isAdminRole && (
          <TabsContent value="danger" className="mt-4">
            <Card className="border-destructive/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base text-destructive flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" /> Danger Zone
                </CardTitle>
                <CardDescription>Irreversible actions that affect the entire system. Proceed with extreme caution.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border border-destructive/20 bg-destructive/5">
                  <div>
                    <p className="text-sm font-semibold text-destructive">Delete All Data</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Permanently erase all patients, staff, branches, invoices, appointments, and user accounts. The application will reset to the initial Admin setup screen.</p>
                  </div>
                  <Button variant="destructive" size="sm" className="shrink-0 ml-4" onClick={() => setDeleteAllDataOpen(true)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete All Data
                  </Button>
                </div>
              </CardContent>
            </Card>
            <DeleteAllDataDialog open={deleteAllDataOpen} onOpenChange={setDeleteAllDataOpen} />
          </TabsContent>
        )}

        <TabsContent value="profile" className="mt-4">
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <ProfileInfoCard
              key={`pi-${settings.profile_name ?? ""}|${settings.profile_email ?? ""}`}
              settings={settings}
              onSave={setAppSetting}
            />
            <ChangePasswordCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===== Reception Module =====
const MISS_GRACE_MINUTES = 10;

export function ReceptionModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const updateAppointment = useAppStore((s) => s.updateAppointment);
  const setActiveModule = useAppStore((s) => s.setActiveModule);
  const [newRegOpen, setNewRegOpen] = useState(false);
  const [regPresetStatus, setRegPresetStatus] = useState<"OPD" | "Admitted">("OPD");
  const [bookingOpen, setBookingOpen] = useState(false);
  const { toast } = useToast();
  const showAdd = canAddPatient(currentUser.role);
  const { appointments, invoices } = useBranchData();
  const todayStr = new Date().toISOString().split("T")[0];
  const todayApts = useMemo(
    () => appointments.filter((a) => a.date === todayStr).sort((a, b) => a.token.localeCompare(b.token, undefined, { numeric: true })),
    [appointments, todayStr]
  );

  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();

  const serving = todayApts.find((a) => a.status === "In Consultation");
  const waiting = useMemo(
    () => todayApts.filter((a) => a.status === "Scheduled" || a.status === "Checked-in"),
    [todayApts]
  );
  const missed = useMemo(() => todayApts.filter((a) => a.status === "No-show"), [todayApts]);
  const completed = useMemo(() => todayApts.filter((a) => a.status === "Completed"), [todayApts]);
  const waitingCount = waiting.length;
  const servedCount = serving ? 1 : 0 + completed.length;
  const paymentsToday = invoices.filter((i) => i.date === todayStr).reduce((s, i) => s + (i.paidAmount || 0), 0);
  const nextToken = waiting[0];
  const avgWait = todayApts.length > 0 ? Math.round(todayApts.reduce((s, a) => s + (a.waitingTime || 0), 0) / todayApts.length) : 0;

  // Auto-miss: a Scheduled token whose slot passed by more than the grace
  // period is flagged No-show and reissued the NEXT free number, so it moves
  // to the bottom of the queue. Both changes persist to Supabase.
  const processedMiss = useRef<Set<string>>(new Set());
  useEffect(() => {
    const run = async () => {
      for (const apt of todayApts) {
        if (apt.status !== "Scheduled" || processedMiss.current.has(apt.id)) continue;
        if (nowMinutes - toMinutes(apt.time) < MISS_GRACE_MINUTES) continue;
        processedMiss.current.add(apt.id);
        try {
          await fetch("/api/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: apt.id, status: "No-show", ...scheduleActor(currentUser.role, currentUser.name) }),
          });
          const maxToken = todayApts.reduce((mx, a) => Math.max(mx, parseInt(a.token.split("-")[1], 10) || 0), 0);
          const newToken = `A-${String(maxToken + 1).padStart(3, "0")}`;
          await fetch("/api/appointments", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: apt.id, token: newToken }),
          });
          updateAppointment(apt.id, { status: "No-show", token: newToken });
          toast({ title: "Token missed", description: `${apt.token} (${apt.patientName}) missed their slot — requeued as ${newToken}.` });
        } catch {
          processedMiss.current.delete(apt.id);
        }
      }
    };
    run();
    const id = setInterval(run, 30000);
    return () => clearInterval(id);
  }, [todayApts, nowMinutes, updateAppointment, toast]);

  const callNext = async () => {
    try {
      if (serving) {
        await fetch("/api/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: serving.id, status: "Completed", ...scheduleActor(currentUser.role, currentUser.name) }),
        });
        updateAppointment(serving.id, { status: "Completed" });
      }
      const next = waiting[0];
      if (next) {
        await fetch("/api/appointments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: next.id, status: "In Consultation", ...scheduleActor(currentUser.role, currentUser.name) }),
        });
        updateAppointment(next.id, { status: "In Consultation" });
        toast({ title: "Now serving", description: `Token ${next.token} — ${next.patientName}` });
      }
    } catch (e: any) {
      toast({ title: "Could not call next", description: e.message, variant: "destructive" });
    }
  };

  const printTokens = () => {
    const rows = [...(serving ? [serving] : []), ...waiting, ...missed]
      .map(
        (a) =>
          `<tr><td style="padding:6px 10px;border:1px solid #ddd;font-weight:700">${a.token}</td><td style="padding:6px 10px;border:1px solid #ddd">${a.patientName}</td><td style="padding:6px 10px;border:1px solid #ddd">${a.doctorName}</td><td style="padding:6px 10px;border:1px solid #ddd">${a.time}</td></tr>`
      )
      .join("");
    const win = window.open("", "_blank", "width=520,height=640");
    if (!win) return;
    win.document.write(`<!doctype html><title>Tokens — ${todayStr}</title>
      <body style="font-family:system-ui;padding:20px">
      <h2 style="margin:0 0 4px">MediCore — Token Board</h2>
      <p style="margin:0 0 12px;color:#666">${todayStr} • Waiting: ${waitingCount} • Missed: ${missed.length}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px">
      <tr><th style="padding:6px 10px;border:1px solid #ddd;background:#f5f5f5;text-align:left">Token</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f5f5f5;text-align:left">Patient</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f5f5f5;text-align:left">Doctor</th><th style="padding:6px 10px;border:1px solid #ddd;background:#f5f5f5;text-align:left">Time</th></tr>
      ${rows || `<tr><td colspan="4" style="padding:12px;border:1px solid #ddd;text-align:center;color:#888">No active tokens</td></tr>`}
      </table></body>`);
    win.document.close();
    win.focus();
    win.print();
  };

  const weeklyData = useMemo(() => {
    const days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split("T")[0];
      days.push({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        count: appointments.filter((a) => a.date === iso).length,
      });
    }
    return days;
  }, [appointments]);

  const openRegistration = (status: "OPD" | "Admitted") => {
    setRegPresetStatus(status);
    setNewRegOpen(true);
  };

  const tiles = [
    { label: "New Patient", icon: UserPlus, color: "primary", action: () => openRegistration("OPD"), disabled: !showAdd },
    { label: "Book Appointment", icon: Calendar, color: "info", action: () => setBookingOpen(true), disabled: !showAdd },
    { label: "OPD Registration", icon: FileText, color: "success", action: () => openRegistration("OPD"), disabled: !showAdd },
    { label: "IPD Admission", icon: Building2, color: "warning", action: () => openRegistration("Admitted"), disabled: !showAdd },
    { label: "Print Token", icon: Printer, color: "primary", action: printTokens, disabled: false },
    { label: "Collect Payment", icon: CreditCard, color: "destructive", action: () => setActiveModule("billing"), disabled: false },
  ];

  const queueRow = (a: Appointment, tone: string) => (
    <div key={a.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${tone}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
        {a.token.split("-")[1]}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{a.patientName}</p>
        <p className="text-xs text-muted-foreground">{a.doctorName} • {a.time}{a.status === "No-show" ? ` • requeued as ${a.token}` : ""}</p>
      </div>
      <StatusBadge status={a.status} />
    </div>
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Reception"
        description="Front desk operations — registration, tokens, and helpdesk"
        icon={ConciergeBell}
        action={showAdd ? <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => openRegistration("OPD")}><UserPlus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> New Registration</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Today's Check-ins" value={todayApts.length.toString()} icon={CheckCircle2} color="primary" />
        <StatCard title="Waiting" value={waitingCount.toString()} icon={Clock} color="warning" />
        <StatCard title="Tokens Issued" value={todayApts.length.toString()} icon={QrCode} color="info" />
        <StatCard title="Payments Collected" value={`₹${paymentsToday.toLocaleString("en-IN")}`} icon={CreditCard} color="success" />
      </div>

      <VisitRequestsInbox />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
        {tiles.map((a) => {
          const Icon = a.icon;
          const colorMap = {
            primary: "bg-primary/10 text-primary",
            info: "bg-info/10 text-info",
            success: "bg-success/10 text-success",
            warning: "bg-warning/10 text-warning",
            destructive: "bg-destructive/10 text-destructive",
          };
          return (
            <Card key={a.label} className={`hover:shadow-md transition-shadow ${a.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`} onClick={a.disabled ? undefined : a.action}>
              <CardContent className="p-4 text-center">
                <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[a.color as keyof typeof colorMap]} mb-2`}>
                  <Icon className="h-6 w-6" />
                </div>
                <p className="text-xs font-medium">{a.label}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 sm:gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Today&apos;s Queue — token order</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {serving && queueRow(serving, "bg-primary/5 border-primary/30")}
            {waiting.map((a) => queueRow(a, "hover:bg-muted/40"))}
            {missed.map((a) => queueRow(a, "bg-muted/30 opacity-80"))}
            {completed.slice(0, 5).map((a) => queueRow(a, "opacity-70"))}
            {todayApts.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm sm:text-base">Helpdesk</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg bg-primary/5 p-3">
              <p className="text-xs text-muted-foreground">{serving ? "Now Serving" : "Next Token"}</p>
              <p className="text-3xl font-bold text-primary">{serving ? serving.token : nextToken ? nextToken.token : "—"}</p>
              {serving && <p className="text-xs text-muted-foreground mt-1">{serving.patientName}</p>}
              <Button size="sm" className="w-full mt-2" onClick={callNext} disabled={!serving && !nextToken}>
                Call Next
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold text-warning">{waitingCount}</p>
                <p className="text-[10px] text-muted-foreground">Waiting</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2">
                <p className="text-lg font-bold text-success">{servedCount}</p>
                <p className="text-[10px] text-muted-foreground">Served</p>
              </div>
            </div>
            {missed.length > 0 && (
              <div className="rounded-lg bg-destructive/5 p-2 text-center">
                <p className="text-lg font-bold text-destructive">{missed.length}</p>
                <p className="text-[10px] text-muted-foreground">Missed — requeued at bottom</p>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground mb-2">AVG WAIT TIME</p>
              <p className="text-2xl font-bold">{avgWait} min</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Appointments — Last 7 Days
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="rgba(128,128,128,0.5)" />
                <Tooltip cursor={{ fill: "rgba(128,128,128,0.08)" }} />
                <Bar dataKey="count" name="Appointments" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {showAdd && <NewRegistrationDialog key={regPresetStatus} open={newRegOpen} onOpenChange={setNewRegOpen} presetStatus={regPresetStatus} />}
      {bookingOpen && <NewAppointmentDialog open onOpenChange={(v) => { if (!v) setBookingOpen(false); }} />}
    </div>
  );
}

// ===== New Registration Dialog =====
function NewRegistrationDialog({ open, onOpenChange, presetStatus = "OPD" }: { open: boolean; onOpenChange: (v: boolean) => void; presetStatus?: "OPD" | "Admitted" }) {
  const { toast } = useToast();
  const addPatient = useAppStore((s) => s.addPatient);
  const addAppointment = useAppStore((s) => s.addAppointment);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const settings = useAppStore((s) => s.settings);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const { doctors } = useBranchData();
  const [form, setForm] = useState({
    name: "", phone: "", email: "", gender: "Male" as "Male" | "Female" | "Other",
    age: "", bloodGroup: "O+", address: "", emergencyContact: "",
    insuranceProvider: "", insurancePolicy: "", status: presetStatus as "Active" | "Admitted" | "Discharged" | "OPD" | "Follow Up",
    opDate: new Date().toISOString().split("T")[0], opFees: "",
    doctorId: "",
    feeCollected: true,
  });
  const doctorSchedules = useAppStore((s) => s.doctorSchedules);
  const availableDoctors = useMemo(
    () => doctors.filter((d) => isDoctorAvailableOn(d, form.opDate, { schedules: doctorSchedules, branch: activeBranch })),
    [doctors, form.opDate, doctorSchedules, activeBranch]
  );
  const [doctorFilters, setDoctorFilters] = useState({ department: "", shift: "" });
  const doctorDepartments = useMemo(
    () => Array.from(new Set(doctors.map((d) => d.department).filter(Boolean))).sort(),
    [doctors]
  );
  const matchedDoctors = useMemo(
    () =>
      availableDoctors.filter(
        (d) =>
          (!doctorFilters.department || d.department === doctorFilters.department) &&
          (!doctorFilters.shift || d.shift === doctorFilters.shift)
      ),
    [availableDoctors, doctorFilters]
  );
  const selectedDoctor = doctors.find((d) => d.id === form.doctorId);
  const listedIds = new Set(matchedDoctors.map((d) => d.id));
  const selectedOffSchedule = !!selectedDoctor && !isDoctorAvailableOn(selectedDoctor, form.opDate, { schedules: doctorSchedules, branch: activeBranch });
  const selectedFilteredOut = !!selectedDoctor && !selectedOffSchedule && !listedIds.has(selectedDoctor.id);
  const doctorOptions =
    selectedDoctor && !listedIds.has(selectedDoctor.id) ? [selectedDoctor, ...matchedDoctors] : matchedDoctors;
  const handleOpDateChange = (value: string) => {
    setForm((f) => {
      const current = doctors.find((d) => d.id === f.doctorId);
      const stillOk = !current || isDoctorAvailableOn(current, value, { schedules: doctorSchedules, branch: activeBranch });
      return { ...f, opDate: value, doctorId: stillOk ? f.doctorId : "" };
    });
  };
  const handleDoctorChange = (doctorId: string) => {
    const doctor = doctors.find((d) => d.id === doctorId);
    setForm({
      ...form,
      doctorId,
      opFees: doctor && doctor.consultationFee > 0 ? String(doctor.consultationFee) : form.opFees,
    });
  };
  const [saving, setSaving] = useState(false);
  const handleSubmit = async () => {
    if (!form.name || !form.phone) { toast({ title: "Missing fields", description: "Name and phone are required.", variant: "destructive" }); return; }
    const clash = useAppStore.getState().patients.find((p) => samePhone(p.phone, form.phone));
    if (clash) {
      toast({ title: "Duplicate phone number", description: `This number already belongs to ${clash.name} (${clash.uhid}). Each patient needs their own number.`, variant: "destructive" });
      return;
    }
    const id = `p${Date.now()}`;
    const uhid = `MC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 999999)).padStart(6, "0")}`;
    const newPatient = {
      id, uhid, name: form.name, photo: form.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase(),
      gender: form.gender, age: parseInt(form.age) || 0, phone: form.phone, email: form.email || "-",
      bloodGroup: form.bloodGroup, address: form.address || "-", emergencyContact: form.emergencyContact || "-",
      insuranceProvider: form.insuranceProvider || "Self Pay", insurancePolicy: form.insurancePolicy || "-",
      allergies: [] as string[], chronicDiseases: [] as string[], status: form.status,
      lastVisit: new Date().toISOString().split("T")[0], registeredOn: new Date().toISOString().split("T")[0],
      branch: activeBranch,
      opDate: form.opDate || new Date().toISOString().split("T")[0],
      opFees: parseFloat(form.opFees) || 0,
      doctorId: form.doctorId,
      doctorName: selectedDoctor?.name ?? "",
    };
    setSaving(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPatient),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save the registration.");
      }
    } catch (e: any) {
      toast({ title: "Could not register patient", description: e.message, variant: "destructive" });
      setSaving(false);
      return;
    }
    // OP fee → Billing invoice: Paid when collected now, Pending when not.
    // Pending fees are collected later from Billing (or the patient profile).
    let invoiceNo = "";
    const fee = newPatient.opFees ?? 0;
    const collected = form.feeCollected;
    if (fee > 0) {
      try {
        const invRes = await fetch("/api/invoices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `inv${Date.now()}`,
            patientId: newPatient.id,
            patientName: newPatient.name,
            date: newPatient.opDate,
            items: [{
              description: `OPD Consultation — ${selectedDoctor?.name ?? "Doctor"}${selectedDoctor?.department ? ` (${selectedDoctor.department})` : ""}`,
              category: "OPD",
              quantity: 1,
              rate: fee,
              amount: fee,
            }],
            subtotal: fee,
            tax: 0,
            discount: 0,
            total: fee,
            paidAmount: collected ? fee : 0,
            status: collected ? "Paid" : "Pending",
            paymentMethod: collected ? "Cash" : "",
            branch: newPatient.branch,
            paidDate: collected ? newPatient.opDate : "",
          }),
        });
        if (invRes.ok) {
          const savedInv = await invRes.json();
          addInvoice(savedInv);
          invoiceNo = savedInv.invoiceNo;
          if (!printInvoice(savedInv, settings, newPatient)) {
            toast({ title: "Bill ready to download", description: "Allow pop-ups for auto-print, or download it from Billing." });
          }
        }
      } catch (e: any) {
        toast({ title: "Fee invoice failed", description: e.message, variant: "destructive" });
      }
    }
    // Create the OPD appointment so the visit shows in the calendar on the OP date.
    let appointmentToken = "";
    if (form.doctorId && newPatient.status !== "Admitted") {
      try {
        const now = new Date();
        const aptRes = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `a${Date.now()}`,
            token: "",
            patientId: newPatient.id,
            patientName: newPatient.name,
            patientPhoto: newPatient.photo,
            doctorId: form.doctorId,
            doctorName: selectedDoctor?.name ?? "",
            department: selectedDoctor?.department ?? "",
            date: newPatient.opDate,
            time: newPatient.opDate === new Date().toISOString().split("T")[0] ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}` : "09:00",
            type: "Walk-in",
            status: "Scheduled",
            reason: "OPD Registration",
            waitingTime: 0,
            branch: newPatient.branch,
          }),
        });
        if (aptRes.ok) {
          const savedApt = await aptRes.json();
          addAppointment(savedApt);
          appointmentToken = savedApt.token;
        }
      } catch {
        // Non-fatal: patient + invoice are saved.
      }
    }
    setSaving(false);
    addPatient(newPatient);
    toast({
      title: "Registration Complete",
      description: `${form.name} registered.${appointmentToken ? ` OPD visit on ${newPatient.opDate} (token ${appointmentToken}).` : ""}${fee > 0 ? (collected ? ` OP fee ₹${fee.toLocaleString("en-IN")} collected${invoiceNo ? ` (${invoiceNo})` : ""}.` : ` OP fee ₹${fee.toLocaleString("en-IN")} pending${invoiceNo ? ` (${invoiceNo})` : ""} — collect it from Billing.`) : ""}`,
    });
    setForm({
      name: "", phone: "", email: "", gender: "Male", age: "", bloodGroup: "O+", address: "",
      emergencyContact: "", insuranceProvider: "", insurancePolicy: "", status: presetStatus,
      opDate: new Date().toISOString().split("T")[0], opFees: "", doctorId: "",
      feeCollected: true,
    });
    onOpenChange(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>New Registration</DialogTitle><DialogDescription>Register a patient at the front desk.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4 max-h-[65vh] overflow-y-auto pr-1">
        <div className="space-y-2"><Label>Full Name *</Label><Input placeholder="Patient name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Phone *</Label><Input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Label>Gender</Label><Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v as "Male" | "Female" | "Other" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Age</Label><Input type="number" placeholder="Age" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
          <div className="space-y-2"><Label>Blood Group</Label><Select value={form.bloodGroup} onValueChange={(v) => setForm({ ...form, bloodGroup: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map((bg) => <SelectItem key={bg} value={bg}>{bg}</SelectItem>)}</SelectContent></Select></div>
        </div>
        <div className="space-y-2"><Label>Address</Label><Textarea placeholder="Full address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Emergency Contact</Label><Input placeholder="Emergency phone" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} /></div>
          <div className="space-y-2"><Label>Insurance Provider</Label><Input placeholder="Provider name" value={form.insuranceProvider} onChange={(e) => setForm({ ...form, insuranceProvider: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Insurance Policy Number</Label><Input placeholder="Policy number" value={form.insurancePolicy} onChange={(e) => setForm({ ...form, insurancePolicy: e.target.value })} /></div>
          <div className="space-y-2"><Label>Status</Label><Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as "Active" | "Admitted" | "Discharged" | "OPD" | "Follow Up" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Active">Active</SelectItem><SelectItem value="Admitted">Admitted</SelectItem><SelectItem value="OPD">OPD</SelectItem><SelectItem value="Discharged">Discharged</SelectItem><SelectItem value="Follow Up">Follow Up</SelectItem></SelectContent></Select></div>
        </div>
        <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={doctorFilters.department} onValueChange={(v) => setDoctorFilters((f) => ({ ...f, department: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all-depts">All departments</SelectItem>
                  {doctorDepartments.map((dep) => <SelectItem key={dep} value={dep}>{dep}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shift</Label>
              <Select value={doctorFilters.shift} onValueChange={(v) => setDoctorFilters((f) => ({ ...f, shift: v }))}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Any shift" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any-shift">Any shift</SelectItem>
                  <SelectItem value="Morning">Morning</SelectItem>
                  <SelectItem value="Evening">Evening</SelectItem>
                  <SelectItem value="Night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {(doctorFilters.department || doctorFilters.shift) && (
            <button
              type="button"
              onClick={() => setDoctorFilters({ department: "", shift: "" })}
              className="text-[11px] text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
          <div className="space-y-2">
            <Label>Assign Doctor{form.opDate ? ` — ${weekdayOf(form.opDate)}` : ""}{matchedDoctors.length > 0 ? ` (${matchedDoctors.length} available)` : ""}</Label>
            <Select value={form.doctorId} onValueChange={handleDoctorChange}>
              <SelectTrigger><SelectValue placeholder={doctorOptions.length === 0 ? "No matching doctors" : "Select doctor"} /></SelectTrigger>
              <SelectContent>
                {doctorOptions.map((d) => {
                  const offSchedule = !isDoctorAvailableOn(d, form.opDate, { schedules: doctorSchedules, branch: activeBranch });
                  return (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                      {d.consultationFee > 0 ? ` — ₹${d.consultationFee}` : ""}
                      {d.shift ? ` • ${d.shift}` : ""}
                      {offSchedule ? " (off schedule)" : ""}
                    </SelectItem>
                  );
                })}
                {doctorOptions.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No doctors match the selected department/shift for this weekday.</div>
                )}
              </SelectContent>
            </Select>
            {selectedOffSchedule && (
              <p className="text-[11px] text-destructive">{selectedDoctor!.name} is not scheduled on {weekdayOf(form.opDate)}. Pick another doctor or change the OP date.</p>
            )}
            {selectedFilteredOut && (
              <p className="text-[11px] text-muted-foreground">{selectedDoctor!.name} is currently hidden by the department/shift filters.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>OP Date</Label><Input type="date" value={form.opDate} onChange={(e) => handleOpDateChange(e.target.value)} /></div>
            <div className="space-y-2"><Label>OP Fees (₹){selectedDoctor && selectedDoctor.consultationFee > 0 ? " — auto-filled" : ""}</Label><Input type="number" placeholder="Consultation fees" value={form.opFees} onChange={(e) => setForm({ ...form, opFees: e.target.value })} />
              {selectedDoctor && !(selectedDoctor.consultationFee > 0) && <p className="text-[11px] text-warning">No fee set for {selectedDoctor.name} — enter manually or set it in Doctors → Edit.</p>}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Fee Payment</Label>
            <Select value={form.feeCollected ? "collected" : "pending"} onValueChange={(v) => setForm({ ...form, feeCollected: v === "collected" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="collected">Collected now — Paid bill in Billing</SelectItem>
                <SelectItem value="pending">Not collected — Pending bill, collect later</SelectItem>
              </SelectContent>
            </Select>
            {!form.feeCollected && <p className="text-[11px] text-warning">The fee stays pending in Billing — collect it anytime from Billing or the patient profile.</p>}
          </div>
        </div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Registering..." : "Register"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===== Medical Records Module =====

function AddRecordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const addMedicalRecord = useAppStore((s) => s.addMedicalRecord);
  const branchData = useBranchData();
  const currentUser = useAppStore((s) => s.currentUser);
  const [form, setForm] = useState({ patientId: "", patientName: "", type: "Prescription", title: "", notes: "", doctor: "", recordDate: new Date().toISOString().split("T")[0] });
  const [saving, setSaving] = useState(false);
  const patientOptions = branchData.patients.map((p) => p.name);
  const recordTypeOptions = ["Prescription", "Lab Report", "Radiology Report", "Discharge Summary", "Clinical Notes", "Medical Certificate"];
  const doctorOptions = uniqueOptions(branchData.doctors.map((d) => d.name));

  const handleSubmit = async () => {
    if (!form.patientName) { toast({ title: "Missing fields", description: "Patient name is required.", variant: "destructive" }); return; }
    const newRecord: MedicalRecord = {
      id: `mr${Date.now()}`,
      patientId: form.patientId || branchData.patients.find((p) => p.name === form.patientName)?.id || "",
      patientName: form.patientName,
      type: form.type,
      title: form.title || form.type,
      notes: form.notes,
      doctor: form.doctor,
      recordDate: form.recordDate,
      branch: branchData.branch,
      createdBy: currentUser.name || "",
    };
    setSaving(true);
    try {
      const res = await fetch("/api/medical-records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newRecord) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to add record."); }
      const saved = await res.json();
      addMedicalRecord(saved);
      toast({ title: "Record Added", description: `${form.type} for ${form.patientName} saved.` });
      setForm({ patientId: "", patientName: "", type: "Prescription", title: "", notes: "", doctor: "", recordDate: new Date().toISOString().split("T")[0] });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not add record", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };
  const selectedPatient = branchData.patients.find((p) => p.name === form.patientName);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Add Medical Record</DialogTitle><DialogDescription>Create a new medical record — it prints with clinic letterhead and patient details.</DialogDescription></DialogHeader>
        <div className="grid gap-5 py-4">
          <section className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><User className="h-3.5 w-3.5" /> 1 • Patient</p>
            <div className="space-y-2"><Label>Patient Name *</Label><SearchableField value={form.patientName} onChange={(patientName) => { const p = branchData.patients.find((pt) => pt.name === patientName); setForm({ ...form, patientName, patientId: p?.id || "" }); }} options={patientOptions} placeholder="Search patient by name" searchPlaceholder="Search patient or type custom name..." emptyLabel="Add patient name" /></div>
            {selectedPatient && (
              <p className="text-xs text-muted-foreground">{selectedPatient.uhid} • {selectedPatient.age} yrs / {selectedPatient.gender}{selectedPatient.phone ? ` • ${selectedPatient.phone}` : ""}</p>
            )}
          </section>
          <section className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><ClipboardList className="h-3.5 w-3.5" /> 2 • Report Details</p>
            <div className="space-y-2">
              <Label>Record Type</Label>
              <div className="flex flex-wrap gap-1.5">
                {recordTypeOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm({ ...form, type: t, title: form.title === form.type ? t : form.title })}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${form.type === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:border-primary/50"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Title</Label><Input placeholder={form.type} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Doctor</Label><SearchableField value={form.doctor} onChange={(doctor) => setForm({ ...form, doctor })} options={doctorOptions} placeholder="Search/add doctor" /></div>
          </section>
          <section className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary"><Stethoscope className="h-3.5 w-3.5" /> 3 • Clinical Notes</p>
            <div className="space-y-2"><Label>Details / Observations</Label><Textarea rows={4} placeholder="Diagnosis, observations, treatment given, advice..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </section>
        </div>
        <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit} disabled={saving}>{saving ? "Saving..." : "Save Record"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditRecordDialog({ open, onOpenChange, record }: { open: boolean; onOpenChange: (v: boolean) => void; record: MedicalRecord | null }) {
  const { toast } = useToast();
  const updateMedicalRecord = useAppStore((s) => s.updateMedicalRecord);
  const branchData = useBranchData();
  const [form, setForm] = useState({ patientName: "", type: "", title: "", notes: "", doctor: "", recordDate: "" });
  const prevId = useState<string | null>(null);

  if (record && record.id !== prevId[0]) {
    prevId[1](record.id);
    setForm({ patientName: record.patientName, type: record.type, title: record.title, notes: record.notes, doctor: record.doctor, recordDate: record.recordDate });
  }

  const handleSubmit = async () => {
    if (!record || !form.patientName) { toast({ title: "Missing fields", description: "Patient name is required.", variant: "destructive" }); return; }
    try {
      const res = await fetch("/api/medical-records", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: record.id, ...form }) });
      if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to update."); }
      const saved = await res.json();
      updateMedicalRecord(record.id, saved);
      toast({ title: "Record Updated", description: `${form.type} for ${form.patientName} updated.` });
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update", description: e.message, variant: "destructive" });
    }
  };
  if (!record) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Edit Medical Record</DialogTitle><DialogDescription>Update record details.</DialogDescription></DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="space-y-2"><Label>Patient Name *</Label><Input value={form.patientName} onChange={(e) => setForm({ ...form, patientName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Record Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["Prescription", "Lab Report", "Radiology Report", "Discharge Summary", "Clinical Notes", "Medical Certificate"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.recordDate} onChange={(e) => setForm({ ...form, recordDate: e.target.value })} /></div>
        </div>
        <div className="space-y-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
        <div className="space-y-2"><Label>Doctor</Label><Input value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} /></div>
        <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button onClick={handleSubmit}>Update</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ViewRecordDialog({ record, onOpenChange }: { record: MedicalRecord | null; onOpenChange: (v: boolean) => void }) {
  if (!record) return null;
  return (
    <Dialog open={!!record} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{record.title || record.type}</DialogTitle><DialogDescription>Record for {record.patientName}</DialogDescription></DialogHeader>
      <div className="grid gap-3 py-4 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-muted-foreground">Type</span><p className="font-medium">{record.type}</p></div>
          <div><span className="text-muted-foreground">Date</span><p className="font-medium">{record.recordDate}</p></div>
          <div><span className="text-muted-foreground">Patient</span><p className="font-medium">{record.patientName}</p></div>
          <div><span className="text-muted-foreground">Doctor</span><p className="font-medium">{record.doctor || "—"}</p></div>
        </div>
        {record.notes && <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground text-xs">Notes</span><p className="mt-1 whitespace-pre-wrap">{record.notes}</p></div>}
        <div className="text-xs text-muted-foreground">Created by {record.createdBy || "Unknown"} • Branch: {record.branch}</div>
      </div>
      <DialogFooter><DialogClose asChild><Button variant="outline">Close</Button></DialogClose></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRecordDialog({ open, onOpenChange, record, onConfirm }: { open: boolean; onOpenChange: (v: boolean) => void; record: MedicalRecord | null; onConfirm: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Delete Record</DialogTitle><DialogDescription>Are you sure you want to delete the <strong>{record?.type}</strong> record for <strong>{record?.patientName}</strong>? This action cannot be undone.</DialogDescription></DialogHeader>
      <DialogFooter><DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose><Button variant="destructive" onClick={onConfirm}>Delete</Button></DialogFooter></DialogContent>
    </Dialog>
  );
}

export function RecordsModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const branchData = useBranchData();
  const medicalRecords = useAppStore((s) => s.medicalRecords);
  const deleteMedicalRecord = useAppStore((s) => s.deleteMedicalRecord);
  const deleteLabTest = useAppStore((s) => s.deleteLabTest);
  const deleteRadiologyOrder = useAppStore((s) => s.deleteRadiologyOrder);
  const settings = useAppStore((s) => s.settings);
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<MedicalRecord | null>(null);
  const [viewRecord, setViewRecord] = useState<MedicalRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MedicalRecord | null>(null);
  const [viewDoc, setViewDoc] = useState<ReportDoc | null>(null);
  const viewDownloadRef = useRef<(() => void) | null>(null);

  const openStyledPreview = (r: MedicalRecord) => {
    const patient = branchData.patients.find((p) => p.id === r.patientId || p.name === r.patientName);
    if (r.id.startsWith("lab-")) {
      const test = branchData.labTests.find((t) => t.id === r.id.replace(/^lab-/, ""));
      if (test) {
        setViewDoc(buildLabReportHtml(test, patient, settings));
        viewDownloadRef.current = () => handleDownload(r);
        return;
      }
    }
    if (r.id.startsWith("rad-")) {
      const order = branchData.radiologyOrders.find((o) => o.id === r.id.replace(/^rad-/, ""));
      if (order) {
        setViewDoc(buildRadiologyReportHtml(order, patient, settings));
        viewDownloadRef.current = () => handleDownload(r);
        return;
      }
    }
    setViewDoc(buildMedicalRecordHtml(r, patient, settings));
    viewDownloadRef.current = () => handleDownload(r);
  };
  const showAdd = canAddAnything(currentUser.role);
  const showEdit = canEditModule(currentUser.role, "records");
  const showDelete = canDeleteModule(currentUser.role, "records");

  const labRecords: MedicalRecord[] = branchData.labTests.map((test) => ({
    id: `lab-${test.id}`,
    patientId: test.patientId,
    patientName: test.patientName,
    type: "Lab Report",
    title: test.test,
    notes: [
      test.result || `Status: ${test.status}${test.price ? ` • ₹${test.price.toLocaleString("en-IN")}` : ""}`,
      test.findings ? `Findings: ${test.findings}` : "",
      test.problems ? `Problems: ${test.problems}` : "",
    ].filter(Boolean).join("\n"),
    doctor: test.orderedBy || "Laboratory",
    recordDate: (test.orderedOn || "").split(" ")[0],
    branch: test.branch,
    createdBy: test.orderedBy || "",
  }));
  const radiologyRecords: MedicalRecord[] = branchData.radiologyOrders.map((order) => ({
    id: `rad-${order.id}`,
    patientId: order.patientId,
    patientName: order.patientName,
    type: "Radiology Report",
    title: `${order.modality} — ${order.region}`,
    notes: [
      `Status: ${order.status}${order.price ? ` • ₹${order.price.toLocaleString("en-IN")}` : ""}`,
      order.findings ? `Findings: ${order.findings}` : "",
      order.problems ? `Problems: ${order.problems}` : "",
    ].filter(Boolean).join("\n"),
    doctor: order.orderedBy || "Radiology",
    recordDate: (order.orderedOn || "").split(" ")[0],
    branch: order.branch,
    createdBy: order.orderedBy || "",
  }));

  const branchMedicalRecords = medicalRecords.filter((r) => sameBranch(r.branch, branchData.branch));
  const allRecords = [...branchMedicalRecords, ...labRecords, ...radiologyRecords];
  const filtered = allRecords.filter((r) =>
    r.patientName.toLowerCase().includes(search.toLowerCase()) ||
    r.type.toLowerCase().includes(search.toLowerCase()) ||
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.doctor.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.id.startsWith("lab-")) {
        const realId = deleteTarget.id.replace(/^lab-/, "");
        const res = await fetch("/api/lab-tests", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: realId }) });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
        deleteLabTest(realId);
      } else if (deleteTarget.id.startsWith("rad-")) {
        const realId = deleteTarget.id.replace(/^rad-/, "");
        const res = await fetch("/api/radiology-orders", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: realId }) });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
        deleteRadiologyOrder(realId);
      } else {
        const res = await fetch("/api/medical-records", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
        if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || "Failed to delete."); }
        deleteMedicalRecord(deleteTarget.id);
      }
      toast({ title: "Record Deleted", description: `${deleteTarget.type} for ${deleteTarget.patientName} removed.` });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
      setDeleteTarget(null);
    }
  };

  const handleDownload = (r: MedicalRecord) => {
    const patient = branchData.patients.find((p) => p.id === r.patientId || p.name === r.patientName);
    if (!printMedicalRecord(r, patient, settings)) {
      toast({ title: "Pop-up blocked", description: "Allow pop-ups for this site to download the record.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Medical Records"
        description="Centralized repository of all patient medical documents"
        icon={FolderOpen}
        action={showAdd ? <Button size="sm" className="gap-1.5 sm:gap-2 text-xs sm:text-sm" onClick={() => setAddOpen(true)}><Plus className="h-3 w-3 sm:h-3.5 sm:w-3.5" /> Add Record</Button> : undefined}
      />

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title="Total Records" value={allRecords.length.toString()} icon={FolderOpen} color="primary" />
        <StatCard title="Prescriptions" value={allRecords.filter(r => r.type === "Prescription").length.toString()} icon={FileText} color="info" />
        <StatCard title="Lab Reports" value={allRecords.filter(r => r.type === "Lab Report").length.toString()} icon={FileText} color="success" />
        <StatCard title="Radiology" value={allRecords.filter(r => r.type === "Radiology" || r.type === "Radiology Report").length.toString()} icon={FileText} color="warning" />
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by patient, type, doctor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
              <p>No records yet.</p>
              <p className="text-xs mt-1">Add a record, or create lab/radiology orders to auto-generate reports here.</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((r) => (
                <div key={r.id} className="group flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/40 transition-colors cursor-pointer" onClick={() => setViewRecord(r)}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title || r.type}</p>
                    <p className="text-xs text-muted-foreground truncate">{r.patientName}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{r.doctor} • {r.recordDate}</p>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openStyledPreview(r)} title="View styled report (no download needed)"><Eye className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(r)} title="Download"><Download className="h-3.5 w-3.5" /></Button>
                    {showEdit && !r.id.startsWith("lab-") && !r.id.startsWith("rad-") && <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditRecord(r)} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>}
                    {showDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(r)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <AddRecordDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditRecordDialog open={!!editRecord} onOpenChange={(v) => { if (!v) setEditRecord(null); }} record={editRecord} />
      <ViewRecordDialog record={viewRecord} onOpenChange={(v) => { if (!v) setViewRecord(null); }} />
      <ReportViewerDialog doc={viewDoc} onOpenChange={(v) => { if (!v) { setViewDoc(null); viewDownloadRef.current = null; } }} onDownload={() => viewDownloadRef.current?.()} />
      {deleteTarget && <DeleteRecordDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }} record={deleteTarget} onConfirm={handleDelete} />}
    </div>
  );
}
