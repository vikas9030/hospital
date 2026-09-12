// Custom-role permission registry. The app's permission helpers (utils.ts)
// and module visibility (modules.ts) are pure functions of the role name, so
// custom roles plug in through this process-wide registry instead of
// rewriting every call site. The store syncs it on boot and on every change.

export type MatrixAction = "view" | "add" | "edit" | "del";
export type ModulePerms = Record<MatrixAction, boolean>;
export type RoleMatrix = Record<string, ModulePerms>;

export const MATRIX_MODULES = [
  "patients", "doctors", "appointments", "reception", "opd", "ipd", "beds",
  "billing", "insurance", "laboratory", "radiology", "pharmacy", "records",
  "crm", "marketing", "reports", "staff", "inventory",
] as const;

export function emptyMatrix(): RoleMatrix {
  const m: RoleMatrix = {};
  for (const mod of MATRIX_MODULES) m[mod] = { view: false, add: false, edit: false, del: false };
  return m;
}

function build(
  view: string[],
  add: string[] = [],
  edit: string[] = [],
  del: string[] = []
): RoleMatrix {
  const m = emptyMatrix();
  for (const mod of view) if (m[mod]) m[mod].view = true;
  for (const mod of add) if (m[mod]) { m[mod].view = true; m[mod].add = true; }
  for (const mod of edit) if (m[mod]) { m[mod].view = true; m[mod].edit = true; }
  for (const mod of del) if (m[mod]) { m[mod].view = true; m[mod].del = true; }
  return m;
}

export const ROLE_TEMPLATES: Record<string, { label: string; desc: string; matrix: RoleMatrix }> = {
  frontdesk: {
    label: "Front Desk (like Receptionist)",
    desc: "Patients, visits, beds, billing — no deletes, no staff.",
    matrix: build(
      ["patients", "doctors", "appointments", "reception", "opd", "ipd", "beds", "billing"],
      ["patients", "appointments", "billing"],
      ["patients", "appointments", "opd", "ipd", "beds", "billing"]
    ),
  },
  clinical: {
    label: "Clinical (like Doctor/Nurse)",
    desc: "Care modules with notes and reports — no billing deletes.",
    matrix: build(
      ["patients", "doctors", "appointments", "opd", "ipd", "beds", "laboratory", "radiology", "pharmacy", "records"],
      ["laboratory", "radiology", "records"],
      ["patients", "appointments", "opd", "ipd", "beds", "laboratory", "radiology", "records"]
    ),
  },
  accounts: {
    label: "Accounts (like Accountant)",
    desc: "Billing, insurance, reports and stock visibility.",
    matrix: build(
      ["billing", "insurance", "reports", "inventory", "patients"],
      ["billing"],
      ["billing", "insurance"]
    ),
  },
  viewer: {
    label: "Read-only Viewer",
    desc: "Sees care and business modules, changes nothing.",
    matrix: build(["patients", "doctors", "appointments", "opd", "ipd", "beds", "billing", "reports"]),
  },
  blank: {
    label: "Blank (customize below)",
    desc: "Start empty and tick exactly what this role may do.",
    matrix: emptyMatrix(),
  },
};

let registry: Record<string, RoleMatrix> = {};

/** View-only overrides for built-in system roles (Settings → Roles → Edit).
 *  Checked before custom-role matrices; add/edit/del fall through to the
 *  built-in defaults so module edits only change visibility. */
let systemRegistry: Record<string, RoleMatrix> = {};

export function setSystemRoleMatrices(entries: { name: string; modules: string[] }[]): void {
  const next: Record<string, RoleMatrix> = {};
  for (const e of entries) {
    next[e.name] = build(e.modules, [], [], []);
  }
  systemRegistry = next;
}

export function setCustomRoleMatrices(defs: { name: string; matrix?: RoleMatrix | null; isActive?: boolean }[]): void {
  const next: Record<string, RoleMatrix> = {};
  for (const d of defs) {
    if (d.isActive === false) continue;
    if (d.matrix && typeof d.matrix === "object") next[d.name] = d.matrix;
  }
  registry = next;
}

/** Custom rule for role+module+action, or undefined when no custom role covers it (caller falls back to built-in defaults). */
export function customAllows(role: string, module: string, action: MatrixAction): boolean | undefined {
  // System-role module edits only govern visibility; add/edit/del always
  // fall through to the built-in defaults (undefined here).
  if (action === "view") {
    const sys = systemRegistry[role]?.[module];
    if (sys) return sys.view;
  }
  const matrix = registry[role];
  if (!matrix) return undefined;
  const perms = matrix[module];
  if (!perms) return undefined;
  return !!perms[action];
}

/** Flatten a matrix to legacy permission strings for display/storage compat. */
export function matrixToPermissions(matrix: RoleMatrix): string[] {
  const out: string[] = [];
  for (const [mod, perms] of Object.entries(matrix)) {
    for (const action of ["view", "add", "edit", "del"] as MatrixAction[]) {
      if (perms[action]) out.push(`${mod}.${action}`);
    }
  }
  return out;
}

export function countMatrixGrants(matrix: RoleMatrix | undefined | null): number {
  if (!matrix) return 0;
  return Object.values(matrix).reduce(
    (s, p) => s + (p.view ? 1 : 0) + (p.add ? 1 : 0) + (p.edit ? 1 : 0) + (p.del ? 1 : 0),
    0
  );
}
