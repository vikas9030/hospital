import { create } from "zustand";
import type { ModuleKey, Role } from "@/lib/types";

interface AppState {
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

  // Auth (mock)
  currentUser: {
    name: string;
    role: Role;
    email: string;
    avatar: string;
  };

  // Actions
  setActiveModule: (module: ModuleKey) => void;
  selectPatient: (patientId: string | null) => void;
  selectDoctor: (doctorId: string | null) => void;
  toggleSidebar: () => void;
  setMobileSidebar: (open: boolean) => void;
  setGlobalSearch: (open: boolean) => void;
  toggleTheme: () => void;
  setActiveBranch: (branch: string) => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: "dashboard",
  selectedPatientId: null,
  selectedDoctorId: null,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  globalSearchOpen: false,

  theme: "light",

  activeBranch: "MediCore Main Campus",

  currentUser: {
    name: "Dr. Aditya Sharma",
    role: "Hospital Admin",
    email: "aditya.sharma@medicore.com",
    avatar: "AS",
  },

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
