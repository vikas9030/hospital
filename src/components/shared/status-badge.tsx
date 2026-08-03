"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type StatusType = "success" | "warning" | "danger" | "info" | "neutral" | "primary";

const statusStyles: Record<StatusType, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
  neutral: "bg-muted text-muted-foreground border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
};

interface StatusBadgeProps {
  status: string;
  type?: StatusType;
  className?: string;
}

// Helper to map common statuses to types
function inferType(status: string): StatusType {
  const s = status.toLowerCase();
  if (["available", "in stock", "active", "completed", "approved", "paid", "settled", "admitted"].includes(s)) return "success";
  if (["busy", "pending", "partial", "low stock", "expiring soon", "in progress", "in consultation", "checked-in", "sample collected", "quality check", "testing", "image captured", "report generated", "pre-auth", "on leave", "reserved", "scheduled", "ordered"].includes(s)) return "warning";
  if (["out of stock", "maintenance", "overdue", "rejected", "cancelled", "no-show", "off duty", "inactive", "emergency"].includes(s)) return "danger";
  if (["online", "walk-in", "referral"].includes(s)) return "info";
  if (["opd", "discharged"].includes(s)) return "neutral";
  return "primary";
}

export function StatusBadge({ status, type, className }: StatusBadgeProps) {
  const statusType = type || inferType(status);
  return (
    <Badge variant="outline" className={cn("font-medium border", statusStyles[statusType], className)}>
      {status}
    </Badge>
  );
}
