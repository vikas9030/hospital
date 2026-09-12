"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import {
  HeartPulse, Stethoscope, BedDouble, ClipboardList, Plus, Activity,
  AlertTriangle, UserCheck, Search, Thermometer,
} from "lucide-react";
import { canManageNursing, isAdmin, samePerson } from "@/lib/utils";
import type { Invoice, NurseAssignment, Patient, PatientCondition, VitalsEntry, FirstAidEntry } from "@/lib/types";
import {
  NURSE_ASSIGN_KEY, NURSE_FIRSTAID_KEY, vitalsKey, NURSE_WARDS,
  PATIENT_CONDITIONS, FIRSTAID_KINDS, parseAssignments, assignmentOf,
  parseVitals, parseFirstAid, conditionStyles, vitalsFlags,
} from "@/lib/nursing";

type Tab = "duties" | "check" | "beds" | "firstaid" | "assign";

const emptyVitals = { bpSys: "", bpDia: "", pulse: "", temp: "", spo2: "", sugar: "", condition: "Stable" as PatientCondition, notes: "" };

export function NursingModule() {
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const setAppSetting = useAppStore((s) => s.setAppSetting);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const updatePatient = useAppStore((s) => s.updatePatient);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const { patients, doctors, beds, staffMembers, branch, appointments } = useBranchData();
  const { toast } = useToast();

  const admin = isAdmin(currentUser.role);
  const isNurse = currentUser.role === "Nurse";
  const isDoctor = currentUser.role === "Doctor";
  const canWrite = canManageNursing(currentUser.role);

  const [tab, setTab] = useState<Tab>("duties");
  const [search, setSearch] = useState("");
  const [roundDate, setRoundDate] = useState("");
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [checkPatient, setCheckPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState(emptyVitals);
  const [assignDoctorId, setAssignDoctorId] = useState("");
  const [savingVitals, setSavingVitals] = useState(false);
  const [aidOpen, setAidOpen] = useState(false);
  const [aidPatientId, setAidPatientId] = useState("");
  const [aidKind, setAidKind] = useState<FirstAidEntry["kind"]>("Dressing");
  const [aidBedId, setAidBedId] = useState("");
  const [aidNotes, setAidNotes] = useState("");
  const [aidWalkIn, setAidWalkIn] = useState(false);
  const [aidCustomName, setAidCustomName] = useState("");
  const [aidAmount, setAidAmount] = useState("150");
  const [aidCollected, setAidCollected] = useState("");
  const [aidPayMethod, setAidPayMethod] = useState("Cash");
  const [savingAid, setSavingAid] = useState(false);
  const [editNurseId, setEditNurseId] = useState("");
  const [draftDoctors, setDraftDoctors] = useState<string[]>([]);
  const [draftWards, setDraftWards] = useState<string[]>([]);
  const [draftBeds, setDraftBeds] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);
  const [assignSavedAt, setAssignSavedAt] = useState<string | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState<string | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [loadedOnce, setLoadedOnce] = useState(false);

  const nurses = useMemo(() => staffMembers.filter((s) => s.role === "Nurse"), [staffMembers]);

  // ---- Backend tables (014) with settings fallback when offline / unmigrated ----
  const [assignRows, setAssignRows] = useState<NurseAssignment[]>([]);
  const [vitalsRows, setVitalsRows] = useState<VitalsEntry[]>([]);
  const [aidRows, setAidRows] = useState<FirstAidEntry[]>([]);
  const [backendOn, setBackendOn] = useState({ assign: false, vitals: false, aid: false });

  useEffect(() => {
    let live = true;
    (async () => {
      const b = encodeURIComponent(branch || "");
      try {
        const r = await fetch(`/api/nurse-assignments?branch=${b}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setAssignRows(data);
          setBackendOn((s) => ({ ...s, assign: true }));
        }
      } catch { /* legacy settings fallback below */ }
      try {
        const r = await fetch(`/api/nurse-vitals?branch=${b}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setVitalsRows(data);
          setBackendOn((s) => ({ ...s, vitals: true }));
        }
      } catch { /* legacy fallback */ }
      try {
        const r = await fetch(`/api/nurse-firstaid?branch=${b}`);
        if (!r.ok) throw new Error();
        const data = await r.json();
        if (live && Array.isArray(data)) {
          setAidRows(data);
          setBackendOn((s) => ({ ...s, aid: true }));
        }
      } catch { /* legacy fallback */ }
      if (live) setLoadedOnce(true);
    })();
    return () => { live = false; };
  }, [branch, loadTick]);

  // Legacy synced-settings copies (pre-backend + offline mirror). Backend
  // rows always win per key; legacy fills the gaps so a refresh can never
  // erase what was saved from either store.
  const legacyAssign = useMemo(() => parseAssignments(settings[NURSE_ASSIGN_KEY]), [settings]);

  const assignments = useMemo(() => {
    const rec: Record<string, { doctors: string[]; wards: string[]; beds: string[] }> = { ...legacyAssign };
    if (backendOn.assign) {
      for (const a of assignRows) rec[a.nurseId] = { doctors: a.doctorIds, wards: a.wards, beds: a.bedIds };
    }
    return rec;
  }, [legacyAssign, backendOn.assign, assignRows]);

  const vitalsFor = (patientId: string): VitalsEntry[] => {
    const legacy = parseVitals(settings[vitalsKey(patientId)]);
    if (!backendOn.vitals) return legacy;
    const fromDb = vitalsRows.filter((v) => v.patientId === patientId);
    const seen = new Set(fromDb.map((v) => v.id));
    return [...fromDb, ...legacy.filter((v) => !seen.has(v.id))].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  };

  const firstAidLog = useMemo(() => {
    const legacy = parseFirstAid(settings[NURSE_FIRSTAID_KEY]);
    if (!backendOn.aid) return legacy;
    const seen = new Set(aidRows.map((f) => f.id));
    return [...aidRows, ...legacy.filter((f) => !seen.has(f.id))].sort((a, b) => String(b.at).localeCompare(String(a.at)));
  }, [backendOn.aid, aidRows, settings]);

  async function postJSON(url: string, payload: unknown): Promise<any> {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.error || "Request failed.");
    }
    return res.json();
  }

  const myStaff = useMemo(
    () => staffMembers.find((s) => (s.email || "").toLowerCase() === (currentUser.email || "").toLowerCase()),
    [staffMembers, currentUser.email]
  );
  const myAssign = myStaff ? assignmentOf(assignments, myStaff.id) : assignmentOf(assignments, "");
  const myDoctorIds = isNurse ? myAssign.doctorIds : [];
  const myDoctors = useMemo(() => doctors.filter((d) => myDoctorIds.includes(d.id)), [doctors, myDoctorIds]);
  const myBedIds = isNurse ? myAssign.bedIds : [];
  const myBedPatientIds = useMemo(
    () => new Set(beds.filter((b) => myBedIds.includes(b.id) || myAssign.wards.includes(b.ward)).map((b) => b.patientId).filter(Boolean) as string[]),
    [beds, myBedIds, myAssign.wards]
  );

  // Patients this viewer is responsible for. Nurses match by doctor id AND
  // by doctor name (older rows only carry a name, e.g. "Dr. vinay").
  const doctorMatches = (p: Patient, docIds: string[], docs: { id: string; name: string }[]) =>
    (p.doctorId && docIds.includes(p.doctorId)) ||
    (!!p.doctorName && docs.some((d) => samePerson(d.name, p.doctorName)));

  const scopePatients = useMemo(() => {
    if (admin) return patients;
    if (isNurse) {
      const list = patients.filter((p) => doctorMatches(p, myDoctorIds, myDoctors) || myBedPatientIds.has(p.id));
      return [...list].sort((a, b) => (a.status === "Admitted" ? -1 : 1));
    }
    if (isDoctor) {
      const me = doctors.find((d) => (d.email || "").toLowerCase() === (currentUser.email || "").toLowerCase());
      if (!me) return [];
      return patients.filter((p) => p.doctorId === me.id || samePerson(p.doctorName, me.name));
    }
    return [];
  }, [admin, isNurse, isDoctor, patients, myDoctorIds, myDoctors, myBedPatientIds, doctors, currentUser.email]);

  const latestVitals = useMemo(() => {
    const map = new Map<string, VitalsEntry>();
    for (const p of scopePatients) {
      const v = vitalsFor(p.id)[0];
      if (v) map.set(p.id, v);
    }
    return map;
  }, [scopePatients, vitalsRows, backendOn.vitals, settings]);

  const criticalCount = useMemo(
    () => scopePatients.filter((p) => latestVitals.get(p.id)?.condition === "Critical").length,
    [scopePatients, latestVitals]
  );
  const admittedCount = useMemo(() => scopePatients.filter((p) => p.status === "Admitted").length, [scopePatients]);
  const uncheckedCount = useMemo(() => scopePatients.filter((p) => !latestVitals.has(p.id)).length, [scopePatients, latestVitals]);

  // Appointments per patient (for day-wise rounds + date chips on cards).
  const apptsByPatient = useMemo(() => {
    const map = new Map<string, { date: string; time: string; status: string; token: string }[]>();
    for (const a of appointments) {
      if (!a.patientId || !a.date) continue;
      const list = map.get(a.patientId) ?? [];
      list.push({ date: a.date, time: a.time ?? "", status: a.status ?? "", token: a.token ?? "" });
      map.set(a.patientId, list);
    }
    for (const list of map.values()) list.sort((x, y) => (x.date + x.time).localeCompare(y.date + y.time));
    return map;
  }, [appointments]);

  const bedOf = (patientId: string) => beds.find((b) => b.patientId === patientId);

  const filtered = scopePatients.filter((p) => {
    if (roundDate && !apptsByPatient.get(p.id)?.some((a) => a.date === roundDate)) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.name} ${p.uhid} ${p.phone} ${p.status} ${p.doctorName ?? ""}`.toLowerCase().includes(q);
  });

  const audit = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "nursing", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "nursing", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };

  const openCheck = (p: Patient) => {
    setCheckPatient(p);
    setVitals(emptyVitals);
    setAssignDoctorId(p.doctorId ?? "");
  };

  const saveVitals = async () => {
    if (!checkPatient || !canWrite) return;
    setSavingVitals(true);
    try {
      const entry: VitalsEntry = {
        id: `v${Date.now()}`,
        patientId: checkPatient.id,
        patientName: checkPatient.name,
        nurseId: myStaff?.id ?? "admin",
        nurse: currentUser.name,
        at: new Date().toISOString(),
        bpSys: vitals.bpSys.trim(),
        bpDia: vitals.bpDia.trim(),
        pulse: vitals.pulse.trim(),
        temp: vitals.temp.trim(),
        spo2: vitals.spo2.trim(),
        sugar: vitals.sugar.trim(),
        condition: vitals.condition,
        notes: vitals.notes.trim(),
        branch,
      };
      let wroteBackend = false;
      if (backendOn.vitals) {
        try {
          const saved = await postJSON("/api/nurse-vitals", entry);
          setVitalsRows((rows) => [saved, ...rows]);
          wroteBackend = true;
        } catch {
          setBackendOn((s) => ({ ...s, vitals: false }));
        }
      }
      // Always mirror to synced settings so the entry survives any refresh.
      const next = [entry, ...parseVitals(settings[vitalsKey(checkPatient.id)]).filter((v) => v.id !== entry.id)].slice(0, 50);
      const mirror = await setAppSetting(vitalsKey(checkPatient.id), JSON.stringify(next));
      if (!wroteBackend && mirror && mirror.ok === false) throw new Error(mirror.error || "Failed to save.");
      const flags = vitalsFlags(entry);
      audit("NURSE_PATIENT_CHECK", `${currentUser.name} checked ${checkPatient.name}: ${entry.condition}${flags.length ? ` (alert: ${flags.join(", ")})` : ""}.`);
      toast({
        title: "Patient checked",
        description: flags.length ? `${checkPatient.name} marked ${entry.condition} — alert: ${flags.join(", ")}` : `${checkPatient.name} marked ${entry.condition}.`,
        variant: entry.condition === "Critical" || flags.length > 0 ? "destructive" : undefined,
      });
      setCheckPatient(null);
    } catch (e: any) {
      toast({ title: "Could not save check", description: e.message, variant: "destructive" });
    } finally {
      setSavingVitals(false);
    }
  };

  const saveDoctorAssignment = async () => {
    if (!checkPatient || !assignDoctorId) return;
    const doc = doctors.find((d) => d.id === assignDoctorId);
    if (!doc) return;
    updatePatient(checkPatient.id, { doctorId: doc.id, doctorName: doc.name });
    try {
      await fetch("/api/patients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkPatient.id, doctorId: doc.id, doctorName: doc.name }),
      });
    } catch {
      // Local assignment stands; server sync is best-effort.
    }
    audit("NURSE_DOCTOR_ASSIGN", `${currentUser.name} assigned ${checkPatient.name} to ${doc.name}.`);
    toast({ title: "Doctor assigned", description: `${checkPatient.name} → ${doc.name}.` });
    setCheckPatient({ ...checkPatient, doctorId: doc.id, doctorName: doc.name });
  };

  const saveFirstAid = async () => {
    const linked = aidWalkIn ? undefined : patients.find((p) => p.id === aidPatientId);
    const displayName = aidWalkIn ? aidCustomName.trim() : linked?.name ?? "";
    if (!displayName) {
      toast({ title: aidWalkIn ? "Enter a name" : "Pick a patient", description: aidWalkIn ? "Type the walk-in patient's name." : "Select who received first aid.", variant: "destructive" });
      return;
    }
    const amount = Math.max(0, parseFloat(aidAmount) || 0);
    const collected = Math.min(amount, Math.max(0, parseFloat(aidCollected) || 0));
    setSavingAid(true);
    try {
      const bed = beds.find((b) => b.id === aidBedId);
      const base: FirstAidEntry = {
        id: `fa${Date.now()}`,
        patientId: linked?.id ?? "",
        patientName: displayName,
        customName: aidWalkIn ? displayName : "",
        nurseId: myStaff?.id ?? "admin",
        nurse: currentUser.name,
        at: new Date().toISOString(),
        kind: aidKind,
        bedId: bed?.id,
        bedNumber: bed?.number,
        notes: aidNotes.trim(),
        amount,
        paidAmount: collected,
        branch,
      };
      let saved: FirstAidEntry = base;
      let wroteBackend = false;
      if (backendOn.aid) {
        try {
          saved = await postJSON("/api/nurse-firstaid", base);
          setAidRows((rows) => [saved, ...rows]);
          wroteBackend = true;
        } catch {
          setBackendOn((s) => ({ ...s, aid: false }));
        }
      }
      // Always mirror to synced settings so the entry survives any refresh.
      const mirrorNext = [saved.id === base.id ? base : saved, ...parseFirstAid(settings[NURSE_FIRSTAID_KEY]).filter((f) => f.id !== base.id)].slice(0, 200);
      const mirror = await setAppSetting(NURSE_FIRSTAID_KEY, JSON.stringify(mirrorNext));
      if (!wroteBackend && mirror && mirror.ok === false) throw new Error(mirror.error || "Failed to save.");
      // Bill the charge so it counts in Billing; collection updates the bill too.
      if (amount > 0) {
        const today = new Date().toISOString().split("T")[0];
        const invoice: Invoice = {
          id: `inv${Date.now()}`,
          invoiceNo: "",
          patientId: linked?.id ?? "",
          patientName: displayName,
          date: today,
          dueDate: today,
          items: [{ description: `First Aid — ${aidKind}${bed ? ` (Bed ${bed.number})` : ""}`, category: "Other", quantity: 1, rate: amount, amount }],
          subtotal: amount,
          tax: 0,
          discount: 0,
          total: amount,
          paidAmount: collected,
          status: collected >= amount ? "Paid" : collected > 0 ? "Partial" : "Pending",
          paymentMethod: collected > 0 ? aidPayMethod : undefined,
          branch,
          paidDate: collected > 0 ? today : undefined,
        };
        try {
          const created = await postJSON("/api/invoices", invoice);
          addInvoice(created);
          if (backendOn.aid) {
            try {
              const updated = await (await fetch("/api/nurse-firstaid", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: saved.id, invoiceId: created.id, paidAmount: collected }),
              })).json();
              if (updated?.id) setAidRows((rows) => rows.map((r) => (r.id === saved.id ? updated : r)));
            } catch { /* entry + bill both saved; link is best-effort */ }
          }
          audit("NURSE_FIRSTAID_BILLED", `${currentUser.name} billed ₹${amount.toLocaleString("en-IN")} for ${aidKind} (${displayName}); collected ₹${collected.toLocaleString("en-IN")}.`);
        } catch {
          toast({ title: "Entry saved, billing failed", description: "First aid is logged but the bill could not be created. Create it from Billing.", variant: "destructive" });
        }
      }
      audit("NURSE_FIRSTAID", `${currentUser.name} gave ${aidKind} to ${displayName}${bed ? ` (bed ${bed.number})` : ""}${amount > 0 ? ` — ₹${amount.toLocaleString("en-IN")} billed, counts in Billing` : ""}.`);
      toast({ title: "First aid logged", description: amount > 0 ? `${aidKind} for ${displayName} — ₹${amount.toLocaleString("en-IN")} billed.` : `${aidKind} recorded for ${displayName}.` });
      setAidOpen(false);
      setAidPatientId("");
      setAidCustomName("");
      setAidNotes("");
      setAidBedId("");
      setAidAmount("150");
      setAidCollected("");
    } finally {
      setSavingAid(false);
    }
  };

  const openAssignEditor = (nurseId: string) => {
    setEditNurseId(nurseId);
    setAssignSavedAt(null);
    const a = assignmentOf(assignments, nurseId);
    setDraftDoctors(a.doctorIds);
    setDraftWards(a.wards);
    setDraftBeds(a.bedIds);
  };

  const saveAssignment = async () => {
    if (!editNurseId || savingAssign) return;
    const nurse = nurses.find((n) => n.id === editNurseId);
    setSavingAssign(true);
    setAssignSavedAt(null);
    try {
      // Backend table first (now live), then always mirror to synced
      // settings — either store alone is enough to survive a refresh.
      let wroteBackend = false;
      try {
        const saved = await postJSON("/api/nurse-assignments", {
          nurseId: editNurseId,
          nurseName: nurse?.name ?? "",
          doctorIds: draftDoctors,
          wards: draftWards,
          bedIds: draftBeds,
          branch,
        });
        setAssignRows((rows) => {
          const rest = rows.filter((r) => r.nurseId !== editNurseId);
          return [...rest, saved];
        });
        setBackendOn((s) => ({ ...s, assign: true }));
        wroteBackend = true;
      } catch {
        setBackendOn((s) => ({ ...s, assign: false }));
      }
      const next = {
        ...legacyAssign,
        [editNurseId]: { doctors: draftDoctors, wards: draftWards, beds: draftBeds },
      };
      const mirror = await setAppSetting(NURSE_ASSIGN_KEY, JSON.stringify(next));
      if (!wroteBackend && mirror && mirror.ok === false) throw new Error(mirror.error || "Failed to save.");
      // Editor stays open on the saved values — no re-picking needed.
      setAssignSavedAt(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      audit("NURSE_ASSIGN", `${currentUser.name} assigned nurse ${nurse?.name ?? editNurseId}: ${draftDoctors.length} doctor(s), ${draftWards.length} ward(s), ${draftBeds.length} bed(s).`);
      toast({ title: "Assignment saved", description: `${nurse?.name ?? "Nurse"} covers ${draftDoctors.length} doctor(s), ${draftWards.length} ward(s), ${draftBeds.length} bed(s).` });
    } catch (e: any) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
    } finally {
      setSavingAssign(false);
    }
  };

  const toggleIn = (list: string[], v: string, set: (x: string[]) => void) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const requestUnassign = (nurseId: string) => {
    if (confirmUnassign !== nurseId) {
      setConfirmUnassign(nurseId);
      setTimeout(() => setConfirmUnassign((c) => (c === nurseId ? null : c)), 3500);
      return;
    }
    setConfirmUnassign(null);
    void doUnassign(nurseId);
  };

  const doUnassign = async (nurseId: string) => {
    const nurse = nurses.find((n) => n.id === nurseId);
    try {
      try {
        const saved = await postJSON("/api/nurse-assignments", {
          nurseId,
          nurseName: nurse?.name ?? "",
          doctorIds: [],
          wards: [],
          bedIds: [],
          branch,
        });
        setAssignRows((rows) => {
          const rest = rows.filter((r) => r.nurseId !== nurseId);
          return [...rest, saved];
        });
        setBackendOn((s) => ({ ...s, assign: true }));
      } catch {
        const next = { ...legacyAssign, [nurseId]: { doctors: [], wards: [], beds: [] } };
        await setAppSetting(NURSE_ASSIGN_KEY, JSON.stringify(next));
        setBackendOn((s) => ({ ...s, assign: false }));
      }
      if (editNurseId === nurseId) openAssignEditor(nurseId);
      audit("NURSE_UNASSIGN", `${currentUser.name} cleared all assignments for nurse ${nurse?.name ?? nurseId}.`);
      toast({ title: "Nurse unassigned", description: `${nurse?.name ?? "Nurse"} has no doctors, wards or beds now. Re-assign anytime with Edit.` });
    } catch (e: any) {
      toast({ title: "Could not unassign", description: e.message, variant: "destructive" });
    }
  };

  const tabs: { id: Tab; label: string; adminOnly?: boolean }[] = [
    { id: "duties", label: "My Duties" },
    { id: "check", label: "Check Patient" },
    { id: "beds", label: "Beds & Wards" },
    { id: "firstaid", label: "First Aid" },
    { id: "assign", label: "Assign Nurses", adminOnly: true },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <PageHeader
        title="Nursing Station"
        description={admin ? "Assign nurses to doctors, wards and beds — review checks, vitals and first-aid." : isNurse ? "Your doctors, wards, beds and patients — check status, record vitals, log first aid." : "Your patients' nurse checks, vitals and bedside care."}
        icon={HeartPulse}
        action={canWrite ? <Button size="sm" className="gap-1.5 text-xs sm:text-sm" onClick={() => setAidOpen(true)}><Plus className="h-3.5 w-3.5" /> Log First Aid</Button> : undefined}
      />

      {loadedOnce && (!backendOn.assign || !backendOn.vitals || !backendOn.aid) && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 flex flex-wrap items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
          <p className="text-xs flex-1 min-w-[200px]">
            Backend nursing tables are not reachable ({["assignments", "vitals", "first-aid"].filter((k, i) => ![backendOn.assign, backendOn.vitals, backendOn.aid][i]).join(", ")} offline) — data is kept in synced settings for now.
            Run <span className="font-mono">supabase/migrations/014_nursing_tables.sql</span> in Supabase for permanent database storage.
          </p>
          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => { setLoadedOnce(false); setLoadTick((t) => t + 1); }}>Retry</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 sm:gap-4 md:grid-cols-4">
        <StatCard title={admin ? "Nurses" : "My Doctors"} value={admin ? String(nurses.length) : String(myDoctors.length)} icon={Stethoscope} color="primary" />
        <StatCard title="Patients in Scope" value={String(scopePatients.length)} icon={UserCheck} color="info" subtitle={`${admittedCount} admitted`} />
        <StatCard title="Critical" value={String(criticalCount)} icon={AlertTriangle} color="destructive" />
        <StatCard title="Not Checked Yet" value={String(uncheckedCount)} icon={ClipboardList} color="warning" />
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {tabs.filter((t) => !t.adminOnly || admin).map((t) => (
          <Button key={t.id} size="sm" variant={tab === t.id ? "default" : "outline"} className="text-xs" onClick={() => setTab(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "duties" && (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Stethoscope className="h-4 w-4 text-primary" /> {admin ? "Doctor → Nurse Coverage" : isNurse ? "My Doctors" : "Assigned Nurses"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {admin ? (
                nurses.length === 0 ? <p className="text-xs text-muted-foreground">No nurses on staff yet.</p> :
                nurses.map((n) => {
                  const a = assignmentOf(assignments, n.id);
                  const names = a.doctorIds.map((id) => doctors.find((d) => d.id === id)?.name ?? "—").filter(Boolean);
                  const isAssigned = a.doctorIds.length > 0 || a.wards.length > 0 || a.bedIds.length > 0;
                  return (
                    <div key={n.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {n.name} <span className="font-normal text-muted-foreground">• {n.shift} shift</span>{" "}
                          {isAssigned ? (
                            <Badge className="ml-1 text-[10px] bg-success/15 text-success border-success/30 align-middle">Assigned</Badge>
                          ) : (
                            <Badge variant="outline" className="ml-1 text-[10px] text-muted-foreground align-middle">Not assigned</Badge>
                          )}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {names.length ? names.join(", ") : "No doctors"} • {a.wards.length ? a.wards.join(", ") : "No wards"} • {a.bedIds.length} bed(s)
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] shrink-0" onClick={() => { openAssignEditor(n.id); setTab("assign"); }}>
                        {isAssigned ? "Edit" : "Assign"}
                      </Button>
                    </div>
                  );
                })
              ) : isNurse ? (
                myDoctors.length === 0 ? <p className="text-xs text-muted-foreground">No doctors assigned yet — ask Admin to assign you in the Assign Nurses tab.</p> :
                myDoctors.map((d) => (
                  <div key={d.id} className="flex items-center gap-2 rounded-lg border p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{d.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{d.specialization} • {d.department}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{patients.filter((p) => p.doctorId === d.id).length} patients</Badge>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">Nurse checks for your patients appear under Check Patient.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BedDouble className="h-4 w-4 text-primary" /> {admin ? "Ward Coverage" : "My Wards & Beds"}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {admin ? (
                NURSE_WARDS.map((w) => {
                  const covering = nurses.filter((n) => (assignments[n.id]?.wards ?? []).includes(w));
                  const occupied = beds.filter((b) => b.ward === w && b.status === "Occupied").length;
                  return (
                    <div key={w} className="flex items-center gap-2 rounded-lg border p-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{w}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{covering.length ? covering.map((n) => n.name).join(", ") : "No nurse assigned"} • {occupied} occupied</p>
                      </div>
                    </div>
                  );
                })
              ) : isNurse ? (
                myAssign.wards.length === 0 && myBedIds.length === 0 ? <p className="text-xs text-muted-foreground">No wards or beds assigned yet.</p> :
                <>
                  {myAssign.wards.map((w) => (
                    <div key={w} className="rounded-lg border p-2.5"><p className="text-xs font-semibold">{w}</p><p className="text-[11px] text-muted-foreground">{beds.filter((b) => b.ward === w && b.status === "Occupied").length} occupied beds</p></div>
                  ))}
                  {myBedIds.map((id) => {
                    const b = beds.find((x) => x.id === id);
                    if (!b) return null;
                    return (
                      <div key={id} className="rounded-lg border p-2.5"><p className="text-xs font-semibold">Bed {b.number} <span className="font-normal text-muted-foreground">• {b.ward} • {b.status}</span></p>
                      {b.patientName && <p className="text-[11px] text-muted-foreground">{b.patientName}</p>}</div>
                    );
                  })}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Bedside coverage is managed by Admin.</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "check" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="flex flex-wrap items-end gap-2 mb-3">
              <div className="relative flex-1 min-w-[180px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search name, UHID, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
              </div>
              <div className="flex items-center gap-1.5">
                <Input type="date" className="h-9 text-xs w-[150px]" value={roundDate} onChange={(e) => setRoundDate(e.target.value)} title="Rounds date — show patients with appointments that day" />
                <Button size="sm" variant="outline" className="h-9 text-[11px]" onClick={() => setRoundDate(todayStr)}>Today</Button>
                {roundDate && <Button size="sm" variant="ghost" className="h-9 text-[11px]" onClick={() => setRoundDate("")}>All days ×</Button>}
              </div>
            </div>
            {roundDate && <p className="text-xs font-medium mb-2">Rounds for {roundDate} — {filtered.length} patient{filtered.length === 1 ? "" : "s"} with appointments that day.</p>}
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">{scopePatients.length === 0 ? "No patients in your scope yet." : roundDate ? "None of your patients have an appointment on this date." : "No patients match this search."}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => {
                  const last = latestVitals.get(p.id);
                  const flags = last ? vitalsFlags(last) : [];
                  const bed = bedOf(p.id);
                  const appts = apptsByPatient.get(p.id) ?? [];
                  const hasToday = appts.some((a) => a.date === todayStr);
                  const upcoming = appts.filter((a) => a.date >= todayStr).slice(0, 3);
                  return (
                    <div key={p.id} className="rounded-lg border p-3 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate flex-1">{p.name}</p>
                        {last ? (
                          <Badge variant="outline" className={`text-[10px] ${conditionStyles(last.condition)}`}>{last.condition}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Unchecked</Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{p.uhid} • {p.status} • Dr. {p.doctorName || "—"}</p>
                      <div className="flex flex-wrap gap-1">
                        {bed && <Badge variant="outline" className="text-[10px]"><BedDouble className="h-2.5 w-2.5 mr-1" />Bed {bed.number} • {bed.ward}</Badge>}
                        {hasToday && <Badge className="text-[10px] bg-info/15 text-info border-info/30">Appointment today</Badge>}
                        {upcoming.filter((a) => a.date !== todayStr).map((a, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] text-muted-foreground">{a.date}{a.time ? ` ${a.time}` : ""}</Badge>
                        ))}
                      </div>
                      {last ? (
                        <p className="text-[11px] text-muted-foreground">
                          {last.bpSys && last.bpDia ? `BP ${last.bpSys}/${last.bpDia} ` : ""}{last.pulse ? `Pulse ${last.pulse} ` : ""}{last.temp ? `Temp ${last.temp}°F ` : ""}{last.spo2 ? `SpO₂ ${last.spo2}% ` : ""}
                          <span className="opacity-70">• {new Date(last.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} by {last.nurse}</span>
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">No vitals recorded yet.</p>
                      )}
                      {flags.length > 0 && <p className="text-[11px] font-semibold text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {flags.join(" • ")}</p>}
                      {canWrite && <Button size="sm" variant="outline" className="h-7 text-[11px] w-full" onClick={() => openCheck(p)}><Thermometer className="h-3 w-3 mr-1" /> Check Status</Button>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "beds" && (
        <Card>
          <CardContent className="p-3 sm:p-4">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(admin ? beds : beds.filter((b) => myBedIds.includes(b.id) || myAssign.wards.includes(b.ward))).map((b) => {
                const covering = nurses.filter((n) => (assignments[n.id]?.beds ?? []).includes(b.id) || (assignments[n.id]?.wards ?? []).includes(b.ward));
                const patient = b.patientId ? patients.find((p) => p.id === b.patientId) : null;
                const direct = !admin && myBedIds.includes(b.id);
                return (
                  <div key={b.id} className="rounded-lg border p-3 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <BedDouble className="h-4 w-4 text-primary" />
                      <p className="text-sm font-semibold flex-1">Bed {b.number} • {b.ward}</p>
                      <Badge variant="outline" className="text-[10px]">{b.status}</Badge>
                    </div>
                    {direct && <Badge variant="outline" className="text-[10px] text-primary border-primary/30 w-fit">{myAssign.wards.includes(b.ward) ? `Via your ${b.ward} duty + direct pick` : "Direct pick — outside your wards"}</Badge>}
                    <p className="text-[11px] text-muted-foreground">{b.patientName || "Empty"}{b.doctorName ? ` • Dr. ${b.doctorName}` : ""}</p>
                    <p className="text-[11px] text-muted-foreground">Nurse: {covering.length ? covering.map((n) => n.name).join(", ") : "—"}</p>
                    {patient && canWrite && <Button size="sm" variant="outline" className="h-7 text-[11px] w-full" onClick={() => openCheck(patient)}>Check this patient</Button>}
                  </div>
                );
              })}
            </div>
            {!admin && myBedIds.length === 0 && myAssign.wards.length === 0 && (
              <p className="py-6 text-center text-xs text-muted-foreground">No beds assigned to you yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "firstaid" && (
        <Card>
          <CardContent className="p-3 sm:p-4 space-y-2">
            {(admin ? firstAidLog : firstAidLog.filter((f) => f.nurseId === myStaff?.id || f.nurse === currentUser.name)).slice(0, 50).map((f) => {
              const amt = f.amount ?? 0;
              const paid = f.paidAmount ?? 0;
              const due = Math.max(0, amt - paid);
              return (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold">{f.kind} → {f.patientName || f.customName || "—"} {f.bedNumber ? <span className="font-normal text-muted-foreground">(bed {f.bedNumber})</span> : null}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{f.notes || "No notes"} • {f.nurse} • {new Date(f.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  {amt > 0 ? (
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold">₹{amt.toLocaleString("en-IN")}</p>
                      {due <= 0 ? (
                        <Badge variant="outline" className="text-[10px] text-success border-success/30">Paid{f.invoiceId ? " • billed" : ""}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-warning border-warning/30">Due ₹{due.toLocaleString("en-IN")}</Badge>
                      )}
                    </div>
                  ) : (
                    <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Free care</Badge>
                  )}
                </div>
              );
            })}
            {firstAidLog.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No first-aid entries yet.</p>}
          </CardContent>
        </Card>
      )}

      {tab === "assign" && admin && (
        <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Nurses</CardTitle><CardDescription className="text-xs">Pick a nurse, then tick their doctors, wards and beds.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {nurses.length === 0 && <p className="text-xs text-muted-foreground">No nurses on staff — add one in Staff first.</p>}
              {nurses.map((n) => {
                const a = assignmentOf(assignments, n.id);
                const isAssigned = a.doctorIds.length > 0 || a.wards.length > 0 || a.bedIds.length > 0;
                const docNames = a.doctorIds.map((id) => doctors.find((d) => d.id === id)?.name ?? "—");
                const bedNums = a.bedIds.map((id) => beds.find((b) => b.id === id)?.number ?? "?");
                return (
                  <div key={n.id} className={`rounded-lg border p-2.5 transition-colors ${editNurseId === n.id ? "border-primary bg-primary/5" : ""}`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate">{n.name} <span className="font-normal text-muted-foreground">• {n.shift} • {n.department}</span></p>
                        {isAssigned ? (
                          <p className="text-[11px] text-muted-foreground truncate" title={`${docNames.join(", ") || "—"} | ${a.wards.join(", ") || "—"} | Beds ${bedNums.join(", ") || "—"}`}>
                            {docNames.slice(0, 2).join(", ") || "—"}{docNames.length > 2 ? ` +${docNames.length - 2}` : ""} • {a.wards.slice(0, 2).join(", ") || "—"}{a.wards.length > 2 ? ` +${a.wards.length - 2}` : ""} • {bedNums.length ? `Beds ${bedNums.join(", ")}` : "no beds"}
                          </p>
                        ) : (
                          <p className="text-[11px] text-muted-foreground">Nothing assigned yet.</p>
                        )}
                      </div>
                      {isAssigned ? (
                        <Badge className="text-[10px] bg-success/15 text-success border-success/30 shrink-0">Assigned</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground shrink-0">Not assigned</Badge>
                      )}
                    </div>
                    <div className="flex gap-1.5 mt-2">
                      <Button size="sm" variant={editNurseId === n.id ? "secondary" : "outline"} className="h-7 flex-1 text-[11px]" onClick={() => openAssignEditor(n.id)}>
                        {isAssigned ? "Edit assignment" : "Assign now"}
                      </Button>
                      {isAssigned && (
                        <Button
                          size="sm" variant="ghost" className={`h-7 text-[11px] shrink-0 ${confirmUnassign === n.id ? "text-destructive" : "text-muted-foreground"}`}
                          onClick={() => requestUnassign(n.id)}
                        >
                          {confirmUnassign === n.id ? "Confirm unassign?" : "Unassign"}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Assignment {editNurseId ? `— ${nurses.find((n) => n.id === editNurseId)?.name}` : ""}</CardTitle>
              {editNurseId && (() => {
                const cur = assignmentOf(assignments, editNurseId);
                const has = cur.doctorIds.length > 0 || cur.wards.length > 0 || cur.bedIds.length > 0;
                return has ? (
                  <CardDescription className="text-xs">
                    Currently: {cur.doctorIds.map((id) => doctors.find((d) => d.id === id)?.name ?? "?").join(", ") || "no doctors"} • {cur.wards.join(", ") || "no wards"} • {cur.bedIds.map((id) => beds.find((b) => b.id === id)?.number ?? "?").join(", ") ? `Beds ${cur.bedIds.map((id) => beds.find((b) => b.id === id)?.number ?? "?").join(", ")}` : "no beds"} — change ticks below and Save.
                  </CardDescription>
                ) : (
                  <CardDescription className="text-xs">Not assigned yet — tick doctors, wards and beds, then Save.</CardDescription>
                );
              })()}
            </CardHeader>
            <CardContent className="space-y-3">
              {!editNurseId ? (
                <p className="text-xs text-muted-foreground">Select a nurse to assign doctors, wards and beds — like assigning hospitality beds to floor staff.</p>
              ) : (
                <>
                  <div>
                    <Label className="text-xs font-semibold">Doctors ({draftDoctors.length})</Label>
                    <div className="grid gap-1.5 mt-1.5 max-h-44 overflow-y-auto pr-1">
                      {doctors.map((d) => (
                        <label key={d.id} className="flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer hover:bg-muted/40">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftDoctors.includes(d.id)} onChange={() => toggleIn(draftDoctors, d.id, setDraftDoctors)} />
                          <span className="flex-1">{d.name} <span className="text-muted-foreground">• {d.specialization}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Wards ({draftWards.length})</Label>
                    <div className="grid grid-cols-2 gap-1.5 mt-1.5">
                      {NURSE_WARDS.map((w) => (
                        <label key={w} className="flex items-center gap-2 rounded-lg border p-2 text-xs cursor-pointer hover:bg-muted/40">
                          <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftWards.includes(w)} onChange={() => toggleIn(draftWards, w, setDraftWards)} />
                          <span className="flex-1">{w}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs font-semibold">Specific beds ({draftBeds.length})</Label>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Beds are grouped by their current ward — a bed stays assigned even if its ward later changes.</p>
                    <div className="grid gap-2 mt-1.5 max-h-56 overflow-y-auto pr-1">
                      {NURSE_WARDS.map((w) => {
                        const wardBeds = beds.filter((b) => b.ward === w);
                        if (wardBeds.length === 0) return null;
                        const picked = wardBeds.filter((b) => draftBeds.includes(b.id)).length;
                        return (
                          <div key={w} className="rounded-lg border overflow-hidden">
                            <p className="text-[11px] font-semibold bg-muted/50 px-2.5 py-1.5">{w} <span className="font-normal text-muted-foreground">• {picked}/{wardBeds.length} picked</span></p>
                            {wardBeds.map((b) => (
                              <label key={b.id} className="flex items-center gap-2 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-muted/40 border-t first:border-t-0">
                                <input type="checkbox" className="h-4 w-4 accent-primary" checked={draftBeds.includes(b.id)} onChange={() => toggleIn(draftBeds, b.id, setDraftBeds)} />
                                <span className="flex-1">Bed {b.number} <span className="text-muted-foreground">• {b.status}{b.patientName ? ` • ${b.patientName}` : ""}</span></span>
                              </label>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <Button size="sm" className="w-full" onClick={saveAssignment} disabled={savingAssign}>
                    {savingAssign ? "Saving…" : "Save Assignment"}
                  </Button>
                  {assignSavedAt && (
                    <p className="text-[11px] text-success font-medium text-center">Saved at {assignSavedAt} — editor kept open, values are current.</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ===== Check-status dialog ===== */}
      <Dialog open={!!checkPatient} onOpenChange={(v) => { if (!v) setCheckPatient(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Check — {checkPatient?.name}</DialogTitle>
            <DialogDescription>
              {checkPatient?.uhid} • {checkPatient?.status}
              {checkPatient && bedOf(checkPatient.id) ? ` • Bed ${bedOf(checkPatient.id)!.number} (${bedOf(checkPatient.id)!.ward})` : ""}
              {checkPatient && (apptsByPatient.get(checkPatient.id) ?? []).filter((a) => a.date >= todayStr).slice(0, 2).map((a) => ` • Visit ${a.date}${a.time ? ` ${a.time}` : ""}`).join("")}
              . Record vitals and set patient status — saved to the backend database.
            </DialogDescription>
          </DialogHeader>
          {checkPatient && (
            <div className="grid gap-3 py-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">BP sys</Label><Input className="h-9" inputMode="numeric" placeholder="120" value={vitals.bpSys} onChange={(e) => setVitals({ ...vitals, bpSys: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">BP dia</Label><Input className="h-9" inputMode="numeric" placeholder="80" value={vitals.bpDia} onChange={(e) => setVitals({ ...vitals, bpDia: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Pulse</Label><Input className="h-9" inputMode="numeric" placeholder="72" value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Temp °F</Label><Input className="h-9" inputMode="decimal" placeholder="98.6" value={vitals.temp} onChange={(e) => setVitals({ ...vitals, temp: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">SpO₂ %</Label><Input className="h-9" inputMode="numeric" placeholder="98" value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} /></div>
                <div className="space-y-1"><Label className="text-xs">Sugar</Label><Input className="h-9" inputMode="numeric" placeholder="—" value={vitals.sugar} onChange={(e) => setVitals({ ...vitals, sugar: e.target.value })} /></div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Patient status</Label>
                <Select value={vitals.condition} onValueChange={(v) => setVitals({ ...vitals, condition: v as PatientCondition })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PATIENT_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea rows={2} placeholder="Observations, complaints, care given…" value={vitals.notes} onChange={(e) => setVitals({ ...vitals, notes: e.target.value })} /></div>
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <Label className="text-xs font-semibold">Assign to doctor</Label>
                <div className="flex gap-1.5">
                  <Select value={assignDoctorId} onValueChange={setAssignDoctorId}>
                    <SelectTrigger className="h-9 flex-1"><SelectValue placeholder={checkPatient.doctorName ? `Current: ${checkPatient.doctorName}` : "Choose doctor…"} /></SelectTrigger>
                    <SelectContent>{doctors.map((d) => <SelectItem key={d.id} value={d.id}>{d.name} • {d.specialization}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="secondary" className="h-9 shrink-0" onClick={saveDoctorAssignment} disabled={!assignDoctorId || assignDoctorId === checkPatient.doctorId}>Assign</Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Recent checks</Label>
                {vitalsFor(checkPatient.id).slice(0, 3).map((v) => (
                  <p key={v.id} className="text-[11px] text-muted-foreground rounded-lg bg-muted/40 px-2.5 py-1.5">
                    <span className="font-semibold text-foreground">{v.condition}</span>
                    {v.bpSys && ` • BP ${v.bpSys}/${v.bpDia}`}{v.pulse && ` • P ${v.pulse}`}{v.temp && ` • T ${v.temp}`}{v.spo2 && ` • SpO₂ ${v.spo2}`}
                    {v.notes ? ` • ${v.notes}` : ""} — {v.nurse}, {new Date(v.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                ))}
                {vitalsFor(checkPatient.id).length === 0 && <p className="text-[11px] text-muted-foreground">First check for this patient.</p>}
              </div>
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Close</Button></DialogClose>
            <Button size="sm" onClick={saveVitals} disabled={savingVitals || !canWrite}>{savingVitals ? "Saving…" : "Save Check"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== First-aid dialog ===== */}
      <Dialog open={aidOpen} onOpenChange={setAidOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Log First Aid</DialogTitle><DialogDescription>Dressing, injections, IV, oxygen or bedside care — recorded against the patient and bed.</DialogDescription></DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="flex gap-1.5">
              <Button size="sm" variant={!aidWalkIn ? "default" : "outline"} className="h-7 flex-1 text-[11px]" onClick={() => setAidWalkIn(false)}>Registered patient</Button>
              <Button size="sm" variant={aidWalkIn ? "default" : "outline"} className="h-7 flex-1 text-[11px]" onClick={() => setAidWalkIn(true)}>Walk-in name</Button>
            </div>
            {aidWalkIn ? (
              <div className="space-y-1">
                <Label className="text-xs">Walk-in patient name</Label>
                <Input className="h-9" placeholder="e.g. Visitor at gate…" value={aidCustomName} onChange={(e) => setAidCustomName(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-1">
                <Label className="text-xs">Patient</Label>
                <Select value={aidPatientId} onValueChange={setAidPatientId}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choose patient…" /></SelectTrigger>
                  <SelectContent>{(admin ? patients : scopePatients).slice(0, 200).map((p) => <SelectItem key={p.id} value={p.id}>{p.name} • {p.uhid}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Care given</Label>
                <Select value={aidKind} onValueChange={(v) => setAidKind(v as FirstAidEntry["kind"])}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{FIRSTAID_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bed (optional)</Label>
                <Select value={aidBedId || "none"} onValueChange={(v) => setAidBedId(v === "none" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="No bed" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No bed</SelectItem>
                    {(admin ? beds : beds.filter((b) => myBedIds.includes(b.id) || myAssign.wards.includes(b.ward))).map((b) => <SelectItem key={b.id} value={b.id}>Bed {b.number} • {b.ward}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1"><Label className="text-xs">Notes</Label><Textarea rows={2} placeholder="What was done, dosage, response…" value={aidNotes} onChange={(e) => setAidNotes(e.target.value)} /></div>
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <Label className="text-xs font-semibold">Charge & collection (billed to Billing)</Label>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1"><Label className="text-xs">Amount ₹</Label><Input className="h-9" inputMode="decimal" placeholder="0" value={aidAmount} onChange={(e) => setAidAmount(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs">Collected ₹</Label><Input className="h-9" inputMode="decimal" placeholder="0" value={aidCollected} onChange={(e) => setAidCollected(e.target.value)} /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Via</Label>
                  <Select value={aidPayMethod} onValueChange={setAidPayMethod}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{["Cash", "UPI", "Card", "Net Banking"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">Amount 0 = free care, no bill. Any charge creates a Billing invoice automatically.</p>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
            <Button size="sm" onClick={saveFirstAid} disabled={savingAid}>{savingAid ? "Saving…" : "Save Entry"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
