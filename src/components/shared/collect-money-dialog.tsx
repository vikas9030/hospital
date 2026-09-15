"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { branchSetting } from "@/lib/utils";
import type { Invoice } from "@/lib/types";

declare global {
  interface Window {
    Razorpay?: any;
  }
}

function loadRazorpayCheckout(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

// Single shared "collect payment" dialog used by Dashboard, Billing,
// Laboratory and Radiology. Records a collection against the invoice and
// auto-derives Paid / Partial status. After an admin edits the bill amount,
// the new outstanding shows up here automatically (server re-derives status
// on every amount change), so staff can "collect again" for the new balance.
// When Razorpay is configured (Settings → Online Payments), staff can also
// collect instantly via UPI/cards through Razorpay Checkout.
export function CollectMoneyDialog({
  invoice,
  onOpenChange,
  onCollected,
  title = "Update Money Collected",
}: {
  invoice: Invoice | null;
  onOpenChange: (v: boolean) => void;
  onCollected?: (saved: Invoice) => void;
  title?: string;
}) {
  const { toast } = useToast();
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const currentUser = useAppStore((s) => s.currentUser);
  const settings = useAppStore((s) => s.settings);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [saving, setSaving] = useState(false);
  const [processingOnline, setProcessingOnline] = useState(false);

  if (!invoice) return null;

  const total = invoice.total || 0;
  const already = invoice.paidAmount || 0;
  const outstanding = Math.max(0, total - already);
  const razorpayMode = branchSetting(settings, invoice.branch, "razorpayMode") || settings.razorpayMode || "disabled";
  const razorpayKeyId = branchSetting(settings, invoice.branch, "razorpayKeyId") || settings.razorpayKeyId || "";
  const razorpayOn = razorpayMode !== "disabled" && razorpayKeyId.trim() !== "" && outstanding > 0;
  const ONLINE_METHOD = "Online (Razorpay UPI/Card)";
  const payingOnline = method === ONLINE_METHOD && razorpayOn;

  const handleSave = async () => {
    const paid = parseFloat(amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      toast({ title: "Invalid amount", description: "Enter the collected amount.", variant: "destructive" });
      return;
    }
    if (paid > outstanding) {
      toast({ title: "Amount too high", description: `Outstanding is only ₹${outstanding.toLocaleString("en-IN")}.`, variant: "destructive" });
      return;
    }
    const newPaid = already + paid;
    setSaving(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: invoice.id,
          paidAmount: newPaid,
          paymentMethod: method || invoice.paymentMethod || "Cash",
          status: newPaid >= total && total > 0 ? "Paid" : newPaid > 0 ? "Partial" : invoice.status,
          paidDate: newPaid > 0 ? new Date().toISOString().split("T")[0] : invoice.paidDate,
          receivedBy: currentUser.name,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update the invoice.");
      }
      const saved = await res.json();
      updateInvoice(invoice.id, saved);
      onCollected?.(saved);
      toast({ title: "Money Collected", description: `₹${paid.toLocaleString("en-IN")} recorded for ${invoice.patientName} (${invoice.invoiceNo}).` });
      setAmount("");
      setMethod("");
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Could not update collection", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleOnlinePay = async () => {
    const paid = parseFloat(amount);
    if (!Number.isFinite(paid) || paid <= 0) {
      toast({ title: "Invalid amount", description: "Enter the amount to collect online.", variant: "destructive" });
      return;
    }
    if (paid > outstanding) {
      toast({ title: "Amount too high", description: `Outstanding is only ₹${outstanding.toLocaleString("en-IN")}.`, variant: "destructive" });
      return;
    }
    setProcessingOnline(true);
    try {
      const orderRes = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, amount: paid }),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error || "Could not start online payment.");
      const ready = await loadRazorpayCheckout();
      if (!ready || !window.Razorpay) throw new Error("Razorpay Checkout could not load. Check your connection.");
      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: Math.round(order.amount * 100),
        currency: order.currency || "INR",
        name: settings.invoiceHospitalName || "Hospital",
        description: `Bill ${order.invoiceNo} — ${order.patientName}`,
        order_id: order.orderId,
        theme: { color: "#0f766e" },
        handler: async (resp: any) => {
          try {
            const verifyRes = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                invoiceId: invoice.id,
                razorpay_order_id: resp.razorpay_order_id,
                razorpay_payment_id: resp.razorpay_payment_id,
                razorpay_signature: resp.razorpay_signature,
                amount: order.amount,
              }),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verified.error || "Payment verification failed.");
            updateInvoice(invoice.id, verified.invoice);
            onCollected?.(verified.invoice);
            toast({ title: "Online Payment Collected", description: `₹${verified.collected.toLocaleString("en-IN")} received via UPI for ${invoice.patientName} (${invoice.invoiceNo}).` });
            setAmount("");
            setMethod("");
            onOpenChange(false);
          } catch (e: any) {
            toast({ title: "Verification failed", description: e.message, variant: "destructive" });
          } finally {
            setProcessingOnline(false);
          }
        },
        modal: { ondismiss: () => setProcessingOnline(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: "Online payment failed", description: e.message, variant: "destructive" });
      setProcessingOnline(false);
    }
  };

  const handlePrimary = () => {
    if (payingOnline) handleOnlinePay();
    else handleSave();
  };

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Record a payment for {invoice.patientName} — invoice {invoice.invoiceNo}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Bill total</span><span className="font-semibold">₹{total.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Already collected</span><span className="font-semibold text-success">₹{already.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="font-semibold text-destructive">₹{outstanding.toLocaleString("en-IN")}</span></div>
          </div>
          <div className="space-y-2">
            <Label>Amount Collected Now (₹)</Label>
            <Input type="number" min={0} max={outstanding} placeholder={String(outstanding)} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Payment Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue placeholder={invoice.paymentMethod || "Select method"} /></SelectTrigger>
              <SelectContent>
                {["Cash", "UPI", "Card", "Insurance", "Net Banking"].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                {razorpayOn && <SelectItem value={ONLINE_METHOD}>{`Online — UPI/Card via Razorpay${razorpayMode === "test" ? " (test)" : ""}`}</SelectItem>}
              </SelectContent>
            </Select>
            {payingOnline && (
              <p className="text-[11px] text-success">Opens Razorpay Checkout (UPI, cards, netbanking). The bill updates automatically after payment.</p>
            )}
            {!razorpayOn && (
              <p className="text-[11px] text-muted-foreground">Cash and manual UPI record instantly. Online checkout appears here once Razorpay keys are set in Settings → Online Payments.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
          <Button
            onClick={handlePrimary}
            disabled={saving || processingOnline || outstanding <= 0}
            className={payingOnline ? "bg-success hover:bg-success/90" : undefined}
          >
            {processingOnline ? "Waiting for online payment…" : saving ? "Saving..." : payingOnline ? "Pay Online Now" : "Update Collected"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
