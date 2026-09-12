import { PortalApp } from "@/components/portal/portal-app";
import { Toaster } from "@/components/ui/toaster";

export const metadata = {
  title: "Patient Portal — MediCore",
  description: "View your visits, prescriptions, lab reports and bills.",
};

export default function PortalPage() {
  return (
    <>
      <PortalApp />
      <Toaster />
    </>
  );
}
