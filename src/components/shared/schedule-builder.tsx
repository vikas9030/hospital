"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { DayShift } from "@/lib/types";

export const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SHIFT_OPTIONS = ["Morning", "Afternoon", "Evening", "Night"];

// Grouped one-line summary, e.g. "Mon: 09:00–13:00, 17:00–21:00 • Tue: 10:00–14:00".
export function formatSchedule(list: DayShift[] | undefined | null): string {
  if (!list || list.length === 0) return "";
  const byDay = new Map<string, string[]>();
  for (const e of list) {
    if (!e.day || !e.from || !e.to) continue;
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day)!.push(`${e.from}–${e.to}${e.shift ? ` (${e.shift})` : ""}`);
  }
  const ordered = SCHEDULE_DAYS.filter((d) => byDay.has(d));
  const extra = [...byDay.keys()].filter((d) => !SCHEDULE_DAYS.includes(d));
  return [...ordered, ...extra].map((d) => `${d}: ${byDay.get(d)!.join(", ")}`).join(" • ");
}

export function scheduleDays(list: DayShift[] | undefined | null): string[] {
  const days = new Set<string>();
  for (const e of list || []) if (e.day) days.add(e.day);
  return SCHEDULE_DAYS.filter((d) => days.has(d));
}

// Multi-shift-per-day builder: each row is one weekday + timing + shift label.
export function ScheduleBuilder({
  value, onChange,
}: {
  value: DayShift[];
  onChange: (next: DayShift[]) => void;
}) {
  const setRow = (idx: number, patch: Partial<DayShift>) =>
    onChange(value.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Shift Timings (multiple per day allowed)</Label>
        <Button
          size="sm" variant="outline" className="h-7 text-xs"
          onClick={() => onChange([...value, { day: "Mon", from: "09:00", to: "13:00", shift: "Morning" }])}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Timing
        </Button>
      </div>
      {value.length === 0 && (
        <p className="text-[11px] text-muted-foreground">No timings set — doctor is treated as available all days. Add rows like Mon morning + Mon evening for split shifts.</p>
      )}
      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-[92px_1fr_1fr_110px_32px] gap-1.5 items-center">
          <Select value={r.day} onValueChange={(v) => setRow(i, { day: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SCHEDULE_DAYS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
          <Input className="h-8 text-xs" type="time" value={r.from} onChange={(e) => setRow(i, { from: e.target.value })} title="From" />
          <Input className="h-8 text-xs" type="time" value={r.to} onChange={(e) => setRow(i, { to: e.target.value })} title="To" />
          <Select value={r.shift} onValueChange={(v) => setRow(i, { shift: v })}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SHIFT_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onChange(value.filter((_, j) => j !== i))} title="Remove timing">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      {value.length > 0 && (
        <p className="text-[11px] text-primary font-medium">{formatSchedule(value)}</p>
      )}
    </div>
  );
}
