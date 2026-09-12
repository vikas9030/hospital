"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Upload, FileSpreadsheet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { downloadCSV, parseCSV } from "@/lib/csv";

export interface IOColumn {
  /** CSV header text */
  header: string;
  /** Sample value shown in the downloadable template */
  sample?: string;
}

export interface EntityIOConfig<T> {
  /** Label used in toasts, e.g. "patients" */
  entity: string;
  /** Base filename without extension */
  filename: string;
  columns: IOColumn[];
  /** Map one record to a CSV row (same order as columns) */
  toRow: (item: T) => (string | number)[];
  /**
   * Map one CSV row (keyed by header) to a POST payload for `endpoint`.
   * Receives the 0-based row index for unique id generation.
   * Return null to skip the row, or throw to fail it with a message.
   */
  fromRow: (row: Record<string, string>, index: number) => any | null;
  /** POST endpoint that creates one record and returns the saved row */
  endpoint: string;
  /** Store updater called with each saved row */
  onImported: (saved: any) => void;
}

// Template + Export + Import buttons for any module list. Imports POST each
// row through the normal create endpoint (backend validation applies) and
// report a success/failure summary.
export function ImportExportButtons<T>({
  config, items, compact, hideExport,
}: {
  config: EntityIOConfig<T>;
  items: T[];
  compact?: boolean;
  hideExport?: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const headers = config.columns.map((c) => c.header);

  const handleTemplate = () => {
    downloadCSV(
      `${config.filename}-template`,
      headers,
      [config.columns.map((c) => c.sample ?? "")]
    );
    toast({ title: "Template Downloaded", description: `Fill one ${config.entity.slice(0, -1)} per row, then Import the file.` });
  };

  const handleExport = () => {
    if (items.length === 0) {
      toast({ title: "Nothing to export", description: `No ${config.entity} in the current view.`, variant: "destructive" });
      return;
    }
    downloadCSV(`${config.filename}-${new Date().toISOString().split("T")[0]}`, headers, items.map(config.toRow));
    toast({ title: "Exported", description: `${items.length} ${config.entity} downloaded as CSV.` });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      const text = await file.text();
      const { headers: fileHeaders, rows } = parseCSV(text);
      const missing = headers.filter((h) => !fileHeaders.includes(h));
      if (missing.length > 0) {
        throw new Error(`Missing columns: ${missing.join(", ")}. Download the template first.`);
      }
      if (rows.length === 0) throw new Error("No data rows found in the file.");
      let ok = 0;
      const failures: string[] = [];
      for (let i = 0; i < rows.length; i++) {
        try {
          const payload = config.fromRow(rows[i], i);
          if (!payload) continue;
          const res = await fetch(config.endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || `Row ${i + 2} rejected.`);
          }
          config.onImported(await res.json());
          ok++;
        } catch (e: any) {
          failures.push(`Row ${i + 2}: ${e.message}`);
          if (failures.length >= 5) {
            failures.push(`…and ${rows.length - i - 1} more not attempted.`);
            break;
          }
        }
      }
      toast({
        title: failures.length === 0 ? "Import Complete" : `Imported ${ok} of ${rows.length}`,
        description: failures.length === 0
          ? `${ok} ${config.entity} added to Supabase.`
          : failures.join(" "),
        variant: failures.length === 0 ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const cls = compact ? "h-7 text-[11px] gap-1 max-w-full" : "h-8 text-xs gap-1.5 max-w-full";
  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      <Button variant="outline" size="sm" className={cls} onClick={handleTemplate} title={`Download ${config.entity} CSV template`}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Template
      </Button>
      {!hideExport && (
        <Button variant="outline" size="sm" className={cls} onClick={handleExport} title={`Export ${config.entity} to CSV`}>
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      )}
      <Button variant="outline" size="sm" className={cls} onClick={() => fileRef.current?.click()} disabled={busy} title={`Import ${config.entity} from CSV`}>
        <Upload className="h-3.5 w-3.5" /> {busy ? "Importing…" : "Import"}
      </Button>
    </div>
  );
}
