"use client";

import { memo, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCollection } from "../collection-provider";
import { COLUMNS, DEFAULT_VISIBLE, PUBLIC_COLUMN_KEYS, type ColDef } from "./table-columns";
import type { ValueMode } from "@/lib/collection/pipeline";
import type { CompactRow } from "@/lib/collection/index-types";

const LS_KEY = "cyc.collection.cols";
const ROW = 40;

// --- text measurement for content-fit columns (cached canvas) ---
let _ctx: CanvasRenderingContext2D | null = null;
function textWidth(s: string, font: string): number {
  if (typeof document === "undefined") return s.length * 7;
  if (!_ctx) _ctx = document.createElement("canvas").getContext("2d");
  if (!_ctx) return s.length * 7;
  _ctx.font = font;
  return _ctx.measureText(s).width;
}

// Size each column to its widest content across the WHOLE collection (not the
// filtered set), so columns are stable as you search and nothing truncates.
function useColumnWidths(rows: CompactRow[], cols: ColDef[]): Record<string, number> {
  return useMemo(() => {
    const cell = "12px Archivo, system-ui, sans-serif";
    const head = "600 11px Archivo, system-ui, sans-serif";
    const map: Record<string, number> = {};
    for (const c of cols) {
      let w = Math.max(c.min, textWidth(c.label.toUpperCase(), head) + 30); // header floor (uppercase + sort chevron)
      if (c.grow) {
        const pad = c.pad ?? 20;
        for (const r of rows) {
          const t = c.grow(r);
          if (t) { const cw = textWidth(t, cell) + pad; if (cw > w) { w = cw; } }
        }
      }
      map[c.key] = Math.round(Math.min(w, c.max ?? 500));
    }
    return map;
  }, [rows, cols]);
}

function loadVisible(): Set<string> {
  if (typeof window === "undefined") return new Set(DEFAULT_VISIBLE);
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set(DEFAULT_VISIBLE);
}

export function TableView() {
  const { visibleRows, rows, sort, dispatch, valueMode, publicMode } = useCollection();
  const parentRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState<Set<string>>(loadVisible);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Public mode: only ever offer/show the public-safe columns (no price/value/
  // location/notes/code), regardless of the viewer's saved column prefs.
  const available = useMemo(() => publicMode ? COLUMNS.filter((c) => PUBLIC_COLUMN_KEYS.includes(c.key)) : COLUMNS, [publicMode]);
  const cols = useMemo(() => available.filter((c) => visible.has(c.key)), [available, visible]);
  const widths = useColumnWidths(rows, cols);
  const totalWidth = cols.reduce((n, c) => n + (widths[c.key] ?? c.min), 0);

  const v = useVirtualizer({ count: visibleRows.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW, overscan: 12 });

  const toggleCol = (key: string) => {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  };

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex justify-end pb-2">
        <button onClick={() => setPickerOpen((o) => !o)} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs text-muted hover:text-ink">
          <SlidersHorizontal className="size-3.5" /> Columns
        </button>
        {pickerOpen ? (
          <div className="absolute right-0 top-9 z-30 grid max-h-80 w-56 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-white/10 bg-base/95 p-2 shadow-2xl backdrop-blur-xl">
            {available.filter((c) => c.label).map((c) => (
              <label key={c.key} className="flex items-center gap-2 rounded px-2 py-1.5 text-xs text-ink hover:bg-white/5">
                <input type="checkbox" checked={visible.has(c.key)} onChange={() => toggleCol(c.key)} className="accent-[var(--color-brand)]" />
                <span className="truncate">{c.label}</span>
              </label>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={parentRef} className="h-full overflow-auto overscroll-contain rounded-xl border border-white/5">
        <div style={{ minWidth: totalWidth }}>
          {/* header */}
          <div className="sticky top-0 z-10 flex h-9 items-center border-b border-white/10 bg-base/95 backdrop-blur">
            {cols.map((c) => (
              <HeaderCell key={c.key} col={c} width={widths[c.key] ?? c.min} active={sort.key === c.sortKey} dir={sort.dir}
                onSort={c.sortKey ? () => dispatch({ t: "sort", key: c.sortKey! }) : undefined} />
            ))}
          </div>
          {/* body */}
          <div style={{ height: v.getTotalSize(), position: "relative" }}>
            {v.getVirtualItems().map((vi) => {
              const row = visibleRows[vi.index];
              return (
                <div key={row.i} style={{ position: "absolute", top: 0, left: 0, width: "100%", height: vi.size, transform: `translateY(${vi.start}px)` }}>
                  <TableRow row={row} cols={cols} widths={widths} valueMode={valueMode}
                    onEdit={() => dispatch({ t: "viewing", id: row.i })} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeaderCell({ col, width, active, dir, onSort }: { col: ColDef; width: number; active: boolean; dir: "asc" | "desc"; onSort?: () => void }) {
  return (
    <button disabled={!onSort} onClick={onSort}
      style={{ width }}
      className={`flex h-full shrink-0 items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wide ${col.align === "right" ? "justify-end" : col.align === "center" ? "justify-center" : ""} ${onSort ? "text-muted hover:text-ink" : "text-muted/60"}`}>
      {col.headerIcon ?? col.label}
      {active ? (dir === "asc" ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />) : null}
    </button>
  );
}

const TableRow = memo(function TableRow({ row, cols, widths, valueMode, onEdit }: { row: CompactRow; cols: ColDef[]; widths: Record<string, number>; valueMode: ValueMode; onEdit: () => void }) {
  return (
    <button onClick={onEdit} className="flex h-10 w-full items-center border-b border-white/5 text-left text-xs transition hover:bg-white/[0.05]">
      {cols.map((c) => (
        <div key={c.key} style={{ width: widths[c.key] ?? c.min }} className={`flex h-full shrink-0 items-center px-2 ${c.align === "right" ? "justify-end" : c.align === "center" ? "justify-center" : ""}`}>
          {c.render(row, { valueMode })}
        </div>
      ))}
    </button>
  );
});
