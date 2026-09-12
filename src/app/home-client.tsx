"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useAppStore } from "@/store/app-store";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { MobileBottomNav } from "@/components/layout/mobile-nav";
import { syncRoleMatrix } from "@/store/app-store";
import { setSystemRoleMatrices } from "@/lib/role-matrix";
import { buildSystemMatrices } from "@/lib/system-roles";
import { moduleConfig } from "@/lib/modules";
import { LoginPanel } from "@/components/auth/login-panel";
import { SetupPanel } from "@/components/auth/setup-panel";
import { SessionGuard } from "@/components/auth/session-guard";
import { DashboardModule } from "@/components/modules/dashboard";
import { PatientsModule } from "@/components/modules/patients";
import { DoctorsModule } from "@/components/modules/doctors";
import { AppointmentsModule } from "@/components/modules/appointments";
import { OPDModule, IPDModule, BedsModule } from "@/components/modules/operations";
import { BillingModule } from "@/components/modules/billing";
import { PharmacyModule, LaboratoryModule, RadiologyModule } from "@/components/modules/clinical";
import { InsuranceModule, CRMModule, MarketingModule } from "@/components/modules/business";
import { ReportsModule, StaffModule, InventoryModule, SettingsModule, ReceptionModule, RecordsModule } from "@/components/modules/admin";
import { NursingModule } from "@/components/modules/nursing";
import { AccountsModule } from "@/components/modules/accounts";
import { AttendanceModule } from "@/components/modules/attendance";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";

// Rendered exclusively on the client (see page.tsx). Browser extensions that
// inject attributes into server HTML cannot cause hydration mismatches here.
export default function HomeClient() {
  const { activeModule, isAuthenticated, authMode } = useAppStore();
  const loadFromSupabase = useAppStore((s) => s.loadFromSupabase);
  const refreshUsers = useAppStore((s) => s.refreshUsers);
  const users = useAppStore((s) => s.users);
  const usersChecked = useAppStore((s) => s.usersChecked);
  const roleDefinitions = useAppStore((s) => s.roleDefinitions);
  const hasAdmin = users.some((u) => u.role === "Admin");
  const hydrated = useSyncExternalStore(
    (onStoreChange) => {
      const unsub = useAppStore.persist.onFinishHydration(onStoreChange);
      return () => { unsub(); };
    },
    () => true,
    () => false,
  );

  useEffect(() => {
    // After hydration: verify the user list against Supabase before choosing
    // Setup vs Login, so a fresh browser never flashes "Create Admin
    // Account" when an admin already exists in the backend.
    if (hydrated && !isAuthenticated && !usersChecked) {
      refreshUsers();
    }
    // Full sync once logged in.
    if (hydrated && isAuthenticated) {
      loadFromSupabase();
    }
  }, [hydrated, isAuthenticated, usersChecked, refreshUsers, loadFromSupabase]);

  // Keep the permission registry in step with role edits.
  useEffect(() => {
    syncRoleMatrix(roleDefinitions);
  }, [roleDefinitions]);

  // Keep system-role module edits (Settings → Roles) enforced in every
  // permission helper, on boot and on every settings change.
  const settings = useAppStore((s) => s.settings);
  useEffect(() => {
    setSystemRoleMatrices(buildSystemMatrices(settings, moduleConfig.map((m) => m.key)));
  }, [settings]);

  if (!hydrated) {
    return (
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem
        disableTransitionOnChange
      >
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </ThemeProvider>
    );
  }

  const app = (() => {
    // Setup shows ONLY when the backend-verified user list has no admin.
    // While the check is in flight on a fresh browser, hold the spinner
    // instead of flashing the setup page.
    if (!hasAdmin && !usersChecked) {
      return (
        <div className="flex h-screen items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      );
    }
    if (!hasAdmin || authMode === "setup") {
      return <SetupPanel />;
    }

    if (!isAuthenticated) {
      return <LoginPanel />;
    }

    const renderModule = () => {
      switch (activeModule) {
        case "dashboard": return <DashboardModule />;
        case "patients": return <PatientsModule />;
        case "doctors": return <DoctorsModule />;
        case "appointments": return <AppointmentsModule />;
        case "reception": return <ReceptionModule />;
        case "opd": return <OPDModule />;
        case "ipd": return <IPDModule />;
        case "beds": return <BedsModule />;
        case "billing": return <BillingModule />;
        case "insurance": return <InsuranceModule />;
        case "laboratory": return <LaboratoryModule />;
        case "radiology": return <RadiologyModule />;
        case "nursing": return <NursingModule />;
        case "accounts": return <AccountsModule />;
        case "attendance": return <AttendanceModule />;
        case "pharmacy": return <PharmacyModule />;
        case "records": return <RecordsModule />;
        case "crm": return <CRMModule />;
        case "marketing": return <MarketingModule />;
        case "reports": return <ReportsModule />;
        case "staff": return <StaffModule />;
        case "inventory": return <InventoryModule />;
        case "settings": return <SettingsModule />;
        default: return <DashboardModule />;
      }
    };

    return (
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <TopNav />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1600px] p-4 pb-24 lg:p-6 lg:pb-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeModule}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderModule()}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
          <MobileBottomNav />
        </div>
      </div>
    );
  })();

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {app}
      <SessionGuard />
      <Toaster />
      <SonnerToaster position="bottom-right" richColors />
    </ThemeProvider>
  );
}
