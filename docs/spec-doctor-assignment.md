# Functional Specification — Doctor Assignment Module

**Version:** 1.0 · **Date:** 2026-08-25 · **Status:** Draft for review
**Applies to:** MediCore CRM (Next.js + Supabase)

---

## 1. Purpose

When any user assigns a doctor to a patient (OP registration, patient edit, or appointment booking),
the system must present **only doctors who are both qualified for the case and available at the
selected date and time**. Availability-aware filtering prevents double-bookings and invalid assignments
at the point of entry instead of being corrected after the fact.

## 2. Scope

| In scope | Out of scope |
|---|---|
| Filtering logic for all doctor-assignment interfaces | Rostering/payroll |
| Reusable assignment picker component | Leave-management workflows |
| Conflict detection against booked appointments | Telehealth scheduling engine |
| Persistence guarantees for assigned doctors | Billing changes |
| Override path with justification + audit trail | Notifications/reminders |

## 3. Definitions

| Term | Meaning |
|---|---|
| **Case requirement** | The department/specialty needed for the visit (e.g., Cardiology). Derived from the form's department/case selection; defaults to *General Medicine*. |
| **Qualified doctor** | A doctor whose `department` or `specialization` matches the case requirement. |
| **Available doctor** | Qualified AND scheduled for that weekday AND whose window covers the selected time AND without a conflicting booking. |
| **Conflicting booking** | An appointment for the same doctor on the same `date` whose `time` falls within the slot window (default ±30 min) with status `Scheduled`, `Checked-in`, or `In Consultation`. |
| **Staff-derived doctor** | A doctor sourced from a `staff` row (`role = 'Doctor'`), identified by id prefix `d-staff-*`; must be materialized into `doctors` before an assignment persists. |

## 4. Data model (current + required)

Existing columns are used as-is; nothing destructive is introduced.

| Table | Field | Used for |
|---|---|---|
| `doctors` / `staff` | `department`, `specialization` | Qualification match |
| `doctors` / `staff` | `consultation_fee` | Fee auto-fill on assignment |
| `doctors` / `staff` | `available_days TEXT[]` | Weekday schedule (Mon–Sun) |
| `doctors` / `staff` | `available_from`, `available_to TEXT` | Daily window `HH:MM`–`HH:MM` |
| `doctors` / `staff` | `shift` (`Morning`/`Evening`/`Night`) | Shift label; Night may cross midnight |
| `doctors` | `availability` | Status gate — excludes `On Leave`, `Off Duty` |
| `appointments` | `doctor_id`, `date`, `time`, `status` | Conflict detection |
| `patients` | `doctor_id`, `doctor_name`, `op_date`, `op_fees` | Assignment result |
| `app_settings` | `appointmentSlotMinutes` (proposed, default `30`) | Slot window for conflicts |

**Proposed additions (additive only):**
1. `app_settings` key `appointmentSlotMinutes`.
2. Optional `patients.case_department TEXT` when no department context exists on a form.

## 5. Functional requirements

### FR-1 Qualification filter
The picker shall display only doctors where
`case.department ∈ {doctor.department, doctor.specialization}` (case-insensitive).
If the active form provides no case department, the requirement defaults to *General Medicine*;
if zero qualified doctors exist, see FR-6 (fallback).

### FR-2 Availability filter
A qualified doctor is listed only if **all** hold:
1. `doctor.availability NOT IN ('On Leave', 'Off Duty')`
2. Weekday of the selected `date` ∈ `available_days` (empty array ⇒ treated as available every day, preserving legacy rows)
3. Selected `time` within `[available_from, available_to)`; **Night shift** windows ending ≤ start time (e.g., 22:00–06:00) wrap midnight
4. No conflicting booking (see §3) exists for that doctor/date/time-window

### FR-3 Conflict prevention
- Conflicts are computed against `appointments` for the branch, excluding statuses `Cancelled` and `No-show`.
- Doctors with conflicts remain visible but **disabled**, with reason “Booked at HH:MM” (preferred over hiding, so users understand scarcity).
- Booking submission re-validates server-side (`POST /api/appointments`) and rejects with HTTP 409 `SLOT_TAKEN` if a conflict appeared after render.

### FR-4 Integration across assignment surfaces
One shared component — **`DoctorAssignPicker`** — shall be used everywhere a doctor is assigned:

| Surface | File | Case-department source | Date/time source |
|---|---|---|---|
| Register Patient | `src/components/modules/patients.tsx` | Department/status context | OP Date (+ optional time input) |
| Edit Patient | same | Same | Existing `op_date` |
| Reception → New Registration | `src/components/modules/admin.tsx` | Department select (to be added) | OP Date |
| New Appointment | `src/components/modules/appointments.tsx` | Auto-filled from doctor, overridable | Date + Time fields |

Behavior contract for the component:
- Inputs: `caseDepartment`, `date`, `time`, `value`, `onChange`, `allowOverride`.
- Type-to-search (existing Popover + Command pattern), grouped: **Available** → **Fully booked** (disabled).
- Each item shows name, fee badge, days/times chip, and conflict reason when disabled.
- Selecting a doctor auto-fills fees from `consultation_fee` (editable afterwards).
- Empty result state lists the blocking reasons (“No Neurology doctor is scheduled on Sundays”).

### FR-5 Assignment persistence
- Patient forms save via `POST/PATCH /api/patients` storing `doctor_id`, `doctor_name`, `op_date`, `op_fees`.
- If the chosen doctor is staff-derived (`d-staff-*`), the client first calls `POST /api/doctors/ensure`
  (idempotent by email) and uses the returned real id — unchanged from current behavior.
- Appointments store the resolved real `doctor_id`.

### FR-6 Fallback & override
- **No qualified match:** offer nearest-match suggestions (same availability, different department) clearly labelled, plus “Continue without doctor”.
- **Emergency/admin override:** Admin roles may disable filters via an “Override” toggle; a mandatory reason is stored in `audit_logs` (`DOCTOR_ASSIGN_OVERRIDE`) with actor, patient, and filters bypassed.

### FR-7 Roles
- Assign/edit: Admin, Receptionist (patient-facing flows), and booking-capable roles for appointments (existing `canAddPatient` rules apply).
- Override toggle: Admin only.
- All roles read the same filtered list.

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Client-side filtering responds < 300 ms for 500 doctors (precompute per-render memo). |
| NFR-2 | Server re-validation is authoritative; client filter is advisory. |
| NFR-3 | All date/time handling uses `YYYY-MM-DD` and `HH:MM` strings, clinic-local (Asia/Kolkata); no UTC conversion drift. |
| NFR-4 | Picker is keyboard-navigable (Command list) and screen-reader labelled (combobox role). |
| NFR-5 | Staff-derived edits propagate to the merged doctor view immediately (merge-overrides-stale rule already in `use-branch-data.ts`). |

## 7. API contract (new/extended)

```
GET /api/doctors/available
  ?branch=Main%20Branch&date=2026-08-26&time=10:30&department=Cardiology&slotMinutes=30
→ 200 [{ id, name, consultationFee, availableDays, availableFrom, availableTo,
         shift, conflict?: { appointmentId, token, time } | null, qualified: true }]
   — returns qualified set; unqualified excluded; conflicts flagged not removed.

POST /api/appointments        → 201 | 409 { error: "SLOT_TAKEN", ... } (re-validates FR-3)
PATCH /api/patients           → validates doctor_id exists in `doctors` (400 otherwise)
```

## 8. Acceptance criteria

| # | Scenario | Expected |
|---|---|---|
| AC-1 | Case = Cardiology; two Cardiologists, one off-duty | Only the on-duty Cardiologist selectable |
| AC-2 | Selected Sunday, doctor’s `available_days = Mon–Fri` | Doctor hidden/disabled with reason |
| AC-3 | Time 10:30 outside window 14:00–17:00 | Excluded |
| AC-4 | Doctor already booked 10:15 (±30 min slot), request 10:30 | Visible but disabled, “Booked at 10:15” |
| AC-5 | Night shift 22:00–06:00, request 23:30 or 05:00 | Included (midnight wrap) |
| AC-6 | Staff-created doctor assigned in Registration | Row materialized via ensure; `patients.doctor_id` is a real `doctors.id` |
| AC-7 | Two users book same slot concurrently | Second submit receives 409 SLOT_TAKEN |
| AC-8 | Admin overrides with empty pool | Assignment saved; audit log written |
| AC-9 | Zero qualified doctors | Nearest-match section + “continue without doctor” shown |
| AC-10 | Fee auto-fill | Selecting ₹500 doctor fills OP Fees 500; editable; not overwritten after user edits |

## 9. Implementation plan (mapped to current codebase)

1. Add `GET /api/doctors/available` implementing §5-FR1..FR3 server-side (`src/lib/supabase-data.ts`).
2. Extract `DoctorAssignPicker` from the existing Popover+Command select in `appointments.tsx`; consume the new endpoint.
3. Replace the plain doctor `<Select>` in `patients.tsx` (register + edit) and `admin.tsx` (Reception dialog); add department/time context fields where missing.
4. Add `SLOT_TAKEN` re-validation inside `POST /api/appointments`.
5. Settings card: `appointmentSlotMinutes` next to the existing OP-expiry card.
6. Audit-log hook for overrides (`addAuditLog` action `DOCTOR_ASSIGN_OVERRIDE`).

## 10. Open questions

1. Should multi-specialty doctors (comma-separated `specialization`) qualify for each listed specialty? *(Assumed yes.)*
2. Maximum consultations per doctor per slot/day — hard cap or advisory warning? *(Assumed single booking per slot window initially.)*
3. Should future-dated OP registrations reserve the doctor’s slot in `appointments`, or record assignment only on `patients`? *(Assumed assignment-only until an appointment is booked.)*
