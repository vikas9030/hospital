"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

// Generic client-side pagination hook: slice any filtered list.
export function usePagination<T>(items: T[], resetKey: string = "", initialSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialSize);
  useEffect(() => { setPage(1); }, [resetKey, pageSize]);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize]
  );
  return { page: safePage, setPage, pageSize, setPageSize, totalPages, pageItems, total: items.length };
}

export function DataPagination({
  page, totalPages, pageSize, total, onPage, onPageSize,
}: {
  page: number; totalPages: number; pageSize: number; total: number;
  onPage: (p: number) => void; onPageSize: (s: number) => void;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const btn = "h-7 w-7 p-0";
  return (
    <div className="flex flex-wrap items-center gap-2 px-1 py-2 text-xs text-muted-foreground">
      <span className="mr-auto">Showing {start}–{end} of {total}</span>
      <Select value={String(pageSize)} onValueChange={(v) => onPageSize(parseInt(v))}>
        <SelectTrigger className="h-7 w-[70px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="icon" className={btn} disabled={page <= 1} onClick={() => onPage(1)} title="First page"><ChevronsLeft className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="icon" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page"><ChevronLeft className="h-3.5 w-3.5" /></Button>
      <span className="min-w-[86px] text-center font-medium text-foreground">Page {page} of {totalPages}</span>
      <Button variant="outline" size="icon" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)} title="Next page"><ChevronRight className="h-3.5 w-3.5" /></Button>
      <Button variant="outline" size="icon" className={btn} disabled={page >= totalPages} onClick={() => onPage(totalPages)} title="Last page"><ChevronsRight className="h-3.5 w-3.5" /></Button>
    </div>
  );
}
