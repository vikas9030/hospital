import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { secureStorage } from "@/lib/secure-storage";
import type { ModuleKey, Role, Patient, Doctor, StaffMember, InventoryItem, Branch, Department, Medicine, LabTest, RadiologyOrder, Bed, Invoice, Appointment, InsuranceClaim, Lead, Campaign, Notification, DoctorBranchSchedule, AppointmentReminder, RecurringSchedule, MedicalRecord, MedicineAlert } from "@/lib/types";
import { isAdmin, generateStaffId, getDefaultModuleForRole, sameBranch, isDoctorLikeRole } from "@/lib/utils";
import { setCustomRoleMatrices } from "@/lib/role-matrix";
import { setSystemRoleMatrices } from "@/lib/role-matrix";
import { buildSystemMatrices, isRoleDeleted } from "@/lib/system-roles";
import { moduleConfig } from "@/lib/modules";

// Custom roles persist to Supabase app_settings so they work on every
// device; the permission registry syncs alongside for live enforcement.
function persistRoleDefinitions(defs: RoleDefinition[]): void {
  try {
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "roleDefinitions", value: JSON.stringify(defs) }),
    }).catch(() => {});
  } catch { /* offline */ }
}

export function syncRoleMatrix(defs: RoleDefinition[]): void {
  setCustomRoleMatrices(defs.map((d) => ({ name: d.name, matrix: d.matrix ?? null, isActive: d.isActive })));
}

interface User {
  name: string;
  role: Role;
  email: string;
  avatar: string;
  branch?: string;
  branchId?: string;
  password: string;
  mustChangePassword?: boolean;
  staffId?: string;
}

export interface RoleDefinition {
  id: string;
  name: string;
  branch: string;
  branchId: string;
  description: string;
  permissions: string[];
  /** Per-module view/add/edit/del matrix that actually enforces access. */
  matrix?: import("@/lib/role-matrix").RoleMatrix | null;
  template?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorEmail: string;
  action: string;
  target?: string;
  branch: string;
  details: string;
  ip?: string;
}

interface AppState {
  isAuthenticated: boolean;
  authMode: "login" | "otp" | "forgot" | "mfa" | "setup";
  currentUser: User;
  adminExists: () => boolean;

  deleteAllData: () => void;
  createAdmin: (name: string, email: string, password: string, branchId?: string) => void;
  activeModule: ModuleKey;
  selectedPatientId: string | null;
  selectedDoctorId: string | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  globalSearchOpen: boolean;

  theme: "light" | "dark";

  activeBranch: string;

  patients: Patient[];
  addPatient: (patient: Patient) => void;
  updatePatient: (id: string, updates: Partial<Patient>) => void;
  deletePatient: (id: string) => void;
  getPatientsForActiveBranch: () => Patient[];

  doctors: Doctor[];
  addDoctor: (doctor: Doctor) => void;
  updateDoctor: (id: string, updates: Partial<Doctor>) => void;
  deleteDoctor: (id: string) => void;
  syncDoctorFromStaff: (staff: StaffMember) => void;
  removeDoctorByStaff: (staff: { email: string; name: string }) => void;

  staffMembers: StaffMember[];
  addStaffMember: (staff: StaffMember) => void;
  updateStaffMember: (id: string, updates: Partial<StaffMember>) => void;
  deleteStaffMember: (id: string) => void;

  inventoryItems: InventoryItem[];
  addInventoryItem: (item: InventoryItem) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  deleteInventoryItem: (id: string) => void;

  branches: Branch[];
  addBranch: (branch: Branch) => void;
  updateBranch: (id: string, updates: Partial<Branch>) => void;
  deleteBranch: (id: string) => void;

  departments: Department[];
  setDepartments: (departments: Department[]) => void;
  addDepartment: (department: Department) => void;
  updateDepartment: (id: string, updates: Partial<Department>) => void;
  deleteDepartment: (id: string) => void;

  medicines: Medicine[];
  addMedicine: (medicine: Medicine) => void;
  updateMedicine: (id: string, updates: Partial<Medicine>) => void;
  deleteMedicine: (id: string) => void;

  labTests: LabTest[];
  addLabTest: (test: LabTest) => void;
  updateLabTest: (id: string, updates: Partial<LabTest>) => void;
  deleteLabTest: (id: string) => void;

  radiologyOrders: RadiologyOrder[];
  addRadiologyOrder: (order: RadiologyOrder) => void;
  updateRadiologyOrder: (id: string, updates: Partial<RadiologyOrder>) => void;
  deleteRadiologyOrder: (id: string) => void;

  medicalRecords: MedicalRecord[];
  addMedicalRecord: (record: MedicalRecord) => void;
  updateMedicalRecord: (id: string, updates: Partial<MedicalRecord>) => void;
  deleteMedicalRecord: (id: string) => void;

  beds: Bed[];
  addBed: (bed: Bed) => void;
  updateBed: (id: string, updates: Partial<Bed>) => void;
  deleteBed: (id: string) => void;

  invoices: Invoice[];
  addInvoice: (invoice: Invoice) => void;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;

  appointments: Appointment[];
  addAppointment: (appointment: Appointment) => void;
  updateAppointment: (id: string, updates: Partial<Appointment>) => void;
  deleteAppointment: (id: string) => void;

  insuranceClaims: InsuranceClaim[];
  addInsuranceClaim: (claim: InsuranceClaim) => void;
  updateInsuranceClaim: (id: string, updates: Partial<InsuranceClaim>) => void;
  deleteInsuranceClaim: (id: string) => void;

  leads: Lead[];
  addLead: (lead: Lead) => void;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;

  campaigns: Campaign[];
  addCampaign: (campaign: Campaign) => void;
  updateCampaign: (id: string, updates: Partial<Campaign>) => void;
  deleteCampaign: (id: string) => void;

  notifications: Notification[];
  addNotification: (notification: Notification) => void;
  refreshNotifications: () => Promise<void>;
  updateNotification: (id: string, updates: Partial<Notification>) => void;
  deleteNotification: (id: string) => void;
  /** Backend-synced pharmacy alerts (near-expiry + low/out-of-stock). */
  medicineAlerts: MedicineAlert[];
  refreshMedicineAlerts: () => Promise<void>;
  acknowledgeMedicineAlert: (id: string) => void;

  appointmentReminders: AppointmentReminder[];
  addAppointmentReminder: (reminder: AppointmentReminder) => void;
  generateReminders: (minutesBefore?: number) => void;
  createRecurringAppointments: (baseAppointment: Appointment, schedule: RecurringSchedule) => Appointment[];

  settings: Record<string, string>;
  setAppSetting: (key: string, value: string) => Promise<{ ok: boolean; error?: string }>;

  doctorSchedules: DoctorBranchSchedule[];
  setDoctorSchedules: (schedules: DoctorBranchSchedule[]) => void;

  patientFilterDoctor: string | null;
  setPatientFilterDoctor: (name: string | null) => void;

  users: User[];
  addUser: (user: User) => void;
  refreshUsers: () => Promise<void>;
  upsertDoctorByEmail: (doctor: Doctor) => void;
  deleteUser: (email: string) => void;
  changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  adminResetPassword: (actorEmail: string, targetEmail: string, newPassword: string, adminPassword: string) => Promise<{ success: boolean; error?: string }>;
  authenticateUser: (email: string, password: string, branch: string) => { success: boolean; error?: string; user?: User };

  roleDefinitions: RoleDefinition[];
  addRoleDefinition: (role: RoleDefinition) => void;
  updateRoleDefinition: (id: string, updates: Partial<RoleDefinition>) => void;
  deleteRoleDefinition: (id: string) => void;

  auditLogs: AuditLogEntry[];
  addAuditLog: (entry: Omit<AuditLogEntry, "id" | "timestamp">) => void;
  clearAuditLogs: () => void;
  getAuditLogsForBranch: () => AuditLogEntry[];

  login: (user?: Partial<User>) => void;
  logout: () => void;
  setAuthMode: (mode: "login" | "otp" | "forgot" | "mfa") => void;
  setActiveModule: (module: ModuleKey) => void;
  selectPatient: (patientId: string | null) => void;
  selectDoctor: (doctorId: string | null) => void;
  toggleSidebar: () => void;
  setMobileSidebar: (open: boolean) => void;
  setGlobalSearch: (open: boolean) => void;
  toggleTheme: () => void;
  setActiveBranch: (branch: string) => void;
  loadFromSupabase: () => Promise<void>;
}

const emptyUser: User = {
  name: "",
  role: "" as Role,
  email: "",
  avatar: "",
  password: "",
  mustChangePassword: false,
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isAuthenticated: false,
      authMode: "login" as const,

      activeModule: "dashboard" as ModuleKey,
      selectedPatientId: null,
      selectedDoctorId: null,
      sidebarCollapsed: false,
      mobileSidebarOpen: false,
      globalSearchOpen: false,

      theme: "light" as const,

      activeBranch: "",

      patients: [],
      doctors: [],
      staffMembers: [],
      inventoryItems: [],
      branches: [],
      departments: [],
      medicines: [],
      labTests: [],
      radiologyOrders: [],
      medicalRecords: [],
      beds: [],
      invoices: [],
      appointments: [],
      insuranceClaims: [],
      leads: [],
      campaigns: [],
      notifications: [],
      appointmentReminders: [],
      medicineAlerts: [],

      settings: { opExpiryDays: "30" },

      setAppSetting: async (key, value) => {
        const prev = get().settings[key];
        set((s) => ({ settings: { ...s.settings, [key]: value } }));
        try {
          const res = await fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "Failed to save setting.");
          }
          return { ok: true as const };
        } catch (e: any) {
          // Revert the optimistic update so the UI never shows unsaved
          // values as saved (e.g. missing app_settings table).
          set((s) => (s.settings[key] === value ? { settings: { ...s.settings, [key]: prev ?? "" } } : s));
          return { ok: false as const, error: e?.message || "Failed to save setting." };
        }
      },

      doctorSchedules: [],

      setDoctorSchedules: (schedules) => set({ doctorSchedules: schedules }),

      patientFilterDoctor: null,

      setPatientFilterDoctor: (name) => set({ patientFilterDoctor: name }),

      users: [],

      roleDefinitions: [],

      auditLogs: [],

      currentUser: emptyUser,

      adminExists: () => {
        return get().users.some((u) => isAdmin(u.role));
      },

      deleteAllData: () => {
        set({
          isAuthenticated: false,
          authMode: "setup" as const,
          activeModule: "dashboard" as ModuleKey,
          selectedPatientId: null,
          selectedDoctorId: null,
          currentUser: {
            name: "",
            role: "" as Role,
            email: "",
            avatar: "",
            password: "",
            mustChangePassword: false,
          },
          activeBranch: "",
          patients: [],
          doctors: [],
          staffMembers: [],
          inventoryItems: [],
          branches: [],
          departments: [],
          medicines: [],
          labTests: [],
          radiologyOrders: [],
          medicalRecords: [],
          beds: [],
          invoices: [],
          appointments: [],
          insuranceClaims: [],
          leads: [],
          campaigns: [],
          notifications: [],
          appointmentReminders: [],
          medicineAlerts: [],
          users: [],
          roleDefinitions: [],
          auditLogs: [],
        });
      },

      createAdmin: (name, email, password, branchId = `br${Date.now()}`) => {
        const staffId = generateStaffId();
        const id = branchId;
        const branchName = "Main Branch";
        const state = get();
        set({
          users: [
            ...state.users,
            {
              name,
              role: "Admin" as Role,
              email,
              avatar: name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase(),
              branch: branchName,
              branchId: id,
              password,
              mustChangePassword: false,
              staffId,
            },
          ],
          branches: [
            ...state.branches,
            {
              id,
              name: branchName,
              location: "Headquarters",
              patients: 0,
              revenue: 0,
              staff: 1,
              status: "Active" as const,
            },
          ],
          activeBranch: branchName,
          authMode: "login" as const,
        });
      },

      login: (user) =>
        set((s) => {
          const updatedUser = user ? { ...s.currentUser, ...user } : s.currentUser;
          const defaultModule = getDefaultModuleForRole(updatedUser.role) as ModuleKey;
          return {
            isAuthenticated: true,
            authMode: "login" as const,
            currentUser: updatedUser,
            activeBranch: user?.branch || s.activeBranch,
            activeModule: defaultModule,
            // Doctors land on their own patients: the Patients module filters
            // to their name, with full profiles (visits, bills, documents).
            patientFilterDoctor: isDoctorLikeRole(updatedUser.role) && updatedUser.name ? updatedUser.name : null,
          };
        }),
      logout: () => {
        const s = get();
        if (s.isAuthenticated && s.currentUser?.email) {
          get().addAuditLog({
            actor: s.currentUser.name,
            actorEmail: s.currentUser.email,
            action: "SESSION_LOGOUT",
            branch: s.currentUser.branch || "",
            details: `${s.currentUser.name} signed out.`,
          });
        }
        set({ isAuthenticated: false, authMode: "login" as const, activeModule: "dashboard" as ModuleKey, selectedPatientId: null, selectedDoctorId: null, patientFilterDoctor: null });
      },
      setAuthMode: (mode) => set({ authMode: mode }),
      setActiveModule: (module) =>
        set({ activeModule: module, mobileSidebarOpen: false }),
      selectPatient: (patientId) => set({ selectedPatientId: patientId }),
      selectDoctor: (doctorId) => set({ selectedDoctorId: doctorId }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setMobileSidebar: (open) => set({ mobileSidebarOpen: open }),
      setGlobalSearch: (open) => set({ globalSearchOpen: open }),
      toggleTheme: () =>
        set((s) => {
          const newTheme = s.theme === "light" ? "dark" : "light";
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("dark", newTheme === "dark");
          }
          return { theme: newTheme };
        }),
      setActiveBranch: (branch) => set({ activeBranch: branch }),

      addPatient: (patient) => set((s) => ({ patients: [patient, ...s.patients] })),
      updatePatient: (id, updates) => set((s) => ({
        patients: s.patients.map((p) => p.id === id ? { ...p, ...updates } : p),
      })),
      deletePatient: (id) => set((s) => ({
        patients: s.patients.filter((p) => p.id !== id),
      })),

      addDoctor: (doctor) => set((s) => ({ doctors: [...s.doctors, doctor] })),
      updateDoctor: (id, updates) => set((s) => ({
        doctors: s.doctors.map((d) => d.id === id ? { ...d, ...updates } : d),
      })),
      deleteDoctor: (id) => set((s) => ({
        doctors: s.doctors.filter((d) => d.id !== id),
      })),
      syncDoctorFromStaff: (staff) => set((s) => {
        const existingDoctor = s.doctors.find((d) => d.email === staff.email || d.name === staff.name);
        if (existingDoctor) {
          return {
            doctors: s.doctors.map((d) =>
              d.id === existingDoctor.id ? {
                ...d, name: staff.name, phone: staff.phone, email: staff.email,
                department: staff.department || d.department,
                specialization: staff.department || d.specialization,
                consultationFee: staff.consultationFee ?? d.consultationFee,
                availableDays: staff.availableDays ?? d.availableDays,
                availableFrom: staff.availableFrom ?? d.availableFrom,
                availableTo: staff.availableTo ?? d.availableTo,
                shift: staff.shift || d.shift,
                branch: staff.branch,
              } : d
            ),
          };
        }
        return {
          doctors: [...s.doctors, {
            id: `d${Date.now()}`,
            name: staff.name,
            photo: staff.name.split(" ").map((n: string) => n[0]).slice(0, 2).join(""),
            specialization: staff.department || "General Medicine",
            department: staff.department || "General Medicine",
            experience: 0,
            qualification: "",
            phone: staff.phone,
            email: staff.email,
            availability: "Available" as const,
            rating: 0,
            consultationFee: staff.consultationFee ?? 0,
            todayAppointments: 0,
            patientsTreated: 0,
            branch: staff.branch,
          }],
        };
      }),
      removeDoctorByStaff: (staff) => set((s) => {
        const doctorMatch = s.doctors.find((d) => d.email === staff.email || d.name === staff.name);
        if (!doctorMatch) return {};
        return { doctors: s.doctors.filter((d) => d.id !== doctorMatch.id) };
      }),

      addStaffMember: (staff) => set((s) => ({ staffMembers: [...s.staffMembers, staff] })),
      updateStaffMember: (id, updates) => set((s) => ({
        staffMembers: s.staffMembers.map((st) => st.id === id ? { ...st, ...updates } : st),
      })),
      deleteStaffMember: (id) => set((s) => ({
        staffMembers: s.staffMembers.filter((st) => st.id !== id),
      })),

      addInventoryItem: (item) => set((s) => ({ inventoryItems: [...s.inventoryItems, item] })),
      updateInventoryItem: (id, updates) => set((s) => ({
        inventoryItems: s.inventoryItems.map((i) => i.id === id ? { ...i, ...updates } : i),
      })),
      deleteInventoryItem: (id) => set((s) => ({
        inventoryItems: s.inventoryItems.filter((i) => i.id !== id),
      })),

      addMedicine: (medicine) => set((s) => ({ medicines: [...s.medicines, medicine] })),
      updateMedicine: (id, updates) => set((s) => ({
        medicines: s.medicines.map((m) => m.id === id ? { ...m, ...updates } : m),
      })),
      deleteMedicine: (id) => set((s) => ({
        medicines: s.medicines.filter((m) => m.id !== id),
      })),

      addLabTest: (test) => set((s) => ({ labTests: [...s.labTests, test] })),
      updateLabTest: (id, updates) => set((s) => ({
        labTests: s.labTests.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      deleteLabTest: (id) => set((s) => ({
        labTests: s.labTests.filter((t) => t.id !== id),
      })),

      addRadiologyOrder: (order) => set((s) => ({ radiologyOrders: [...s.radiologyOrders, order] })),
      updateRadiologyOrder: (id, updates) => set((s) => ({
        radiologyOrders: s.radiologyOrders.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),
      deleteRadiologyOrder: (id) => set((s) => ({
        radiologyOrders: s.radiologyOrders.filter((r) => r.id !== id),
      })),

      addMedicalRecord: (record) => set((s) => ({ medicalRecords: [record, ...s.medicalRecords] })),
      updateMedicalRecord: (id, updates) => set((s) => ({
        medicalRecords: s.medicalRecords.map((r) => r.id === id ? { ...r, ...updates } : r),
      })),
      deleteMedicalRecord: (id) => set((s) => ({
        medicalRecords: s.medicalRecords.filter((r) => r.id !== id),
      })),

      addBed: (bed) => set((s) => ({ beds: [...s.beds, bed] })),
      updateBed: (id, updates) => set((s) => ({
        beds: s.beds.map((b) => b.id === id ? { ...b, ...updates } : b),
      })),
      deleteBed: (id) => set((s) => ({
        beds: s.beds.filter((b) => b.id !== id),
      })),

      addInvoice: (invoice) => set((s) => ({ invoices: [...s.invoices, invoice] })),
      updateInvoice: (id, updates) => set((s) => ({
        invoices: s.invoices.map((i) => i.id === id ? { ...i, ...updates } : i),
      })),
      deleteInvoice: (id) => set((s) => ({
        invoices: s.invoices.filter((i) => i.id !== id),
      })),

      addAppointment: (appointment) => set((s) => ({ appointments: [...s.appointments, appointment] })),
      updateAppointment: (id, updates) => set((s) => ({
        appointments: s.appointments.map((a) => a.id === id ? { ...a, ...updates } : a),
      })),
      deleteAppointment: (id) => set((s) => ({
        appointments: s.appointments.filter((a) => a.id !== id),
      })),

      addInsuranceClaim: (claim) => set((s) => ({ insuranceClaims: [...s.insuranceClaims, claim] })),
      updateInsuranceClaim: (id, updates) => set((s) => ({
        insuranceClaims: s.insuranceClaims.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      deleteInsuranceClaim: (id) => set((s) => ({
        insuranceClaims: s.insuranceClaims.filter((c) => c.id !== id),
      })),

      addLead: (lead) => set((s) => ({ leads: [...s.leads, lead] })),
      updateLead: (id, updates) => set((s) => ({
        leads: s.leads.map((l) => l.id === id ? { ...l, ...updates } : l),
      })),
      deleteLead: (id) => set((s) => ({
        leads: s.leads.filter((l) => l.id !== id),
      })),

      addCampaign: (campaign) => set((s) => ({ campaigns: [...s.campaigns, campaign] })),
      updateCampaign: (id, updates) => set((s) => ({
        campaigns: s.campaigns.map((c) => c.id === id ? { ...c, ...updates } : c),
      })),
      deleteCampaign: (id) => set((s) => ({
        campaigns: s.campaigns.filter((c) => c.id !== id),
      })),

      addNotification: (notification) => set((s) => ({ notifications: [...s.notifications, notification] })),

      // Re-pull notifications from Supabase (branch-scoped) and merge,
      // DB wins per id. Used by the header poller for live alerts.
      refreshNotifications: async () => {
        try {
          const branch = get().activeBranch;
          const res = await fetch(`/api/notifications${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`);
          if (!res.ok) return;
          const fresh = await res.json();
          if (!Array.isArray(fresh)) return;
          set((s) => {
            const byId = new Map<string, Notification>();
            for (const n of fresh) byId.set(n.id, n);
            for (const n of s.notifications) if (!byId.has(n.id)) byId.set(n.id, n);
            return { notifications: Array.from(byId.values()) };
          });
        } catch {
          // Offline: keep cached notifications.
        }
      },
      updateNotification: (id, updates) => set((s) => ({
        notifications: s.notifications.map((n) => n.id === id ? { ...n, ...updates } : n),
      })),
        deleteNotification: (id) => set((s) => ({
          notifications: s.notifications.filter((n) => n.id !== id),
        })),
        // Re-pull pharmacy alerts from Supabase (branch-scoped); DB wins.
        refreshMedicineAlerts: async () => {
          try {
            const branch = get().activeBranch;
            const res = await fetch(`/api/medicine-alerts${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`);
            if (!res.ok) return;
            const fresh = await res.json();
            if (!Array.isArray(fresh)) return;
            set({ medicineAlerts: fresh });
          } catch {
            // Offline: keep cached alerts.
          }
        },
        acknowledgeMedicineAlert: (id) => {
          set((s) => ({
            medicineAlerts: s.medicineAlerts.map((a) => (a.id === id ? { ...a, status: "acknowledged" as const } : a)),
          }));
          try {
            fetch("/api/medicine-alerts", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id }),
            }).catch(() => {});
          } catch { /* offline */ }
        },

      // Persisted to Supabase (appointment_reminders table); local update is
      // optimistic and the backend write is fire-and-forget.
      addAppointmentReminder: (reminder) => {
        set((s) => ({ appointmentReminders: [...s.appointmentReminders, reminder] }));
        try {
          fetch("/api/appointment-reminders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reminder),
          }).catch(() => {});
        } catch { /* offline: local reminder retained */ }
      },
      generateReminders: (minutesBefore = 30) => {
        const state = get();
        const now = new Date();
        const reminderTime = new Date(now.getTime() + minutesBefore * 60000);
        const todayStr = now.toISOString().split("T")[0];
        const reminders: AppointmentReminder[] = [];
        const notifications: Notification[] = [];
        for (const apt of state.appointments) {
          if (apt.status !== "Scheduled" && apt.status !== "Follow Up") continue;
          if (apt.date !== todayStr) continue;
          if (apt.reminderSent) continue;
          const aptTime = new Date(`${apt.date}T${apt.time}:00`);
          if (aptTime > reminderTime) continue;
          const patient = state.patients.find((p) => p.id === apt.patientId);
          const reminder: AppointmentReminder = {
            id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            appointmentId: apt.id,
            patientId: apt.patientId,
            patientName: apt.patientName,
            patientPhone: patient?.phone || "",
            doctorName: apt.doctorName,
            department: apt.department,
            appointmentDate: apt.date,
            appointmentTime: apt.time,
            minutesBefore: minutesBefore,
            sentAt: now.toISOString(),
            method: "push",
            status: "sent",
            branch: apt.branch,
          };
          reminders.push(reminder);
          notifications.push({
            id: `n-rem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            type: "reminder",
            title: "Appointment Reminder",
            message: `${apt.patientName} has an appointment with ${apt.doctorName} at ${apt.time} today (${apt.department})${apt.recurrence ? ` — Recurring ${apt.recurrence.frequency}x/${apt.recurrence.period}` : ""}`,
            time: "Just now",
            read: false,
            priority: "high",
            branch: apt.branch,
          });
          apt.reminderSent = true;
        }
        if (reminders.length > 0) {
          set((s) => ({
            appointmentReminders: [...s.appointmentReminders, ...reminders],
            notifications: [...notifications, ...s.notifications],
          }));
          // Persist every generated reminder to Supabase (fire-and-forget).
          for (const r of reminders) {
            try {
              fetch("/api/appointment-reminders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(r),
              }).catch(() => {});
            } catch { /* offline */ }
          }
        }
      },
      createRecurringAppointments: (baseAppointment, schedule) => {
        const results: Appointment[] = [];
        const { frequency, period, totalOccurrences, startDate } = schedule;
        const baseDate = new Date(startDate);
        for (let i = 0; i < totalOccurrences; i++) {
          const occurrenceDate = new Date(baseDate);
          if (period === "month") {
            occurrenceDate.setMonth(occurrenceDate.getMonth() + i);
          } else {
            occurrenceDate.setDate(occurrenceDate.getDate() + i * 7);
          }
          const apt: Appointment = {
            ...baseAppointment,
            id: `a${Date.now()}-${i}`,
            token: "",
            date: occurrenceDate.toISOString().split("T")[0],
            status: "Scheduled",
            recurrence: { ...schedule, completedOccurrences: 0 },
            reminderSent: false,
          };
          results.push(apt);
        }
        const spacing = period === "month" ? Math.floor(30 / frequency) : Math.floor(7 / frequency);
        const spaced: Appointment[] = [];
        for (let i = 0; i < totalOccurrences; i++) {
          const d = new Date(startDate);
          if (period === "month") {
            d.setDate(d.getDate() + i * spacing);
          } else {
            d.setDate(d.getDate() + i * spacing);
          }
          if (d >= new Date(startDate)) {
            spaced.push({
              ...baseAppointment,
              id: `a${Date.now()}-r${i}`,
              token: "",
              date: d.toISOString().split("T")[0],
              status: "Scheduled",
              recurrence: { ...schedule, completedOccurrences: 0 },
              reminderSent: false,
            });
          }
        }
        return spaced.length > 0 ? spaced : results;
      },

      addBranch: (branch) => set((s) => ({ branches: [...s.branches, branch] })),
      updateBranch: (id, updates) => set((s) => ({
        branches: s.branches.map((b) => b.id === id ? { ...b, ...updates } : b),
      })),
      deleteBranch: (id) => set((s) => ({
        branches: s.branches.filter((b) => b.id !== id),
      })),

      setDepartments: (departments) => set({ departments }),
      addDepartment: (department) => set((s) => ({ departments: [...s.departments, department] })),
      updateDepartment: (id, updates) => set((s) => ({
        departments: s.departments.map((d) => d.id === id ? { ...d, ...updates } : d),
      })),
      deleteDepartment: (id) => set((s) => ({
        departments: s.departments.filter((d) => d.id !== id),
      })),

      getPatientsForActiveBranch: () => {
        const state = get();
        if (isAdmin(state.currentUser.role)) {
          return state.patients.filter((p) => sameBranch(p.branch, state.activeBranch));
        }
        return state.patients.filter((p) => sameBranch(p.branch, state.currentUser.branch));
      },

      addUser: (user) => set((s) => ({ users: [...s.users, user] })),

      upsertDoctorByEmail: (doctor) => set((s) => {
        const idx = s.doctors.findIndex((d) =>
          (doctor.email && d.email === doctor.email) || d.name === doctor.name
        );
        if (idx === -1) return { doctors: [...s.doctors, doctor] };
        return { doctors: s.doctors.map((d, i) => (i === idx ? { ...d, ...doctor, id: d.id } : d)) };
      }),

      // Pull login accounts from the database and merge (DB wins per email).
      // This lets staff sign in from any device, not just the browser where
      // the admin created their account.
      refreshUsers: async () => {
        try {
          const res = await fetch("/api/users");
          if (!res.ok) return;
          const dbUsers = await res.json();
          if (!Array.isArray(dbUsers)) return;
          set((s) => {
            const byEmail = new Map<string, User>();
            for (const u of dbUsers) byEmail.set(u.email, u);
            for (const u of s.users) if (!byEmail.has(u.email)) byEmail.set(u.email, u);
            return { users: Array.from(byEmail.values()) };
          });
        } catch {
          // Offline: keep locally cached accounts.
        }
      },
      deleteUser: (email) => set((s) => ({
        users: s.users.filter((u) => u.email !== email),
      })),

      // Persisted to Supabase (users + staff rows) so the new password works
      // on every device; local cache updates only after the backend confirms.
      changePassword: async (userId, currentPassword, newPassword) => {
        const user = get().users.find((u) => u.email === userId);
        if (!user || user.password !== currentPassword) return false;
        try {
          const userRes = await fetch("/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: userId, password: newPassword, mustChangePassword: false }),
          });
          if (!userRes.ok) return false;
          const staffRow = get().staffMembers.find((st) => st.email === userId);
          if (staffRow) {
            await fetch("/api/staff", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: staffRow.id, password: newPassword, mustChangePassword: false }),
            }).catch(() => {});
          }
        } catch {
          return false;
        }
        set((s) => ({
          users: s.users.map((u) =>
            u.email === userId ? { ...u, password: newPassword, mustChangePassword: false } : u
          ),
          staffMembers: s.staffMembers.map((st) =>
            st.email === userId ? { ...st, password: newPassword, mustChangePassword: false } : st
          ),
        }));
        return true;
      },

      authenticateUser: (email, password, branch) => {
        const state = get();
        const user = state.users.find((u) => u.email === email);
        if (!user) return { success: false, error: "User not found. Please check your email." };
        if (user.password !== password) return { success: false, error: "Incorrect password." };
        // Disabled system roles (Settings → Roles) cannot sign in.
        const slug = user.role.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
        if (user.role !== "Admin" && state.settings[`role_${slug}`] === "false") {
          return { success: false, error: `The ${user.role} role is disabled. Contact your administrator.` };
        }
        // Deleted system roles (Settings → Roles → Delete) cannot sign in.
        if (user.role !== "Admin" && isRoleDeleted(state.settings, user.role)) {
          return { success: false, error: `The ${user.role} role has been deleted. Contact your administrator.` };
        }
        // Admins are linked to all branches and may sign in without selecting one.
        if (isAdmin(user.role)) return { success: true, user };
        const selected = (branch ?? "").trim();
        // Staff must explicitly pick their branch at login — this pins every
        // record they create to the right branch in backend tables.
        if (!selected) {
          return { success: false, error: "Please select your branch to sign in." };
        }
        if (user.branch && !sameBranch(user.branch, selected)) {
          return { success: false, error: `This user is assigned to ${user.branch}. Please select that branch.` };
        }
        return { success: true, user };
      },

      adminResetPassword: async (actorEmail, targetEmail, newPassword, adminPassword) => {
        const state = get();
        const admin = state.users.find((u) => u.email === actorEmail);
        if (!admin) return { success: false, error: "Admin user not found." };
        if (!isAdmin(admin.role)) return { success: false, error: "Insufficient privileges." };
        if (admin.password !== adminPassword) return { success: false, error: "Admin password verification failed." };

        const target = state.users.find((u) => u.email === targetEmail);
        if (!target) return { success: false, error: "Target user not found." };

        // Persist to Supabase first so the new password works on every device.
        try {
          const userRes = await fetch("/api/users", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: targetEmail, password: newPassword, mustChangePassword: true }),
          });
          if (!userRes.ok) {
            const body = await userRes.json().catch(() => ({}));
            throw new Error(body.error || "Failed to save the new password.");
          }
          const staffRow = get().staffMembers.find((st) => st.email === targetEmail);
          if (staffRow) {
            await fetch("/api/staff", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id: staffRow.id, password: newPassword, mustChangePassword: true }),
            });
          }
        } catch (e: any) {
          return { success: false, error: e.message };
        }

        set((s) => ({
          users: s.users.map((u) =>
            u.email === targetEmail ? { ...u, password: newPassword, mustChangePassword: true } : u
          ),
        }));

        set((s) => ({
          staffMembers: s.staffMembers.map((st) =>
            st.email === targetEmail ? { ...st, password: newPassword, mustChangePassword: true } : st
          ),
        }));

        get().addAuditLog({
          actor: admin.name,
          actorEmail: admin.email,
          action: "ADMIN_PASSWORD_RESET",
          target: target.name,
          branch: admin.branch || "Unknown",
          details: `Admin ${admin.name} reset password for ${target.name} (${targetEmail}). User must change password on next login.`,
        });

        return { success: true };
      },

      addRoleDefinition: (role) => {
        set((s) => ({ roleDefinitions: [...s.roleDefinitions, role] }));
        persistRoleDefinitions(get().roleDefinitions);
      },
      updateRoleDefinition: (id, updates) => {
        set((s) => ({
          roleDefinitions: s.roleDefinitions.map((r) =>
            r.id === id ? { ...r, ...updates } : r
          ),
        }));
        persistRoleDefinitions(get().roleDefinitions);
      },
      deleteRoleDefinition: (id) => {
        set((s) => ({
          roleDefinitions: s.roleDefinitions.filter((r) => r.id !== id),
        }));
        persistRoleDefinitions(get().roleDefinitions);
      },

      addAuditLog: (entry) => {
        // Settings → Security → Audit Logging gates the local user-action log.
        if (get().settings["security_Audit_Logging"] === "false") return;
        const row = {
          ...entry,
          id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: new Date().toISOString(),
        };
        set((s) => ({ auditLogs: [row, ...s.auditLogs] }));
        // Persist to Supabase (append-only audit_logs table) so the trail
        // survives reloads and is visible on every device. Fire-and-forget:
        // the local entry stays even if the network write fails.
        try {
          fetch("/api/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actor: row.actor,
              actorEmail: row.actorEmail,
              action: row.action,
              target: row.target,
              branch: row.branch,
              details: row.details,
            }),
          }).catch(() => {});
        } catch { /* offline: local entry retained */ }
      },

      clearAuditLogs: () => set({ auditLogs: [] }),

      getAuditLogsForBranch: () => {
        const state = get();
        if (isAdmin(state.currentUser.role)) {
          return state.auditLogs.filter((l) => sameBranch(l.branch, state.activeBranch));
        }
        return state.auditLogs.filter((l) => sameBranch(l.branch, state.currentUser.branch));
      },

      loadFromSupabase: async () => {
        try {
          const endpoints = [
            ["branches", "branches"],
            ["departments", "departments"],
            ["patients", "patients"],
            ["doctors", "doctors"],
            ["appointments", "appointments"],
            ["beds", "beds"],
            ["invoices", "invoices"],
            ["medicines", "medicines"],
            ["lab-tests", "labTests"],
            ["radiology-orders", "radiologyOrders"],
            ["medical-records", "medicalRecords"],
            ["insurance-claims", "insuranceClaims"],
            ["leads", "leads"],
            ["campaigns", "campaigns"],
            ["staff", "staffMembers"],
            ["inventory", "inventoryItems"],
            ["notifications", "notifications"],
            ["appointment-reminders", "appointmentReminders"],
            ["medicine-alerts", "medicineAlerts"],
          ] as const;

          const results = await Promise.allSettled(
            endpoints.map(([ep]) => fetch(`/api/${ep}`).then((r) => r.json()))
          );

          const updates: Record<string, any[]> = {};
          results.forEach((result, i) => {
            const storeKey = endpoints[i][1];
            if (result.status === "fulfilled" && Array.isArray(result.value)) {
              updates[storeKey] = result.value;
            }
          });

          if (Object.keys(updates).length > 0) {
            set(updates as any);
          }

          // Keep login accounts fresh (merged, DB wins per email).
          await get().refreshUsers();

          // Merge the persisted audit trail (DB wins per id, newest first).
          try {
            const branch = get().activeBranch;
            const res = await fetch(`/api/audit${branch ? `?branch=${encodeURIComponent(branch)}` : ""}`);
            if (res.ok) {
              const rows = await res.json();
              if (Array.isArray(rows) && rows.length > 0) {
                set((s) => {
                  const byId = new Map<string, AuditLogEntry>();
                  for (const r of rows) byId.set(r.id, r);
                  for (const l of s.auditLogs) if (!byId.has(l.id)) byId.set(l.id, l);
                  return { auditLogs: Array.from(byId.values()).slice(0, 1000) };
                });
              }
            }
          } catch {
            // Audit API unavailable; keep local trail.
          }

          // Merge app settings from the database (DB wins per key).
          try {
            const res = await fetch("/api/settings");
            if (res.ok) {
              const dbSettings = await res.json();
              if (dbSettings && typeof dbSettings === "object" && !Array.isArray(dbSettings)) {
                set((s) => ({ settings: { ...s.settings, ...dbSettings } } as any));
                // Custom roles live in settings too — adopt them when present.
                const rawRoles = (dbSettings as Record<string, string>).roleDefinitions;
                if (rawRoles) {
                  try {
                    const parsed = JSON.parse(rawRoles);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                      set({ roleDefinitions: parsed } as any);
                    }
                  } catch { /* corrupt payload: keep local roles */ }
                }
              }
            }
          } catch {
            // Settings API unavailable; keep defaults.
          }
          syncRoleMatrix(get().roleDefinitions);
          setSystemRoleMatrices(buildSystemMatrices(get().settings, moduleConfig.map((m) => m.key)));

          // Per-branch doctor schedules.
          try {
            const res = await fetch("/api/doctor-schedules");
            if (res.ok) {
              const schedules = await res.json();
              if (Array.isArray(schedules)) {
                get().setDoctorSchedules(schedules);
              }
            }
          } catch {
            // Schedules API unavailable; keep local.
          }

          // Self-heal: every staff Doctor gets a real doctor profile row so
          // they appear in patient assignment, the portal, and schedules.
          // Matches tolerantly (email, or name ignoring case/"Dr." + branch)
          // to avoid creating the duplicates this used to cause.
          try {
            const st = get();
            const normName = (n: string) => n.trim().toLowerCase().replace(/^dr\.?\s+/, "");
            const normEmail = (e: string) => (e || "").trim().toLowerCase();
            for (const staff of st.staffMembers.filter((s) => isDoctorLikeRole(s.role) && s.status === "Active")) {
              const matched = st.doctors.some(
                (d) =>
                  (staff.email && normEmail(d.email) === normEmail(staff.email)) ||
                  (normName(d.name) === normName(staff.name) &&
                    (!d.branch || !staff.branch || d.branch.trim().toLowerCase() === staff.branch.trim().toLowerCase()))
              );
              if (matched) continue;
              try {
                const er = await fetch("/api/doctors/ensure", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    email: staff.email,
                    name: staff.name,
                    phone: staff.phone,
                    branch: staff.branch,
                    department: staff.department,
                    consultationFee: (staff as any).consultationFee ?? 0,
                    availableDays: (staff as any).availableDays ?? [],
                    shift: staff.shift || "",
                  }),
                });
                if (er.ok) get().upsertDoctorByEmail(await er.json());
              } catch {
                // One staff failing must not block the rest.
              }
            }
          } catch {
            // Doctor self-heal skipped.
          }

          // Auto-convert patient OP dates into real appointments (idempotent):
          // any patient with an OP date + assigned doctor but no appointment on
          // that date gets one, so the visit always appears in the calendar,
          // OPD queue, and appointments list. Staff-derived doctors are
          // materialized via /api/doctors/ensure to satisfy the foreign key.
          try {
            const pts = get().patients;
            const appts = get().appointments;
            const docs = get().doctors;
            const now = new Date();
            const today = now.toISOString().split("T")[0];
            const missing = pts.filter(
              (p) =>
                p.opDate &&
                p.doctorId &&
                p.status !== "Admitted" &&
                !appts.some((a) => a.patientId === p.id && a.date === p.opDate)
            );
            for (const p of missing) {
              try {
                let doctorId: string = p.doctorId || "";
                if (!doctorId) continue;
                if (doctorId.startsWith("d-staff-")) {
                  const pseudo = docs.find((d) => d.id === doctorId);
                  const email =
                    pseudo?.email ||
                    `${(p.doctorName || doctorId).toLowerCase().replace(/[^a-z0-9]+/g, ".")}@medicore.local`;
                  const er = await fetch("/api/doctors/ensure", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      email,
                      name: pseudo?.name || p.doctorName || "Doctor",
                      phone: pseudo?.phone,
                      branch: p.branch,
                      department: pseudo?.department,
                    }),
                  });
                  if (!er.ok) continue;
                  doctorId = (await er.json()).id;
                }
                const res = await fetch("/api/appointments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: `a${Date.now()}${Math.floor(Math.random() * 1000)}`,
                    token: "",
                    patientId: p.id,
                    patientName: p.name,
                    patientPhoto: p.photo,
                    doctorId,
                    doctorName: p.doctorName || "",
                    department: docs.find((d) => d.id === doctorId)?.department || "",
                    date: p.opDate,
                    time:
                      p.opDate === today
                        ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
                        : "09:00",
                    type: "Walk-in",
                    status: "Scheduled",
                    reason: "OPD Registration",
                    waitingTime: 0,
                    branch: p.branch,
                  }),
                });
                if (res.ok) {
                  get().addAppointment(await res.json());
                }
              } catch {
                // Skip this patient; retried on next sync.
              }
            }
          } catch {
            // Sync skipped.
          }

          // Merge login accounts from the database so staff created here or
          // elsewhere can authenticate. Local-only users are preserved; DB
          // wins for existing emails. Replacing outright would wipe demo
          // accounts when the users table is empty.
          try {
            const res = await fetch("/api/users");
            if (res.ok) {
              const dbUsers = await res.json();
              if (Array.isArray(dbUsers) && dbUsers.length > 0) {
                const byEmail = new Map<string, any>();
                for (const u of get().users) byEmail.set(u.email.toLowerCase(), u);
                for (const u of dbUsers) {
                  const key = String(u.email).toLowerCase();
                  const clean = Object.fromEntries(
                    Object.entries(u).filter(([, v]) => v !== undefined && v !== null)
                  );
                  byEmail.set(key, { ...byEmail.get(key), ...clean });
                }
                set({ users: Array.from(byEmail.values()) } as any);
              }
            }
          } catch {
            // Users API unavailable; keep local accounts only.
          }
        } catch (e) {
          console.error("Failed to load from Supabase:", e);
        }
      },
    }),
    {
      name: "medicore-store-v3",
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        currentUser: state.currentUser,
        activeBranch: state.activeBranch,
        activeModule: state.activeModule,
        theme: state.theme,
        selectedPatientId: state.selectedPatientId,
        selectedDoctorId: state.selectedDoctorId,
        patients: state.patients,
        doctors: state.doctors,
        // Oversized inline photos are re-fetched from Supabase on boot;
        // keeping them out of localStorage keeps refresh instant.
        staffMembers: state.staffMembers.map((s) => ({
          ...s,
          photo: s.photo && s.photo.length > 100000 ? "" : s.photo,
        })),
        inventoryItems: state.inventoryItems,
        branches: state.branches,
        departments: state.departments,
        roleDefinitions: state.roleDefinitions,
        users: state.users.map((u: any) => ({
          ...u,
          avatar: u.avatar && u.avatar.length > 100000 ? "" : u.avatar,
        })),
        auditLogs: state.auditLogs,
        medicines: state.medicines,
        labTests: state.labTests,
        radiologyOrders: state.radiologyOrders,
        medicalRecords: state.medicalRecords,
        beds: state.beds,
        invoices: state.invoices,
        appointments: state.appointments,
        insuranceClaims: state.insuranceClaims,
        leads: state.leads,
        campaigns: state.campaigns,
          notifications: state.notifications,
          appointmentReminders: state.appointmentReminders,
          medicineAlerts: state.medicineAlerts,
        }),
    }
  )
);
