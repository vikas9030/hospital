// System (built-in) role customisation. Overrides live in app_settings so
// they sync across devices like every other setting:
//   role_<slug>_modules — JSON array of ModuleKeys this role may see
//   role_<slug>_desc    — custom description shown on the role card
//   role_<slug>_deleted — "true" soft-delete flag (Admin can never be deleted)

export const SYSTEM_ROLES = [
  "Admin", "Doctor", "Receptionist", "Nurse", "Pharmacist",
  "Lab Technician", "Radiologist", "Accountant", "HR", "Marketing", "Patient",
] as const;

export type SystemRoleName = (typeof SYSTEM_ROLES)[number];

export function roleSlug(r: string): string {
  return r.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export const roleModulesKey = (r: string) => `role_${roleSlug(r)}_modules`;
export const roleDescKey = (r: string) => `role_${roleSlug(r)}_desc`;
export const roleDeletedKey = (r: string) => `role_${roleSlug(r)}_deleted`;
export const roleEnabledKey = (r: string) => `role_${roleSlug(r)}`;

export const DEFAULT_ROLE_DESCS: Record<string, string> = {
  Admin: "Full system access",
  Doctor: "Clinical access",
  Patient: "Self-service portal",
};

export function defaultRoleDesc(r: string): string {
  return DEFAULT_ROLE_DESCS[r] ?? "Role-based access";
}

export function getRoleDesc(settings: Record<string, string>, role: string): string {
  const custom = (settings[roleDescKey(role)] ?? "").trim();
  return custom || defaultRoleDesc(role);
}

/** Validated module override, or null when the role uses built-in defaults. */
export function getRoleModulesOverride(settings: Record<string, string>, role: string, validKeys: string[]): string[] | null {
  const raw = settings[roleModulesKey(role)];
  if (raw === undefined || raw === "") return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const clean = parsed.map(String).filter((k) => validKeys.includes(k));
    return [...new Set(clean)];
  } catch {
    return null;
  }
}

export function isRoleDeleted(settings: Record<string, string>, role: string): boolean {
  if (role === "Admin") return false; // Admin can never be deleted.
  return (settings[roleDeletedKey(role)] ?? "false") === "true";
}

export function isRoleLoginEnabled(settings: Record<string, string>, role: string): boolean {
  const v = settings[roleEnabledKey(role)];
  return v === undefined ? role === "Admin" : v === "true";
}

/** Rows for the permission-registry sync (deleted roles contribute nothing). */
export function buildSystemMatrices(settings: Record<string, string>, validKeys: string[]): { name: string; modules: string[] }[] {
  return SYSTEM_ROLES.filter((r) => !isRoleDeleted(settings, r)).map((r) => ({
    name: r,
    modules: getRoleModulesOverride(settings, r, validKeys) ?? [],
  })).filter((e) => e.modules.length > 0);
}
