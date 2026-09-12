# MedicoRe — Hospital Management System

A comprehensive, full-stack Hospital Management System built with **Next.js 16**, **TypeScript**, **Tailwind CSS 4**, **shadcn/ui**, **Prisma (SQLite)**, and **Zustand**. Features role-based access control, multi-branch support, dark mode, and 20 modular sections.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Modules & Components](#modules--components)
- [Hooks](#hooks)
- [Library / Utilities](#library--utilities)
- [State Management (Zustand Store)](#state-management-zustand-store)
- [Role-Based Access Control](#role-based-access-control)
- [API Routes](#api-routes)
- [Scripts](#scripts)

---

## Tech Stack

| Layer          | Technology                                       |
|----------------|--------------------------------------------------|
| Framework      | Next.js 16 (App Router)                          |
| Language       | TypeScript 5                                     |
| Styling        | Tailwind CSS 4, tailwindcss-animate, tw-animate  |
| UI Components  | shadcn/ui (48 components), Radix UI primitives   |
| State          | Zustand 5 with localStorage persistence          |
| Data Fetching  | TanStack React Query 5                           |
| Forms          | React Hook Form 7 + Zod 4 + @hookform/resolvers  |
| Charts         | Recharts 2                                       |
| Database       | Supabase (Postgres) via `src/lib/supabase-data.ts`; Prisma 6 schema retained for `User`, `Branch`, `AuditLog`, `SystemState` |
| Auth           | next-auth 4                                      |
| Animations     | Framer Motion 12                                 |
| Drag & Drop    | @dnd-kit/core, @dnd-kit/sortable                 |
| i18n           | next-intl 4                                      |
| Theming        | next-themes (dark/light)                         |
| Misc           | date-fns, lucide-react, cmdk, sonner, vaul, uuid|

---

## Project Structure

```
├── prisma/
│   └── schema.prisma            # Database schema
├── src/
│   ├── app/
│   │   ├── api/route.ts         # Health-check API
│   │   ├── globals.css          # Global styles
│   │   ├── layout.tsx           # Root layout
│   │   └── page.tsx             # Main app page (router)
│   ├── components/
│   │   ├── auth/
│   │   │   ├── login-panel.tsx  # Login UI
│   │   │   └── setup-panel.tsx  # Super Admin setup
│   │   ├── layout/
│   │   │   ├── sidebar.tsx      # Sidebar navigation
│   │   │   └── topnav.tsx       # Top navigation bar
│   │   ├── modules/
│   │   │   ├── admin.tsx        # Reports, Staff, Inventory, Settings, Reception, Records
│   │   │   ├── appointments.tsx # Appointments management
│   │   │   ├── billing.tsx      # Billing & invoices
│   │   │   ├── business.tsx     # Insurance, CRM, Marketing
│   │   │   ├── clinical.tsx     # Pharmacy, Laboratory, Radiology
│   │   │   ├── dashboard.tsx    # Main dashboard
│   │   │   ├── doctors.tsx      # Doctor profiles
│   │   │   ├── operations.tsx   # Beds, OPD, IPD
│   │   │   └── patients.tsx     # Patient management
│   │   ├── shared/
│   │   │   ├── page-header.tsx  # Reusable page header
│   │   │   ├── stat-card.tsx    # Animated stat card
│   │   │   └── status-badge.tsx # Auto-colored status badge
│   │   ├── theme-provider.tsx   # next-themes wrapper
│   │   └── ui/                  # 48 shadcn/ui components
│   ├── hooks/
│   │   ├── use-branch-data.ts   # Branch-filtered data hook
│   │   ├── use-mobile.ts        # Mobile viewport detection
│   │   └── use-toast.ts         # Toast notification hook
│   ├── lib/
│   │   ├── data.ts              # Mock/seed data arrays
│   │   ├── db.ts                # Prisma client singleton
│   │   ├── modules.ts           # Module config & role mapping
│   │   ├── types.ts             # All TypeScript types
│   │   └── utils.ts             # Utility & permission functions
│   └── store/
│       └── app-store.ts         # Zustand global store
├── package.json
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── components.json
```

---

## Database Schema

### `User`
| Field               | Type      | Default        | Notes                     |
|---------------------|-----------|----------------|---------------------------|
| id                  | String    | cuid()         | Primary key               |
| email               | String    | —              | Unique                    |
| name                | String    | —              |                           |
| passwordHash        | String    | —              |                           |
| role                | String    | "Staff"        |                           |
| avatar              | String?   | —              |                           |
| branch              | String?   | —              |                           |
| branchId            | String?   | —              |                           |
| staffId             | String?   | —              | Unique                    |
| mustChangePassword  | Boolean   | false          |                           |
| status              | String    | "Active"       |                           |
| shift               | String    | "Morning"      |                           |
| createdAt           | DateTime  | now()          |                           |
| updatedAt           | DateTime  | @updatedAt     |                           |

Relations: `auditLogs: AuditLog[]`

### `Branch`
| Field     | Type     | Default  | Notes        |
|-----------|----------|----------|--------------|
| id        | String   | cuid()   | Primary key  |
| name      | String   | —        | Unique       |
| location  | String   | —        |              |
| patients  | Int      | 0        |              |
| revenue   | Float    | 0        |              |
| staff     | Int      | 0        |              |
| status    | String   | "Active" |              |

### `AuditLog`
| Field      | Type     | Default | Notes                       |
|------------|----------|---------|-----------------------------|
| id         | String   | cuid()  | Primary key                 |
| actorId    | String   | —       | FK → User.id                |
| actor      | User     | —       | Relation "ActorAuditLogs"   |
| actorEmail | String   | —       |                             |
| action     | String   | —       |                             |
| target     | String?  | —       |                             |
| branch     | String   | —       |                             |
| details    | String   | —       |                             |
| ip         | String?  | —       |                             |
| timestamp  | DateTime | now()   |                             |

### `SystemState`
| Field      | Type     | Default      | Notes          |
|------------|----------|--------------|----------------|
| id         | String   | "singleton"  | Primary key    |
| initialized| Boolean  | false        |                |
| version    | String   | "1.0.0"      |                |
| updatedAt  | DateTime | @updatedAt   |                |

---

## Modules & Components

### `src/components/modules/admin.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `ReportsModule`       | Component  | Revenue by dept, monthly trends (BarChart/LineChart), report type cards, export dialog (PDF/Excel/CSV) |
| `StaffModule`         | Component  | Staff search/stats, table (ID, name, role, dept, contact, shift, attendance, salary, status), add/edit/delete/reset password dialogs |
| `InventoryModule`     | Component  | Inventory search/stats, table (item, category, supplier, location, stock, price, status), add/edit/delete dialogs |
| `SettingsModule`      | Component  | Tabs: General, Branches, Roles, Notifications, Integrations, Security, Danger Zone, My Profile. Branch/role CRUD, notification toggles, integration cards, audit logs, delete all data |
| `ReceptionModule`     | Component  | Quick action cards, today's queue, helpdesk with next token       |
| `RecordsModule`       | Component  | Medical records search/stats, record cards, upload dialog         |

**Internal Dialogs:** `AddStaffDialog`, `EditStaffDialog`, `AddItemDialog`, `EditItemDialog`, `AddBranchDialog`, `EditBranchDialog`, `UploadRecordDialog`, `ExportDialog`, `CreateRoleDialog`, `AdminResetPasswordDialog`, `DeleteAllDataDialog`, `NewRegistrationDialog`

---

### `src/components/modules/appointments.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `AppointmentsModule`  | Component  | List/calendar views, past/present/future categorization, stats, appointment table, calendar grid, live doctor queue, quick stats |

**Internal:** `NewAppointmentDialog`, `UpdateStatusDialog`, `AppointmentTable`, `categorizeAppointments(appointments)`

---

### `src/components/modules/billing.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `BillingModule`       | Component  | Stats, revenue by payment method chart, payment breakdown, invoices table with status filter, consolidated billing demo invoice |

**Internal:** `NewInvoiceDialog`

---

### `src/components/modules/business.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `InsuranceModule`     | Component  | Stats, claims by provider chart, claim status pie chart, claims list with status updates |
| `CRMModule`           | Component  | Pipeline Kanban board (8 stages), lead source breakdown grid, stats |
| `MarketingModule`     | Component  | Stats, campaign performance table, campaign type quick-access cards |

**Internal:** `NewClaimDialog`, `AddLeadDialog`, `NewCampaignDialog`

---

### `src/components/modules/clinical.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `PharmacyModule`      | Component  | Medicine inventory search/stats, table with stock progress bars, status dropdowns, add/edit/delete |
| `LaboratoryModule`    | Component  | Lab test stats, workflow steps, test orders table with status filter & updates, add/edit/delete |
| `RadiologyModule`     | Component  | Stats, modality cards (X-Ray, CT, MRI, Ultrasound, ECG), imaging orders table, add/edit/delete |

**Internal:** `EditMedicineDialog`, `AddMedicineDialog`, `EditLabTestDialog`, `NewTestOrderDialog`, `EditRadiologyDialog`, `NewImagingOrderDialog`

---

### `src/components/modules/dashboard.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `DashboardModule`     | Component  | 12 stat widgets, revenue trend area chart, OPD vs IPD donut, patient growth line chart, department performance bar chart, appointment trends, bed occupancy radial chart, today's appointments list, quick insights, insurance claims bar chart, pharmacy sales area chart |

**Internal:** `RegisterPatientDialog`

---

### `src/components/modules/doctors.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `DoctorsModule`       | Component  | Doctor search, specialty filter, doctor cards (avatar, specialization, rating, appointments, fee, availability), edit/delete |

**Internal:** `DoctorEditDialog`, `DeleteConfirmDialog`

---

### `src/components/modules/operations.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `BedsModule`          | Component  | Stats, legend, ward-based bed map (ICU, General Ward, Private Room, Semi Private, Emergency, OT) with visual bed tiles |
| `OPDModule`           | Component  | OPD outpatient stats, workflow steps, today's queue with status updates |
| `IPDModule`           | Component  | IPD inpatient stats, current admissions table, nursing dashboard with critical patients, medication/lab/vitals/discharge indicators |

**Internal:** `AddBedDialog`, `NewOPDDialog`, `NewAdmissionDialog`

---

### `src/components/modules/patients.tsx`

| Export                | Type       | Description                                                       |
|-----------------------|------------|-------------------------------------------------------------------|
| `PatientsModule`      | Component  | Patient search, status filter, stats, table (UHID, name, contact, blood, insurance, last visit, status), add/edit/delete, pagination |

**Internal:** `PatientFormDialog` (add/edit), `DeletePatientDialog`, `PatientDetail` (full detail view with timeline, medical info, documents, billing history tabs)

---

### `src/components/auth/login-panel.tsx`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `LoginPanel`    | Component  | Login UI with email/password form, branch selector, OTP login, MFA/biometric login, forgot password flow, quick demo role login buttons (admin, doctor, reception, nurse, pharmacist) |

---

### `src/components/auth/setup-panel.tsx`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `SetupPanel`   | Component  | Initial Super Admin setup form. Collects name, email, password (with strength indicator), confirm password. Creates Super Admin on submit |

---

### `src/components/layout/sidebar.tsx`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `Sidebar`       | Component  | Sidebar navigation with module groups, module links with icons/badges, current user info. Supports collapsed and mobile modes |

**Props:** `SidebarProps { isMobile?: boolean }`

---

### `src/components/layout/topnav.tsx`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `TopNav`        | Component  | Top nav bar with sidebar toggle, global search (Cmd+K), branch selector (admin only), theme toggle, help, messages, notifications popover, user profile dropdown, global search CommandDialog |

---

### `src/components/shared/`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `PageHeader`    | Component  | Reusable page header with icon, title, description, optional action buttons           |
| `StatCard`      | Component  | Animated stat card with icon, value, trend indicator (up/down %), optional subtitle. Colors: primary/success/warning/destructive/info |
| `StatusBadge`   | Component  | Badge that auto-infers color from status text (Active→success, Pending→warning, Cancelled→danger, etc.) |

---

### `src/components/theme-provider.tsx`

| Export          | Type       | Description                                                                          |
|-----------------|------------|--------------------------------------------------------------------------------------|
| `ThemeProvider` | Component  | Thin wrapper around next-themes ThemeProvider. Passes through attribute, defaultTheme, enableSystem, disableTransitionOnChange |

---

## Hooks

### `src/hooks/use-branch-data.ts`

| Export           | Type  | Description                                                                                                              |
|------------------|-------|--------------------------------------------------------------------------------------------------------------------------|
| `useBranchData` | Hook  | Returns branch-filtered data for current active branch. Merges doctor staff into doctors array. Returns `{ branch, patients, doctors, appointments, beds, invoices, medicines, labTests, radiologyOrders, insuranceClaims, leads, campaigns, staffMembers, inventoryItems, notifications }` |

---

### `src/hooks/use-mobile.ts`

| Export          | Type   | Description                                                       |
|-----------------|--------|-------------------------------------------------------------------|
| `useIsMobile`  | Hook   | Returns `boolean` — `true` if viewport < 768px (MOBILE_BREAKPOINT) |

---

### `src/hooks/use-toast.ts`

| Export    | Type   | Description                                                       |
|-----------|--------|-------------------------------------------------------------------|
| `useToast`| Hook   | Returns `{ toasts, toast, dismiss }`. `toast()` creates notifications with title, description, variant, action |
| `toast`   | Func   | Imperative toast creation function                                |
| `reducer` | Func   | Toast state reducer                                               |

---

## Library / Utilities

### `src/lib/utils.ts`

| Export                          | Signature                                                            | Description                                      |
|---------------------------------|----------------------------------------------------------------------|--------------------------------------------------|
| `cn`                            | `(...inputs: ClassValue[]) → string`                                | Merges Tailwind classes (clsx + tailwind-merge)  |
| `isAdmin`                       | `(role: Role) → boolean`                                            | True for Hospital Admin or Super Admin           |
| `isSuperAdmin`                  | `(role: Role) → boolean`                                            | True for Super Admin only                        |
| `canAddPatient`                 | `(role: Role) → boolean`                                            | Admin or Receptionist                            |
| `canEditPatient`                | `(role: Role) → boolean`                                            | Admin, Receptionist, or Doctor                   |
| `canDeletePatient`              | `(role: Role) → boolean`                                            | Admin only                                       |
| `canAddAnything`                | `(role: Role) → boolean`                                            | Admin only                                       |
| `canAddMedicine`                | `(role: Role) → boolean`                                            | Admin or Pharmacist                              |
| `canCreateInvoice`              | `(role: Role) → boolean`                                            | Admin, Accountant, or Receptionist               |
| `canManageLab`                  | `(role: Role) → boolean`                                            | Admin or Lab Technician                          |
| `canManageRadiology`            | `(role: Role) → boolean`                                            | Admin or Radiologist                             |
| `isBranchAccessible`            | `(userBranch, targetBranch, userRole, activeBranch) → boolean`      | Checks if user can access a branch's data        |
| `canEditModule`                 | `(role: Role, module: ModuleName) → boolean`                        | Role-based module edit permission via lookup      |
| `canDeleteModule`               | `(role: Role, module: ModuleName) → boolean`                       | Role-based module delete permission (admin only)  |
| `generateStaffId`               | `() → string`                                                       | Generates staff ID in format `MC-YY-XXXXX`       |
| `getDefaultModuleForRole`       | `(role: Role) → string`                                             | Returns default landing module key for each role  |

---

### `src/lib/modules.ts`

| Export              | Type     | Description                                                        |
|---------------------|----------|--------------------------------------------------------------------|
| `moduleConfig`      | Const    | Array of 20 module configs with key, label, icon, group, badge, roles |
| `moduleGroups`      | Const    | 6 groups: Overview, Patient Care, Operations, Clinical, Business, Admin |
| `getModulesForRole` | Function | `(role: Role) → ModuleConfig[]` — Returns modules accessible by role |
| `getModuleKeysForRole` | Function | `(role: Role) → ModuleKey[]` — Returns module keys for role     |

**`ModuleConfig` interface:** `{ key: ModuleKey; label: string; icon: LucideIcon; group: string; badge?: string; roles: Role[] }`

---

### `src/lib/types.ts`

All TypeScript type definitions for the application:

| Type               | Key Fields                                                                                      |
|--------------------|-------------------------------------------------------------------------------------------------|
| `ModuleKey`        | Union of 20 module key strings                                                                  |
| `ModuleName`       | Union of 16 module name strings                                                                 |
| `Role`             | Union of 12 roles: Super Admin, Hospital Admin, Doctor, Receptionist, Nurse, Pharmacist, Lab Technician, Radiologist, Accountant, Pathologist, Staff, Patient |
| `Patient`          | id, uhid, name, photo, gender, age, phone, email, bloodGroup, address, emergencyContact, insuranceProvider, insurancePolicy, allergies, chronicDiseases, status, lastVisit, registeredOn, branch |
| `TimelineEvent`    | id, type (10 event types), date, description, doctor, department, status                        |
| `Doctor`           | id, name, photo, specialization, department, experience, qualification, availability, rating, consultationFee, todayAppointments, patientsTreated, branch |
| `Appointment`      | id, patientId, patientName, doctorId, doctorName, date, time, type, status, branch, reason, notes |
| `Bed`              | id, number, ward, floor, status, patientId, patientName, assignedDate, branch                   |
| `Invoice`          | id, patientId, patientName, date, items[], subtotal, tax, discount, total, status, paymentMethod, branch |
| `InvoiceItem`      | id, name, category, quantity, rate, amount                                                       |
| `Medicine`         | id, name, category, manufacturer, batchNo, quantity, price, expiryDate, supplier, status, branch |
| `LabTest`          | id, testName, patientId, patientName, doctorId, doctorName, orderedDate, status, priority, sampleType, branch |
| `RadiologyOrder`   | id, patientId, patientName, modality, bodyPart, orderingDoctor, status, orderedDate, branch     |
| `InsuranceClaim`   | id, patientId, patientName, provider, policyNo, claimAmount, approvedAmount, status, date, branch |
| `Lead`             | id, name, email, phone, source, stage, value, assignedTo, createdAt, branch                      |
| `Campaign`         | id, name, type, status, budget, spent, leads, conversions, startDate, endDate, branch          |
| `StaffMember`       | id, name, role, department, email, phone, shift, attendance, salary, joinDate, status, branch, staffId |
| `InventoryItem`    | id, name, category, supplier, location, stock, minStock, price, lastRestocked, status, branch   |
| `Branch`           | id, name, location, patients, revenue, staff, status                                            |
| `Notification`      | id, title, message, type, priority, read, createdAt                                              |

---

### `src/lib/data.ts`

Seed/mock data arrays exported:

| Export                      | Type                   | Count |
|-----------------------------|------------------------|-------|
| `branches`                  | `Branch[]`             | 4     |
| `patients`                  | `Patient[]`            | 8     |
| `patientTimeline`           | `TimelineEvent[]`      | 8     |
| `doctors`                   | `Doctor[]`             | 6     |
| `appointments`              | `Appointment[]`        | 8     |
| `beds`                      | `Bed[]`                | 19    |
| `invoices`                  | `Invoice[]`            | 5     |
| `medicines`                 | `Medicine[]`           | 8     |
| `labTests`                  | `LabTest[]`            | 7     |
| `radiologyOrders`           | `RadiologyOrder[]`     | 6     |
| `insuranceClaims`           | `InsuranceClaim[]`     | 5     |
| `leads`                     | `Lead[]`               | 8     |
| `campaigns`                 | `Campaign[]`           | 6     |
| `staffMembers`              | `StaffMember[]`        | 8     |
| `inventoryItems`            | `InventoryItem[]`      | 8     |
| `notifications`             | `Notification[]`       | 6     |
| `revenueTrendData`          | Monthly revenue         | 8     |
| `patientGrowthData`         | Monthly growth          | 8     |
| `departmentPerformanceData`  | Department metrics      | 6     |
| `appointmentTrendData`      | Daily trends            | 7     |
| `insuranceClaimsData`       | Claim statuses          | 4     |
| `pharmacySalesData`         | Monthly sales/purchases | 8     |

---

### `src/lib/db.ts`

| Export | Type          | Description                                             |
|--------|---------------|---------------------------------------------------------|
| `db`   | `PrismaClient`| Singleton Prisma client with query logging, reused in dev via `globalThis` |

---

## State Management (Zustand Store)

**Store:** `src/store/app-store.ts` — `useAppStore` (persisted to localStorage key `medicore-store`)

### Auth State & Actions

| State / Action           | Type / Signature                           | Description                            |
|--------------------------|--------------------------------------------|----------------------------------------|
| `isAuthenticated`        | `boolean`                                  | Whether user is logged in              |
| `authMode`               | `string`                                   | Current auth mode                      |
| `currentUser`            | `User \| null`                             | Currently logged-in user               |
| `login(user)`            | Action                                     | Log in a user                          |
| `logout()`               | Action                                     | Log out and reset state                |
| `setAuthMode(mode)`      | Action                                     | Set auth mode (login/setup/otp)        |
| `superAdminExists()`     | Action                                     | Check if Super Admin account exists    |
| `createSuperAdmin(data)` | Action                                     | Create the initial Super Admin         |
| `deleteAllData()`        | Action                                     | Delete all data (danger zone)          |
| `authenticateUser()`     | Action                                     | Authenticate user credentials          |
| `changePassword()`       | Action                                     | Change current user password           |
| `adminResetPassword()`   | Action                                     | Admin resets another user's password   |

### Navigation State & Actions

| State / Action           | Type / Signature                           | Description                            |
|--------------------------|--------------------------------------------|----------------------------------------|
| `activeModule`           | `string`                                   | Currently active module key            |
| `setActiveModule(key)`   | Action                                     | Switch active module                   |
| `selectedPatientId`      | `string \| null`                           | Selected patient ID                    |
| `selectPatient(id)`      | Action                                     | Select a patient for detail view       |
| `selectedDoctorId`       | `string \| null`                           | Selected doctor ID                     |
| `selectDoctor(id)`       | Action                                     | Select a doctor                        |
| `sidebarCollapsed`       | `boolean`                                  | Sidebar collapsed state                |
| `toggleSidebar()`        | Action                                     | Toggle sidebar collapse                |
| `mobileSidebarOpen`      | `boolean`                                  | Mobile sidebar open state              |
| `setMobileSidebar(open)` | Action                                     | Set mobile sidebar state               |
| `globalSearchOpen`       | `boolean`                                  | Global search dialog open              |
| `setGlobalSearch(open)`  | Action                                     | Toggle global search dialog            |

### Theme & Branch

| State / Action           | Type / Signature                           | Description                            |
|--------------------------|--------------------------------------------|----------------------------------------|
| `theme`                  | `string`                                   | Current theme (light/dark)            |
| `toggleTheme()`          | Action                                     | Toggle dark/light theme                |
| `activeBranch`           | `string`                                   | Currently active branch               |
| `setActiveBranch(branch)`| Action                                     | Switch active branch                   |

### Data Collections (CRUD)

Each collection has read state plus add/update/delete actions:

| Collection          | State Type                  | Actions                                  |
|---------------------|-----------------------------|------------------------------------------|
| `patients`          | `Patient[]`                 | add, update, delete                      |
| `doctors`           | `Doctor[]`                  | add, update, delete                      |
| `staffMembers`      | `StaffMember[]`             | add, update, delete                      |
| `inventoryItems`    | `InventoryItem[]`           | add, update, delete                      |
| `branches`          | `Branch[]`                  | add, update, delete                      |
| `medicines`         | `Medicine[]`                | add, update, delete                      |
| `labTests`          | `LabTest[]`                 | add, update, delete                      |
| `radiologyOrders`   | `RadiologyOrder[]`          | add, update, delete                      |
| `beds`              | `Bed[]`                    | add, update, delete                      |
| `invoices`          | `Invoice[]`                | add, update, delete                      |
| `appointments`      | `Appointment[]`             | add, update, delete                      |
| `insuranceClaims`   | `InsuranceClaim[]`          | add, update, delete                      |
| `leads`             | `Lead[]`                   | add, update, delete                      |
| `campaigns`         | `Campaign[]`                | add, update, delete                      |
| `notifications`     | `Notification[]`             | add, update, delete                      |
| `users`             | `User[]`                   | addUser, deleteUser                     |

### Role Definitions

| State / Action               | Type / Signature              | Description                         |
|------------------------------|-------------------------------|-------------------------------------|
| `roleDefinitions`            | `RoleDefinition[]`           | Defined roles with permissions      |
| `addRoleDefinition(def)`     | Action                        | Add a new role definition           |
| `updateRoleDefinition(def)`  | Action                        | Update an existing role definition   |
| `deleteRoleDefinition(id)`   | Action                        | Delete a role definition             |

### Audit Logs

| State / Action               | Type / Signature              | Description                         |
|------------------------------|-------------------------------|-------------------------------------|
| `auditLogs`                  | `AuditLogEntry[]`            | All audit log entries               |
| `addAuditLog(entry)`         | Action                        | Add an audit log entry              |
| `getAuditLogsForBranch()`    | Action                        | Get audit logs filtered by branch   |

### Helper Functions

| Function                       | Description                                         |
|--------------------------------|-----------------------------------------------------|
| `getPatientsForActiveBranch()` | Returns patients filtered by active branch          |
| `syncDoctorFromStaff(staff)`   | Syncs a staff member into the doctors array         |
| `removeDoctorByStaff(staffId)` | Removes a doctor entry by staff ID                  |

### Demo Users

`demoUsers: Record<string, User>` — 5 demo users:

| Key          | Role           | Email                          |
|--------------|----------------|--------------------------------|
| admin        | Hospital Admin  | admin@medicore.com            |
| doctor       | Doctor          | doctor@medicore.com           |
| reception    | Receptionist    | reception@medicore.com        |
| nurse        | Nurse           | nurse@medicore.com            |
| pharmacist   | Pharmacist      | pharmacist@medicore.com      |

---

## Role-Based Access Control

### 12 Roles

`Super Admin` · `Hospital Admin` · `Doctor` · `Receptionist` · `Nurse` · `Pharmacist` · `Lab Technician` · `Radiologist` · `Accountant` · `Pathologist` · `Staff` · `Patient`

### Permission Matrix

| Permission              | Super Admin | Hospital Admin | Doctor | Receptionist | Nurse | Pharmacist | Lab Tech | Radiologist | Accountant |
|-------------------------|:-----------:|:--------------:|:------:|:------------:|:-----:|:----------:|:--------:|:-----------:|:----------:|
| Add Patient             | ✓           | ✓              |        | ✓            |       |            |          |             |            |
| Edit Patient            | ✓           | ✓              | ✓      | ✓            |       |            |          |             |            |
| Delete Patient          | ✓           | ✓              |        |              |       |            |          |             |            |
| Add Anything            | ✓           | ✓              |        |              |       |            |          |             |            |
| Add Medicine            | ✓           | ✓              |        |              |       | ✓          |          |             |            |
| Create Invoice          | ✓           | ✓              |        | ✓            |       |            |          |             | ✓          |
| Manage Lab              | ✓           | ✓              |        |              |       |            | ✓        |             |            |
| Manage Radiology        | ✓           | ✓              |        |              |       |            |          | ✓           |            |
| Edit Modules            | ✓           | ✓              |        |              |       |            |          |             |            |
| Delete Modules          | ✓           | ✓              |        |              |       |            |          |             |            |
| Branch Access (All)     | ✓           | ✓              |        |              |       |            |          |             |            |

### Module Access by Role

| Module Group   | Modules                                              | Accessible By                                     |
|----------------|------------------------------------------------------|---------------------------------------------------|
| Overview       | Dashboard                                            | All roles                                         |
| Patient Care   | Patients, Appointments, Doctors                      | All clinical + admin roles                        |
| Operations     | Beds, OPD, IPD                                       | Admin, Doctor, Nurse, Receptionist                |
| Clinical       | Pharmacy, Laboratory, Radiology                      | Admin, Pharmacist, Lab Tech, Radiologist, Doctor  |
| Business       | Billing, Insurance, CRM, Marketing                  | Admin, Accountant, Receptionist                   |
| Admin          | Reports, Staff, Inventory, Settings, Reception, Records | Admin only                                      |

---

## API Routes

### `GET /api`
Returns `{ message: "Hello, world!" }` — health-check endpoint.

### Resource routes (`src/app/api/*`)

Standard resources support `GET` (list, optional `?branch=` filter), `POST` (create, `201`), `PATCH` (update by `id`), `DELETE` (remove by `id`):

| Route prefix        | Methods                  | Notes                                              |
|---------------------|--------------------------|----------------------------------------------------|
| `appointments`      | GET, POST, PATCH, DELETE |                                                    |
| `beds`              | GET, POST, PATCH, DELETE |                                                    |
| `branches`          | GET, POST, PATCH, DELETE |                                                    |
| `campaigns`         | GET, POST, PATCH, DELETE |                                                    |
| `doctors`           | GET, POST, PATCH, DELETE |                                                    |
| `doctors/ensure`    | POST                     | Materializes staff-derived doctors (FK target)     |
| `insurance-claims`  | GET, POST, PATCH, DELETE |                                                    |
| `inventory`         | GET, POST, PATCH, DELETE |                                                    |
| `invoices`          | GET, POST, PATCH, DELETE |                                                    |
| `lab-tests`         | GET, POST, PATCH, DELETE |                                                    |
| `leads`             | GET, POST, PATCH, DELETE |                                                    |
| `medical-records`   | GET, POST, PATCH, DELETE |                                                    |
| `medicines`         | GET, POST, PATCH, DELETE |                                                    |
| `notifications`     | GET, POST, PATCH, DELETE |                                                    |
| `patients`          | GET, POST, PATCH, DELETE |                                                    |
| `radiology-orders`  | GET, POST, PATCH, DELETE |                                                    |
| `staff`             | GET, POST, PATCH, DELETE |                                                    |
| `charts`            | GET                      | Aggregated `{ revenueTrend, patientGrowth, departmentPerformance }` |
| `doctor-schedules`  | GET, POST                | Per-branch doctor schedules                        |
| `invoice-items`     | GET                      | Requires `?invoiceId=`                             |
| `patient-timeline`  | GET                      | Requires `?patientId=`                             |
| `settings`          | GET, POST                | Key-value app settings (DB wins per key)           |
| `users`             | GET, POST                | Login accounts merged with local demo users        |

All routes use the Supabase service-role client (`src/lib/supabase/admin.ts`) through mappers in `src/lib/supabase-data.ts`. Live data is pulled into the Zustand store on load via `loadFromSupabase()` (`src/store/app-store.ts`).

### Supabase schema

Authoritative table definitions live in `supabase/migrations/001_initial_hospital_schema.sql` (+ `002_add_findings_columns.sql`): `branches`, `users`, `patients`, `patient_timeline`, `doctors`, `appointments`, `beds`, `invoices`, `invoice_items`, `medicines`, `lab_tests`, `radiology_orders`, `insurance_claims`, `leads`, `campaigns`, `staff`, `inventory`, `notifications`, `audit_logs`, `medical_records`, `system_state`, `revenue_trend`, `patient_growth`, `department_performance`, with RLS enabled and service-role policies plus `updated_at` triggers.

---

## Scripts

| Script           | Command                                                                            | Description                          |
|------------------|------------------------------------------------------------------------------------|--------------------------------------|
| `dev`            | `next dev -p 3000`                                                                 | Start development server             |
| `build`          | `next build && cp -r ...`                                                          | Build & prepare standalone output    |
| `start`          | `NODE_ENV=production bun .next/standalone/server.js`                               | Start production server              |
| `lint`           | `eslint .`                                                                         | Run ESLint                           |
| `db:push`        | `prisma db push --accept-data-loss`                                                | Push schema to DB (dev)             |
| `db:generate`    | `prisma generate`                                                                  | Generate Prisma client               |
| `db:migrate`     | `prisma migrate dev`                                                               | Run migrations                       |
| `db:reset`       | `prisma migrate reset`                                                             | Reset database                       |
