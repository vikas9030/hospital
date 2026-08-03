import { create } from "zustand";
import type { ModuleKey, Role } from "@/lib/types";

interface User {
  name: string;
  role: Role;
  email: string;
  avatar: string;
}

interface AppState {
  // Auth
  isAuthenticated: boolean;
  authMode: "login" | "otp" | "forgot" | "mfa";
  currentUser: User;

  // Navigation
  activeModule: ModuleKey;
  selectedPatientId: string | null;
  selectedDoctorId: string | null;
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  globalSearchOpen: boolean;

  // Theme
  theme: "light" | "dark";

  // Branch
  activeBranch: string;

  // Actions
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
}

// Demo users for quick login
const demoUsers: Record<string, User> = {
  admin: { name: "Dr. Aditya Sharma", role: "Hospital Admin", email: "aditya.sharma@medicore.com", avatar: "AS" },
  doctor: { name: "Dr. Rajesh Kumar", role: "Doctor", email: "rajesh.kumar@medicore.com", avatar: "RK" },
  reception: { name: "Anita Kumar", role: "Receptionist", email: "anita.k@medicore.com", avatar: "AK" },
  nurse: { name: "Lakshmi Nair", role: "Nurse", email: "lakshmi.n@medicore.com", avatar: "LN" },
  pharmacist: { name: "Raj Patel", role: "Pharmacist", email: "raj.p@medicore.com", avatar: "RP" },
};

export const useAppStore = create<AppState>((set) => ({
  isAuthenticated: false,
  authMode: "login",

  activeModule: "dashboard",
  selectedPatientId: null,
  selectedDoctorId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  globalSearchOpen: false,

  theme: "light",

  activeBranch: "MediCore Main Campus",

  currentUser: demoUsers.admin,

  login: (user) =>
    set((s) => ({
      isAuthenticated: true,
      authMode: "login",
      currentUser: user ? { ...s.currentUser, ...user } : s.currentUser,
    })),
  logout: () => set({ isAuthenticated: false, authMode: "login", activeModule: "dashboard" }),
  setAuthMode: (mode) => set({ authMode: mode }),
  setActiveModule: (module) =>
    set({ activeModule: module, selectedPatientId: null, selectedDoctorId: null, mobileSidebarOpen: false }),
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
}));

export { demoUsers };
