"use client";

import { useAppStore } from "@/store/app-store";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { LoginPanel } from "@/components/auth/login-panel";
import { DashboardModule } from "@/components/modules/dashboard";
import { PatientsModule } from "@/components/modules/patients";
import { DoctorsModule } from "@/components/modules/doctors";
import { AppointmentsModule } from "@/components/modules/appointments";
import { OPDModule, IPDModule, BedsModule } from "@/components/modules/operations";
import { BillingModule } from "@/components/modules/billing";
import { PharmacyModule, LaboratoryModule, RadiologyModule } from "@/components/modules/clinical";
import { InsuranceModule, CRMModule, MarketingModule } from "@/components/modules/business";
import { ReportsModule, StaffModule, InventoryModule, SettingsModule, ReceptionModule, RecordsModule } from "@/components/modules/admin";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const { activeModule, isAuthenticated } = useAppStore();

  // Show login panel if not authenticated
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

      {/* Mobile Sidebar */}
      <Sidebar isMobile />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] p-4 lg:p-6">
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
      </div>
    </div>
  );
}
