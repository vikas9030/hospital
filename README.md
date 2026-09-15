# MediCore — Hospital Management System

Full-stack hospital management system: staff web app + patient self-service portal,
backed by Supabase (Postgres). Multi-branch, role-based access, billing, pharmacy,
lab, radiology, nursing, HR attendance, marketing/CRM, integrations, and hardened
security (2FA, staff IP allowlist, session timeout, audit logging, encrypted local storage).

- **Frontend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui + Zustand — auto-deploys to **Netlify** on every push to `main`.
- **Backend:** **Supabase** Postgres (30 migrations) + Next.js API routes — sync with `npm run supabase:sync`.
- **One-command both:** `npm run deploy:all` (backend sync + push frontend).

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Project Structure](#2-project-structure)
3. [Frontend](#3-frontend)
4. [Backend](#4-backend)
5. [UI / Design System](#5-ui--design-system)
6. [Roles & Access Control](#6-roles--access-control)
7. [Security](#7-security)
8. [Patient Portal](#8-patient-portal)
9. [Environment Variables](#9-environment-variables)
10. [Setup & Local Development](#10-setup--local-development)
11. [Scripts](#11-scripts)
12. [Deployment](#12-deployment)
13. [Database Migrations](#13-database-migrations)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4, `tailwindcss-animate`, `tw-animate-css` |
| UI kit | shadcn/ui (48 components) on Radix UI primitives |
| State | Zustand 5 (persisted to localStorage, AES-256-GCM optional) |
| Data fetching | TanStack React Query 5, TanStack Table 8 |
| Forms | React Hook Form 7 + Zod 4 |
| Charts | Recharts 2 |
| Animations | Framer Motion 12, `vaul`, `sonner` toasts |
| Drag & drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| i18n | `next-intl` 4 |
| Theming | `next-themes` (dark / light) |
| Icons / utils | `lucide-react`, `date-fns`, `cmdk`, `uuid` |
| Backend DB | Supabase Postgres (service-role via `src/lib/supabase/admin.ts`) |
| Auth (staff) | Local credential check in Zustand + 6-digit OTP 2FA via `/api/auth/otp` |
| Auth (patients) | Phone + password portal logins (`patient_logins`), signed token (`src/lib/portal-auth.ts`) |
| Payments | Razorpay order/verify/test APIs |
| Legacy / retained | Prisma 6 schema (`User`, `Branch`, `AuditLog`, `SystemState`); `next-auth` 4 present |

---

## 2. Project Structure

```
├── netlify.toml                  # Frontend auto-deploy (push to main → build)
├── .github/workflows/deploy.yml  # Backend auto-sync (migrations on push to main)
├── package.json                  # scripts: dev, build, supabase:sync, portal:backfill, deploy:all
├── prisma/schema.prisma          # Retained Prisma schema (Supabase is the live DB)
├── supabase/
│   ├── migrations/001–030_*.sql  # All backend tables (idempotent, safe to re-run)
│   └── SETUP_ALL.sql             # One-shot full setup for SQL Editor
├── scripts/
│   ├── sync-supabase.js          # Apply all migrations to hosted Supabase
│   ├── backfill-portal.js        # Move stranded app_settings portal rows → real tables
│   ├── add-*.js / extend-*.js    # One-off column/backfill helpers
│   ├── inspect-checks.js         # DB inspection helper
│   ├── gen-pwa-icons.mjs         # PWA icon generator
│   └── wipe-db.mjs               # DANGER: wipes data (dev only)
├── src/
│   ├── app/
│   │   ├── page.tsx / home-client.tsx   # App entry, hydration + loadFromSupabase
│   │   ├── portal/page.tsx              # Patient portal entry
│   │   └── api/.../route.ts             # 40+ API route groups (see §4.2)
│   ├── components/
│   │   ├── auth/      # login-panel, setup-panel, session-guard
│   │   ├── layout/    # sidebar, topnav, mobile-nav
│   │   ├── modules/   # 16 feature modules (see §3.2)
│   │   ├── portal/    # portal-app (patient self-service)
│   │   ├── shared/    # page-header, stat-card, status-badge
│   │   └── ui/        # 48 shadcn/ui primitives
│   ├── hooks/         # use-toast, use-mobile, use-branch-data
│   ├── lib/           # business logic + data layer (see §3.5 / §4.3)
│   └── store/
│       └── app-store.ts  # Central Zustand store (all entities + settings + auth)
```

---

## 3. Frontend

### 3.1 App entry & pages

| Path | File | What it does |
|---|---|---|
| `/` | `src/app/page.tsx` → `home-client.tsx` | Hydrates store, calls `loadFromSupabase()`, routes: setup (first admin) → login → dashboard |
| `/portal` | `src/app/portal/page.tsx` → `portal-app.tsx` | Patient login (phone + password), dashboard, token in `medicore-portal-token` |

Auth flow (staff): `setup-panel` (create first Admin) → `login-panel` (branch optional, credentials → **IP check (staff only)** → **OTP 2FA (if enabled)** → session). `session-guard` enforces inactivity timeout + per-minute IP re-check while logged in.

### 3.2 Feature modules (`src/components/modules/`)

| File | Module | Functions |
|---|---|---|
| `dashboard.tsx` | Dashboard | KPI stat cards, Recharts revenue/occupancy charts, live alerts, branch scope |
| `patients.tsx` | Patients | Registration (UHID), search, detail view, timeline, portal-access issue/reset, documents print |
| `doctors.tsx` | Doctors | Profiles, departments, fees, multi-shift schedules, availability |
| `appointments.tsx` | Appointments | Booking, tokens, calendar, reminders, visit clinical notes/problems, portal requests accept/reject |
| `billing.tsx` | Billing | Invoices (OPD/IPD/tax lines), Razorpay, receipts/invoice print, pending OP bills |
| `clinical.tsx` | Pharmacy / Lab / Radiology | Stock + strip pricing, alerts, lab/radiology orders + findings + report print |
| `operations.tsx` | Beds / OPD / IPD | Bed map + rates, admissions/discharges, occupancy |
| `nursing.tsx` | Nursing | Assignments, vitals, first-aid log |
| `attendance.tsx` | Attendance | Staff check-in/out, WiFi-gated (device IP + on-network proof), monthly muster |
| `admin.tsx` | Admin | Staff & accounts, branches, departments, service pricing, taxes, branding, login design, integrations, audit viewer, DB status |
| `business.tsx` | Insurance / CRM / Marketing | Claims + bill links, leads, campaigns + targeting, broadcast composer |
| `accounts.tsx` | Accounts | Expenses ledger, payments overview |
| `departments.tsx` | Departments | Department master list |
| `integrations.tsx` + `integration-broadcast.tsx` | Integrations | Email / SMS / WhatsApp / GCal / video toggles + send, broadcast |
| `security.tsx` | Security | 2FA, session timeout, **IP whitelisting (staff only)**, audit logs, encryption |

### 3.3 Layout (`src/components/layout/`)

- `sidebar.tsx` — role-filtered module nav, collapse, branch badge.
- `topnav.tsx` — global search (`cmdk`), live-alerts toggle, theme toggle, user menu.
- `mobile-nav.tsx` — bottom nav + drawer for small screens.

### 3.4 State (`src/store/app-store.ts`)

One Zustand store, persisted (secure-storage). Holds: auth (`currentUser`, `isAuthenticated`, `users`), every entity collection (patients, doctors, appointments, invoices, medicines, labTests, radiologyOrders, beds, staff, branches, departments, leads, campaigns, notifications, reminders, alerts…), `settings` (all `app_settings` merged, DB wins), `roleDefinitions`, `auditLogs`, UI state (theme, sidebar, active module/branch).

Key actions: `authenticateUser`, `refreshUsers`, `loadFromSupabase` (bulk fetch + settings merge + role sync + doctor self-heal), `setAppSetting` (optimistic + POST `/api/settings`), `createAdmin`, audit helpers.

### 3.5 Frontend lib (`src/lib/`)

| File | Purpose |
|---|---|
| `security.ts` | `SEC_KEYS`, `isIpWhitelistEnabled`, `parseAllowlist`, `normalizeIp` (`::ffff:` strip, `::1`↔`127.0.0.1`, port/bracket handling), `ipAllowed` (exact + `192.168.1.*` wildcard + `10.0.0.0/24` CIDR), `fetchClientIp` |
| `portal-auth.ts` | Portal password hash/verify, token sign/verify, temp password, min length |
| `branding.ts` | App name/logo/hero theming from settings, login theme |
| `role-matrix.ts` / `system-roles.ts` | Per-role module permission matrices, custom roles |
| `modules.ts` | Module registry (keys, labels, role visibility) |
| `utils.ts` | `isAdmin`, branch helpers, availability, notification flags |
| `billing.ts` / `service-pricing.ts` / `invoice-print.ts` | Taxes/discounts, service prices, printable invoice HTML |
| `documents.ts` | Lab/radiology/medical-record printable HTML |
| `nursing.ts` / `pharmacy-alerts.ts` | Nursing helpers, near-expiry/low-stock alerts |
| `integrations.ts` | Channel enable flags + send helpers |
| `csv.ts` | CSV export helpers |
| `secure-storage.ts` | AES-256-GCM encrypted Zustand persistence |
| `supabase/client.ts` + `supabase/admin.ts` | Browser anon client vs server service-role client |

---

## 4. Backend

### 4.1 Database (Supabase Postgres)

Live DB: `rdghrhbwknlwxsamkcrh.supabase.co`. Full schema in `supabase/migrations/` (001–030) and `supabase/SETUP_ALL.sql`.

| # | Migration | Tables / columns |
|---|---|---|
| 001 | Core schema | `patients`, `doctors`, `appointments`, `invoices`, `medicines`, `lab_tests`, `radiology_orders`, `medical_records`, `users`, `staff` |
| 002 | Findings | `lab_tests.findings/problems`, `radiology_orders.findings/problems` |
| 003 | Settings | `app_settings(key,value)`, `doctor_branch_schedules` |
| 004 | Bill categories | OPD/IPD invoice-item constraint |
| 005 | Strip pricing | `medicines.strip_size/sheet_price` |
| 006 | Patient portal | `patient_logins`, `prescriptions`, `prescription_items`, `appointments.clinical_notes/problems` |
| 007 | Visit requests | `appointment_requests` |
| 008 | Indexes | Branch indexes + backfill |
| 009–021 | Insurance | `insurance_claims` + claim↔invoice/patient links |
| 010/012 | Staff | Photos/avatars, fee/schedule columns |
| 011 | Payments | `razorpay_payments` ledger |
| 013 | Schedules | Doctor multi-shift timings |
| 014 | Nursing | Assignments, vitals, first-aid tables |
| 015/016 | Billing links | Walk-in patient link, order patient FKs |
| 017 | Expenses | `expenses` ledger |
| 022 | Departments | `departments` |
| 023 | Attendance | `staff_attendance` |
| 024/025 | Engagement | Campaign targeting, `appointment_reminders` |
| 026/027/028 | Billing+ | Cancel audit, invoice discount/GST/CST, `invoice_taxes` |
| 029 | Pharmacy | `medicine_alerts` |
| 030 | Attendance net | WiFi-gated attendance columns |

RLS: `Authenticated read` (SELECT for all) + `Service role full access` (ALL for service_role). **All server writes use the service-role client**, so RLS never blocks the app.

`app_settings` doubles as a KV store: security flags, branding, pricing, integrations, role definitions — plus legacy fallback keys (`portal_login_*`, `rx_*`, `appt_req_*`) from before migrations 006/007. If any reappear, run `npm run portal:backfill`.

### 4.2 API routes (`src/app/api/`)

| Group | Routes | Functions |
|---|---|---|
| `patients`, `doctors`, `staff`, `users` | `GET/POST/PATCH` | CRUD +.ensure doctor profile |
| `appointments`, `appointment-requests`, `appointment-reminders` | CRUD | Booking, portal request → accept (creates appointment + token + OP bill) / reject, reminders |
| `invoices`, `invoice-items`, `invoice-taxes` | CRUD | Bills, line items, flexible tax lines |
| `prescriptions` | CRUD | Digital prescriptions + items, status flow |
| `lab-tests`, `radiology-orders` | CRUD | Orders, findings, problems |
| `medical-records`, `patient-timeline` | GET/POST | Records + unified timeline |
| `medicines`, `medicine-alerts`, `inventory` | CRUD | Stock, alerts, general inventory |
| `beds` | CRUD | Bed map, rates, occupancy |
| `branches`, `departments`, `doctor-schedules` | CRUD | Masters + schedules |
| `attendance` | CRUD | Check-in/out, muster, network proof |
| `leads`, `campaigns` | CRUD | CRM + marketing |
| `expenses` | CRUD | Expense ledger |
| `insurance-claims` | CRUD | Claims + links |
| `notifications` | CRUD | In-app notifications |
| `nurse-assignments`, `nurse-vitals`, `nurse-firstaid` | CRUD | Nursing workflows |
| `auth/otp` | `request` / `verify` | 6-digit code issue (email/SMS or on-screen demo) + verify, 10-min expiry, 5 attempts |
| `portal/access` | GET/POST | Portal login status / issue-reset temp password |
| `portal/session` | POST | Phone + password → signed token |
| `portal/data` | GET `?token=` | Everything scoped to token patient (visits, Rx, labs, bills, doctors…) |
| `portal/reset-password` | POST | Patient password change (first-login vs current-password flows) |
| `settings` | GET/POST/DELETE | `app_settings` KV (secrets filtered from GET) |
| `audit` | GET/POST | Audit trail read/append |
| `client-ip` | GET | Detected client IP (`x-forwarded-for`, `cf-connecting-ip`, `true-client-ip`, `fastly-client-ip`, `x-real-ip`, `::ffff:` normalized) |
| `network-check` | GET | Attendance WiFi/on-network proof |
| `charts`, `db-status` | GET | Dashboard aggregates, migration/table health |
| `payments/razorpay/order|verify|test` | POST | Razorpay order create, signature verify, test |
| `integrations/email|sms|whatsapp|gcal|video|send` | POST | Channel toggles + outbound send |

### 4.3 Data layer (`src/lib/supabase-data.ts`, ~2900 lines)

Thin mappers over `supabaseAdmin`: `fetch*/create*/update*` per entity, snake_case↔camelCase mapping, `withMigrationHint()` (turns missing-table errors into "run migration N" guidance), DB-status probes (`getDatabaseStatus`), portal login/Rx/request helpers with legacy `app_settings` fallback + merge, audit + settings KV helpers.

---

## 5. UI / Design System

- **Primitives:** 48 shadcn/ui components (`src/components/ui/`) — button, input, dialog, select, table, badge, card, tabs, calendar, OTP input, charts wrappers, etc. Radix behavior + Tailwind styling + dark-mode tokens.
- **Shared:** `page-header` (title + actions), `stat-card` (animated KPI), `status-badge` (auto color per status).
- **Layout:** desktop sidebar + topnav; mobile drawer + bottom nav; global `cmdk` search with previews.
- **Theming:** `next-themes` dark/light toggle; admin-editable branding (app name, tagline, logo, login hero gradient, footer) stored in settings and applied via `useBranding` / `loginThemeOf`.
- **Feedback:** `sonner` + `use-toast`, Framer Motion transitions, loading skeletons, empty states, audit-trail timelines.
- **Print:** dedicated HTML builders (`invoice-print`, `documents`) for invoices, receipts, lab/radiology reports, medical records.
- **PWA:** `public/manifest.webmanifest` + `sw.js` (portal cached), icons via `npm` script `gen-pwa-icons`.
- **Preview assets:** root `*-preview.png` screenshots (dashboard, patients, beds, CRM, dark mode, mobile, OTP login…).

---

## 6. Roles & Access Control

Roles (`src/lib/types.ts`): `Admin`, `Doctor`, `Receptionist`, `Nurse`, `Pharmacist`, `Lab Technician`, `Radiologist`, `Accountant`, `HR`, `Marketing`, `Patient` (+ custom string roles).

- `isAdmin(role)` ⟺ `role === "Admin"`.
- Sidebar/modules filtered per role matrix (`role-matrix`, `system-roles`); custom roles persist in `app_settings.roleDefinitions`.
- Staff login: branch optional (defaults to assigned branch); every record pinned to branch; non-admin staff see own branch unless granted.
- Sensitive request actions (accept/reject visit requests) require `actorRole` Admin/Receptionist.
- Patient portal is a separate auth domain (phone + password, signed token) — portal users never touch staff login.

---

## 7. Security

| Control | Where | Behavior |
|---|---|---|
| Two-factor OTP | `login-panel` + `/api/auth/otp` + `security.tsx` | 6-digit code, 10-min expiry, 5 attempts; email/SMS if integrated else on-screen demo code |
| **IP whitelisting (staff only)** | `security.ts`, `login-panel`, `session-guard`, `security.tsx` | When ON: **Admins bypass from anywhere**; staff must match `security_ip_allowlist`. Supports exact, `192.168.1.*` wildcard, `10.0.0.0/24` CIDR; `::ffff:`/port/`::1`↔`127.0.0.1` normalized. Fail-open on empty list (never lock everyone out); refuses to enable when IP undetectable; login refreshes settings from DB first so admin-added IPs apply instantly |
| Session timeout | `session-guard` + settings | Inactivity auto-logout (5–480 min, default 30) with 2-min warning dialog |
| Audit logging | `audit` API + `security.tsx` | Sign-ins, blocks, security changes, admin actions; CSV export; server + local merge |
| Encryption | `secure-storage` + `security.tsx` | AES-256-G
...[truncated 3880 chars]