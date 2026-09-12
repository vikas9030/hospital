import type { FirstAidEntry, NurseAssignment, PatientCondition, VitalsEntry } from "@/lib/types";

// Nursing data lives in app_settings (synced cross-device, no migration):
//   nurse_assign            — Record<nurseStaffId, {doctors, wards, beds}>
//   nurse_vitals_<patient>  — VitalsEntry[] (newest first, capped)
//   nurse_firstaid          — FirstAidEntry[] (newest first, capped)

export const NURSE_ASSIGN_KEY = "nurse_assign";
export const NURSE_FIRSTAID_KEY = "nurse_firstaid";
export const vitalsKey = (patientId: string) => `nurse_vitals_${patientId}`;

export const NURSE_WARDS = [
  "ICU",
  "General Ward",
  "Private Room",
  "Semi Private",
  "Emergency",
  "Operation Theatre",
] as const;

export const PATIENT_CONDITIONS: PatientCondition[] = ["Stable", "Under Observation", "Critical", "Recovering"];

export const FIRSTAID_KINDS: FirstAidEntry["kind"][] = [
  "Dressing",
  "Injection",
  "IV Line",
  "Oxygen",
  "First Response",
  "Bedside Care",
  "Other",
];

export function parseAssignments(raw: string | undefined): Record<string, { doctors: string[]; wards: string[]; beds: string[] }> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    if (v && typeof v === "object") {
      const out: Record<string, { doctors: string[]; wards: string[]; beds: string[] }> = {};
      for (const [k, a] of Object.entries(v as Record<string, any>)) {
        out[k] = {
          doctors: Array.isArray(a?.doctors) ? a.doctors.map(String) : [],
          wards: Array.isArray(a?.wards) ? a.wards.map(String) : [],
          beds: Array.isArray(a?.beds) ? a.beds.map(String) : [],
        };
      }
      return out;
    }
  } catch {
    // corrupted payload → treat as empty
  }
  return {};
}

export function assignmentOf(all: Record<string, { doctors: string[]; wards: string[]; beds: string[] }>, nurseId: string): NurseAssignment {
  const a = all[nurseId];
  return {
    nurseId,
    nurseName: "",
    doctorIds: a?.doctors ?? [],
    wards: a?.wards ?? [],
    bedIds: a?.beds ?? [],
  };
}

export function parseVitals(raw: string | undefined): VitalsEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as VitalsEntry[]) : [];
  } catch {
    return [];
  }
}

export function parseFirstAid(raw: string | undefined): FirstAidEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? (v as FirstAidEntry[]) : [];
  } catch {
    return [];
  }
}

export function conditionStyles(condition: PatientCondition): string {
  switch (condition) {
    case "Stable":
      return "bg-success/15 text-success border-success/30";
    case "Recovering":
      return "bg-info/10 text-info border-info/30";
    case "Under Observation":
      return "bg-warning/15 text-warning border-warning/30";
    case "Critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
  }
}

/** Abnormal-vitals flags for the nurse (simple adult thresholds). */
export function vitalsFlags(v: Pick<VitalsEntry, "bpSys" | "bpDia" | "pulse" | "temp" | "spo2" | "sugar">): string[] {
  const flags: string[] = [];
  const num = (x?: string) => {
    const n = parseFloat(String(x ?? "").trim());
    return Number.isFinite(n) ? n : null;
  };
  const sys = num(v.bpSys);
  const dia = num(v.bpDia);
  if (sys !== null && (sys >= 140 || sys < 90)) flags.push(`BP sys ${sys}`);
  if (dia !== null && (dia >= 90 || dia < 60)) flags.push(`BP dia ${dia}`);
  const pulse = num(v.pulse);
  if (pulse !== null && (pulse > 100 || pulse < 60)) flags.push(`Pulse ${pulse}`);
  const temp = num(v.temp);
  if (temp !== null && (temp >= 100.4 || temp < 95)) flags.push(`Temp ${temp}°F`);
  const spo2 = num(v.spo2);
  if (spo2 !== null && spo2 < 95) flags.push(`SpO₂ ${spo2}%`);
  const sugar = num(v.sugar);
  if (sugar !== null && (sugar > 200 || sugar < 70)) flags.push(`Sugar ${sugar}`);
  return flags;
}
