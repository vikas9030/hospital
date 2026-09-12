"use client";

import { useMemo, useState } from "react";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Building2, Plus, Pencil, Trash2 } from "lucide-react";
import { sameBranch } from "@/lib/utils";
import type { Department } from "@/lib/types";

/** Pre-database fallback so dropdowns never render empty. */
export const LEGACY_DEPARTMENTS = [
  "General Medicine", "Cardiology", "Neurology", "Orthopedics", "Pediatrics",
  "Dermatology", "Gastroenterology", "Pulmonology", "ENT", "Ophthalmology",
  "Psychiatry", "Oncology", "Radiology", "Pathology", "Emergency Medicine",
];

/** Active department names for a branch (admin-managed list, legacy fallback).
 *  Use in every form dropdown so new departments appear automatically. */
export function useDepartmentOptions(branchName?: string): string[] {
  const departments = useAppStore((s) => s.departments);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const b = branchName || activeBranch;
  const names = departments
    .filter((d) => d.isActive && sameBranch(d.branch, b))
    .map((d) => d.name)
    .sort((x, y) => x.localeCompare(y));
  return names.length > 0 ? [...new Set(names)] : [...LEGACY_DEPARTMENTS];
}

const STANDARD_DEPARTMENTS = [
  "General Medicine", "Cardiology", "Neurology", "Orthopedics", "Pediatrics",
  "Gynecology", "Dermatology", "ENT", "Ophthalmology", "Emergency",
];

/** Settings → Departments: admin-owned per-branch department lists.
 *  Every Doctor/Staff/Billing/Reports form pulls its dropdown from here. */
export function DepartmentsManager() {
  const { toast } = useToast();
  const currentUser = useAppStore((s) => s.currentUser);
  const addAuditLog = useAppStore((s) => s.addAuditLog);
  const storeBranches = useAppStore((s) => s.branches);
  const activeBranch = useAppStore((s) => s.activeBranch);
  const departments = useAppStore((s) => s.departments);
  const addDepartment = useAppStore((s) => s.addDepartment);
  const updateDepartment = useAppStore((s) => s.updateDepartment);
  const deleteDepartment = useAppStore((s) => s.deleteDepartment);
  const doctors = useAppStore((s) => s.doctors);
  const staffMembers = useAppStore((s) => s.staffMembers);

  const [branchName, setBranchName] = useState(activeBranch || storeBranches[0]?.name || "");
  const effectiveBranch = branchName || activeBranch || storeBranches[0]?.name || "";
  const [dialog, setDialog] = useState<null | { mode: "add" } | { mode: "edit"; dep: Department }>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [seeding, setSeeding] = useState(false);

  const list = useMemo(
    () => departments.filter((d) => sameBranch(d.branch, effectiveBranch)).sort((a, b) => a.name.localeCompare(b.name)),
    [departments, effectiveBranch]
  );

  const usageOf = (name: string) => {
    const docs = doctors.filter((d) => sameBranch(d.branch, effectiveBranch) && (d.department === name || d.specialization === name)).length;
    const staff = staffMembers.filter((s) => sameBranch(s.branch, effectiveBranch) && s.department === name).length;
    return { docs, staff, total: docs + staff };
  };

  const audit = (action: string, details: string) => {
    addAuditLog({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "departments", branch: currentUser.branch || "", details });
    fetch("/api/audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actor: currentUser.name, actorEmail: currentUser.email, action, target: "departments", branch: currentUser.branch || "", details }),
    }).catch(() => {});
  };

  const seedDefaults = async () => {
    setSeeding(true);
    try {
      const existing = new Set(list.map((d) => d.name.toLowerCase()));
      const missing = STANDARD_DEPARTMENTS.filter((n) => !existing.has(n.toLowerCase()));
      if (missing.length === 0) {
        toast({ title: "Already complete", description: "All standard departments exist for this branch." });
        return;
      }
      let added = 0;
      for (const name of missing) {
        const res = await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: `dep${Date.now()}${added}`, name, branch: effectiveBranch }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Seed failed.");
        addDepartment(await res.json());
        added++;
      }
      audit("DEPARTMENT_SEED", `${currentUser.name} seeded ${added} standard departments for ${effectiveBranch}.`);
      toast({ title: "Departments seeded", description: `${added} standard departments added to ${effectiveBranch}.` });
    } catch (e: any) {
      toast({ title: "Could not seed", description: e.message, variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

  const removeDepartment = async () => {
    if (!deleteTarget) return;
    const usage = usageOf(deleteTarget.name);
    if (usage.total > 0) {
      toast({ title: `Cannot delete ${deleteTarget.name}`, description: `${usage.docs} doctor(s) and ${usage.staff} staff still use it. Move them to another department first.`, variant: "destructive" });
      return;
    }
    try {
      const res = await fetch("/api/departments", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: deleteTarget.id }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed.");
      deleteDepartment(deleteTarget.id);
      audit("DEPARTMENT_DELETE", `${currentUser.name} deleted department "${deleteTarget.name}" (${effectiveBranch}).`);
      toast({ title: "Department deleted" });
      setDeleteTarget(null);
    } catch (e: any) {
      toast({ title: "Could not delete", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="grid gap-3 sm:gap-4 md:grid-cols-2 [&>*]:min-w-0">
      <Card className="md:col-span-2">
        <CardHeader className="pb-3 flex flex-row flex-wrap items-center gap-2 justify-between">
          <div>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Branch Departments</CardTitle>
            <CardDescription className="text-xs">Admin-owned lists — Doctor, Staff, Billing and Reports dropdowns fill from here automatically.</CardDescription>
          </div>
          <div className="flex items-center gap-1.5">
            <Select value={effectiveBranch} onValueChange={setBranchName}>
              <SelectTrigger className="h-8 w-[180px] text-xs"><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>{storeBranches.map((b) => <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-8 text-xs" disabled={seeding} onClick={seedDefaults}>Seed defaults</Button>
            <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setDialog({ mode: "add" })}><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No departments for {effectiveBranch || "this branch"} yet — Seed defaults or Add the first one.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {list.map((d) => {
                const usage = usageOf(d.name);
                return (
                  <div key={d.id} className={`rounded-lg border p-3 ${d.isActive ? "" : "opacity-60"}`}>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold flex-1 truncate">{d.name}</p>
                      {d.isActive ? (
                        <Badge className="text-[10px] bg-success/15 text-success border-success/30">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Hidden</Badge>
                      )}
                    </div>
                    {(d.head || d.description) && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{[d.head && `Head: ${d.head}`, d.description].filter(Boolean).join(" • ")}</p>
                    )}
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-muted-foreground flex-1">{usage.docs} doctor(s) • {usage.staff} staff</span>
                      <Switch
                        checked={d.isActive}
                        onCheckedChange={async (v) => {
                          try {
                            const res = await fetch("/api/departments", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, isActive: v }) });
                            if (!res.ok) throw new Error("Failed.");
                            updateDepartment(d.id, { isActive: v });
                            audit("DEPARTMENT_TOGGLE", `${currentUser.name} ${v ? "showed" : "hid"} department "${d.name}" (${effectiveBranch}).`);
                          } catch {
                            toast({ title: "Could not update", variant: "destructive" });
                          }
                        }}
                        aria-label={`Active: ${d.name}`}
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ mode: "edit", dep: d })} title="Edit"><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeleteTarget(d)} title="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <DepartmentDialog
        open={!!dialog}
        initial={dialog?.mode === "edit" ? dialog.dep : null}
        branch={effectiveBranch}
        onClose={() => setDialog(null)}
        onSaved={(saved, isEdit) => {
          if (isEdit) updateDepartment(saved.id, saved);
          else addDepartment(saved);
          audit(isEdit ? "DEPARTMENT_EDIT" : "DEPARTMENT_ADD", `${currentUser.name} ${isEdit ? "updated" : "added"} department "${saved.name}" (${effectiveBranch}).`);
          toast({ title: isEdit ? "Department updated" : "Department added", description: `${saved.name} is now in every ${effectiveBranch} dropdown.` });
          setDialog(null);
        }}
      />

      {deleteTarget && (
        <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Delete department?</DialogTitle><DialogDescription>Remove “{deleteTarget.name}” from {effectiveBranch}. Blocked while doctors or staff still use it.</DialogDescription></DialogHeader>
            <DialogFooter>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              <Button variant="destructive" onClick={removeDepartment}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function DepartmentDialog({ open, initial, branch, onClose, onSaved }: {
  open: boolean;
  initial: Department | null;
  branch: string;
  onClose: () => void;
  onSaved: (saved: Department, isEdit: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [head, setHead] = useState(initial?.head ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "e.g. Cardiology, Pediatrics, Emergency.", variant: "destructive" });
      return;
    }
    if (!branch) {
      toast({ title: "No branch", description: "Pick a branch first.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      if (initial) {
        const res = await fetch("/api/departments", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: initial.id, name: name.trim(), head: head.trim(), description: description.trim() }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Update failed.");
        onSaved(await res.json(), true);
      } else {
        const res = await fetch("/api/departments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: `dep${Date.now()}`, name: name.trim(), head: head.trim(), description: description.trim(), branch }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Save failed.");
        onSaved(await res.json(), false);
      }
    } catch (e: any) {
      toast({ title: "Could not save department", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Department" : "Add Department"}</DialogTitle>
          <DialogDescription>{branch ? `For ${branch} — appears in forms instantly.` : "Pick a branch first."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1"><Label className="text-xs">Department name *</Label><Input className="h-9" placeholder="e.g. Cardiology" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Head of department</Label><Input className="h-9" placeholder="e.g. Dr. Rao" value={head} onChange={(e) => setHead(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs">Description</Label><Textarea rows={2} placeholder="What this department handles…" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Cancel</Button></DialogClose>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : initial ? "Save Changes" : "Add Department"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
