"use client";

import { useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import type { ReportDoc } from "@/lib/documents";

/** Inline document preview: renders the styled report/lab/bill HTML in a
 *  dialog (no download needed), with Print + Download actions. */
export function ReportViewerDialog({
  doc,
  onOpenChange,
  onDownload,
}: {
  doc: ReportDoc | null;
  onOpenChange: (v: boolean) => void;
  onDownload?: () => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = () => {
    try {
      frameRef.current?.contentWindow?.focus();
      frameRef.current?.contentWindow?.print();
    } catch {
      // Cross-origin-safe: srcDoc iframes are same-origin; fallback below.
      if (doc) {
        const w = window.open("", "_blank", "width=800,height=960");
        if (w) {
          w.document.write(doc.html);
          w.document.close();
          w.focus();
          w.print();
        }
      }
    }
  };

  return (
    <Dialog open={!!doc} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{doc?.title ?? "Report"}</DialogTitle>
          <DialogDescription>Preview — no download needed. Print or save as PDF anytime.</DialogDescription>
        </DialogHeader>
        {doc && (
          <iframe
            ref={frameRef}
            title={doc.title}
            srcDoc={doc.html}
            className="w-full flex-1 min-h-[55vh] rounded-lg border bg-white"
          />
        )}
        <DialogFooter className="gap-2 sm:gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Close</Button>
          </DialogClose>
          <div className="flex-1" />
          {onDownload && (
            <Button variant="outline" size="sm" onClick={onDownload}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Download
            </Button>
          )}
          <Button size="sm" onClick={handlePrint}>
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
