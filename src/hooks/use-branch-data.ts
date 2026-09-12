import { useMemo } from "react";
import { useAppStore } from "@/store/app-store";
import { isAdmin, sameBranch, samePerson, isDoctorLikeRole } from "@/lib/utils";
import type { Role, Doctor } from "@/lib/types";

export { sameBranch };

function filterByBranch<T extends { branch: string }>(items: T[], branch: string): T[] {
  return items.filter((item) => sameBranch(item.branch, branch));
}

function getActiveBranch(role: Role, userBranch: string | undefined, activeBranch: string): string {
  // Admins operate across all branches via the active branch selector.
  if (isAdmin(role)) return activeBranch;
  return userBranch || activeBranch;
}

export function useBranchData() {
  const currentUser = useAppStore((s) => s.currentUser);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const storePatients = useAppStore((s) => s.patients);
  const storeDoctors = useAppStore((s) => s.doctors);
  const storeStaffMembers = useAppStore((s) => s.staffMembers);
  const storeInventoryItems = useAppStore((s) => s.inventoryItems);
  const storeMedicines = useAppStore((s) => s.medicines);
  const storeLabTests = useAppStore((s) => s.labTests);
  const storeRadiologyOrders = useAppStore((s) => s.radiologyOrders);
  const storeBeds = useAppStore((s) => s.beds);
  const storeInvoices = useAppStore((s) => s.invoices);
  const storeAppointments = useAppStore((s) => s.appointments);
  const storeInsuranceClaims = useAppStore((s) => s.insuranceClaims);
  const storeLeads = useAppStore((s) => s.leads);
  const storeCampaigns = useAppStore((s) => s.campaigns);
  const storeNotifications = useAppStore((s) => s.notifications);
  const storeDepartments = useAppStore((s) => s.departments);

  const branch = getActiveBranch(currentUser.role, currentUser.branch, activeBranch);

  return useMemo(() => {
    const patients = filterByBranch(storePatients, branch);
    const branchDoctors = filterByBranch(storeDoctors, branch);
    const branchStaff = filterByBranch(storeStaffMembers, branch);
    const doctorStaff = branchStaff.filter((s) => isDoctorLikeRole(s.role));
    const mergedDoctors: Doctor[] = [...branchDoctors];
    for (const staff of doctorStaff) {
      // Tolerant match: same email (any case) or same person name ignoring
      // case and "Dr." prefix, so "Dr. kalayan" merges with "kalayan" instead
      // of showing two cards.
      const staffEmail = (staff.email || "").trim().toLowerCase();
      const existingIdx = mergedDoctors.findIndex(
        (d) =>
          (staffEmail !== "" && (d.email || "").trim().toLowerCase() === staffEmail) ||
          samePerson(d.name, staff.name)
      );
      if (existingIdx >= 0) {
        // Staff record is the source of truth for identity/contact fields.
        // Fee and schedule fall back to the canonical row when the staff row
        // carries 0/empty (unset) — 0 and [] must NOT clobber real values.
        const current = mergedDoctors[existingIdx];
        const staffFee = staff.consultationFee ?? 0;
        const staffDays = staff.availableDays ?? [];
        mergedDoctors[existingIdx] = {
          ...current,
          name: staff.name,
          phone: staff.phone,
          email: staff.email,
          department: staff.department || current.department,
          specialization: staff.department || current.specialization,
          consultationFee: staffFee > 0 ? staffFee : current.consultationFee,
          availableDays: staffDays.length > 0 ? staffDays : current.availableDays,
          availableFrom: staff.availableFrom || current.availableFrom,
          availableTo: staff.availableTo || current.availableTo,
          shift: staff.shift || current.shift,
        };
      } else {
        mergedDoctors.push({
          id: `d-staff-${staff.id}`,
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
          availableDays: staff.availableDays ?? [],
          availableFrom: staff.availableFrom ?? "",
          availableTo: staff.availableTo ?? "",
          shift: staff.shift,
        });
      }
    }
    const appointments = filterByBranch(storeAppointments, branch);
    const beds = filterByBranch(storeBeds, branch);
    const invoices = filterByBranch(storeInvoices, branch);
    const medicines = filterByBranch(storeMedicines, branch);
    const labTests = filterByBranch(storeLabTests, branch);
    const radiologyOrders = filterByBranch(storeRadiologyOrders, branch);
    const insuranceClaims = filterByBranch(storeInsuranceClaims, branch);
    const leads = filterByBranch(storeLeads, branch);
    const campaigns = filterByBranch(storeCampaigns, branch);
    const staffMembers = branchStaff;
    const inventoryItems = filterByBranch(storeInventoryItems, branch);
    const notifications = filterByBranch(storeNotifications, branch);
    const departments = filterByBranch(storeDepartments, branch).filter((d) => d.isActive !== false);
    const departmentNames = departments.map((d) => d.name);

    return {
      branch,
      patients,
      doctors: mergedDoctors,
      appointments,
      beds,
      invoices,
      medicines,
      labTests,
      radiologyOrders,
      insuranceClaims,
      leads,
      campaigns,
      staffMembers,
      inventoryItems,
      notifications,
      departments,
      departmentNames,
    };
  }, [branch, storePatients, storeDoctors, storeStaffMembers, storeInventoryItems, storeMedicines, storeLabTests, storeRadiologyOrders, storeBeds, storeInvoices, storeAppointments, storeInsuranceClaims, storeLeads, storeCampaigns, storeNotifications, storeDepartments]);
}
