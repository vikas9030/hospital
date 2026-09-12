"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAppStore } from "@/store/app-store";
import { printInvoice } from "@/lib/invoice-print";
import { displayTaxLines } from "@/lib/billing";
import type { Invoice, Patient } from "@/lib/types";

// Read-only bill preview used from patient billing history, the Billing
// module, and doctor patient views. Download prints the same branded bill.
export function InvoiceViewDialog({
  invoice,
  patient,
  onOpenChange,
}: {
  invoice: Invoice | null;
  patient?: Patient | null;
  onOpenChange: (v: boolean) => void;
}) {
  const { toast } = useToast();
  const settings = useAppStore((s) => s.settings);

  if (!invoice) return null;

  const total = invoice.total || 0;
  const paid = invoice.paidAmount || 0;
  const balance = Math.max(0, total - paid);
  const items = invoice.items ?? [];

  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Bill {invoice.invoiceNo}
            <Badge variant="outline" className="text-[10px]">{invoice.status}</Badge>
          </DialogTitle>
          <DialogDescription>
            {invoice.patientName} • {invoice.date}
            {patient?.phone ? ` • ${patient.phone}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/60 text-left">
                  <th className="p-2 font-medium">Service</th>
                  <th className="p-2 font-medium text-center">Qty</th>
                  <th className="p-2 font-medium text-right">Rate</th>
                  <th className="p-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr><td colSpan={4} className="p-3 text-center text-muted-foreground">No line items recorded</td></tr>
                )}
                {items.map((it, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2">
                      <p className="font-medium">{it.description}</p>
                      <p className="text-muted-foreground">{it.category}</p>
                    </td>
                    <td className="p-2 text-center">{it.quantity ?? 1}</td>
                    <td className="p-2 text-right">₹{(it.rate ?? 0).toLocaleString("en-IN")}</td>
                    <td className="p-2 text-right font-medium">₹{(it.amount ?? 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>₹{(invoice.subtotal ?? 0).toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Discount ({invoice.discountPercent ?? 0}%)</span><span>− ₹{(invoice.discount ?? 0).toLocaleString("en-IN")}</span></div>
            {displayTaxLines(invoice).map((tx, i) => (
              <div key={i} className="flex justify-between"><span className="text-muted-foreground">{tx.name}{tx.percent > 0 ? ` (${tx.percent}%)` : ""}</span><span>+ ₹{(tx.amount ?? 0).toLocaleString("en-IN")}</span></div>
            ))}
            <div className="flex justify-between text-sm font-bold pt-1 border-t"><span>Total</span><span>₹{total.toLocaleString("en-IN")}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Collected</span><span className="text-success font-semibold">₹{paid.toLocaleString("en-IN")}</span></div>
            {balance > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Outstanding</span><span className="text-destructive font-semibold">₹{balance.toLocaleString("en-IN")}</span></div>}
            {invoice.paymentMethod && <div className="flex justify-between"><span className="text-muted-foreground">Paid via</span><span>{invoice.paymentMethod}</span></div>}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          <Button
            onClick={() => {
              if (!printInvoice(invoice, settings, patient)) {
                toast({ title: "Pop-up blocked", description: "Allow pop-ups to download the bill." });
              }
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> Download / Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
