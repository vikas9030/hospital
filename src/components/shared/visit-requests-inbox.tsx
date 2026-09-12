"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { useBranchData } from "@/hooks/use-branch-data";
import { isAdmin } from "@/lib/utils";
import type { AppointmentRequest } from "@/lib/types";

// Patient visit requests from the portal — restricted to Receptionist and
// Admin. Other staff never see this inbox. Accepting books the visit (server
// token) and raises the OP bill payable at the hospital.
// Used in both the Appointments and Reception modules.
export function VisitRequestsInbox() {
  const { toast } = useToast();
  const addAppointment = useAppStore((s) => s.addAppointment);
  const addInvoice = useAppStore((s) => s.addInvoice);
  const currentUser = useAppStore((s) => s.currentUser);
  const canHandleRequests = isAdmin(currentUser.role) || currentUser.role === "Receptionist";
  const { branch } = useBranchData();
  const [requests, setRequests] = useState<AppointmentRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/appointment-requests?branch=${encodeURIComponent(branch)}&status=Requested`);
      if (res.ok) {
        const all = await res.json();
        setRequests(Array.isArray(all) ? all : []);
      }
    } catch {
      // Requests store may be unavailable; inbox stays empty.
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (canHandleRequests) loadRequests(); }, [branch, canHandleRequests]);

  const actOnRequest = async (req: AppointmentRequest, status: "Accepted" | "Rejected") => {
    if (!canHandleRequests) {
      toast({ title: "Not permitted", description: "Only Receptionist or Admin can accept visit requests.", variant: "destructive" });
      return;
    }
    setActingId(req.id);
    try {
      const res = await fetch("/api/appointment-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.id, status, actorRole: currentUser.role }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed.");
      setRequests((l) => l.filter((r) => r.id !== req.id));
      if (status === "Accepted") {
        if (body.appointment) addAppointment(body.appointment);
        if (body.invoice) addInvoice(body.invoice);
        toast({
          title: "Visit Accepted",
          description: `${req.patientName} booked with ${req.doctorName} — token ${body.appointment?.token}${body.invoice ? `, pending bill ${body.invoice.invoiceNo} payable at hospital` : ""}.`,
        });
      } else {
        toast({ title: "Request Rejected", description: `Visit request from ${req.patientName} was declined.` });
      }
    } catch (e: any) {
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  };

  if (!canHandleRequests) return null;
  if (requests.length === 0 && !loading) return null;

  return (
    <Card className="border-info/40 bg-info/5">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-base">Patient Visit Requests ({requests.length})</CardTitle>
        <Button size="sm" variant="ghost" className="h-7 text-[11px]" onClick={loadRequests} disabled={loading}>{loading ? "Loading…" : "Refresh"}</Button>
      </CardHeader>
      <CardContent className="p-0 pb-3">
        <div className="rounded-lg border bg-background overflow-hidden mx-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead className="hidden md:table-cell">Reason</TableHead>
                <TableHead className="text-right">Fee</TableHead>
                <TableHead className="w-[170px]">Decision</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <p className="text-sm font-medium">{r.patientName}</p>
                    <p className="text-[11px] text-muted-foreground">{r.phone}</p>
                  </TableCell>
                  <TableCell className="text-sm">{r.doctorName}</TableCell>
                  <TableCell className="text-sm">{r.date} at {r.time}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.reason || "—"}</TableCell>
                  <TableCell className="text-right text-sm font-medium">₹{(r.fee || 0).toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button size="sm" className="h-7 text-[11px] bg-success hover:bg-success/90" disabled={actingId === r.id} onClick={() => actOnRequest(r, "Accepted")}>
                        {actingId === r.id ? "…" : "Accept"}
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-[11px] text-destructive" disabled={actingId === r.id} onClick={() => actOnRequest(r, "Rejected")}>
                        Reject
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="px-4 pt-2 text-[11px] text-muted-foreground">Accepting books the visit (token generated) and raises the OP bill payable at the hospital.</p>
      </CardContent>
    </Card>
  );
}
