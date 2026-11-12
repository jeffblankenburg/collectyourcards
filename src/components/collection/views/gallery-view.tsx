"use client";

import { memo, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCollection } from "../collection-provider";
import { FlagBadges, PlayersWithTeams, gradeLabel, playersLabel } from "../card-row-shared";
import { cardValue, type ValueMode } from "@/lib/collection/pipeline";
import { money, type CompactRow } from "@/lib/collection/index-types";

const MIN_TILE = 150;
const GAP = 8;

export function GalleryView() {
  const { visibleRows, dispatch, search, valueMode, publicMode } = useCollection();
  const parentRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = parentRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const cols = Math.max(2, Math.floor((width + GAP) / (MIN_TILE + GAP))) || 2;
  const tileW = cols > 0 && width > 0 ? (width - GAP * (cols - 1)) / cols : MIN_TILE;
  const rowCount = Math.ceil(visibleRows.length / cols);

  // Rows are variable height now (stacked players + full series names), so the
  // virtualizer measures each rendered row. Key by the row's first card id so
  // filtering/sorting doesn't reuse a different row's measured height.
  const v = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => Math.round(tileW * 1.4) + 104,
    overscan: 4,
    getItemKey: (index) => visibleRows[index * cols]?.i ?? index,
  });

  // Tile width changed (viewport resize / column count) → re-measure heights.
  useEffect(() => { v.measure(); }, [cols, tileW, v]);
  // New search → jump back to the top.
  useEffect(() => { parentRef.current?.scrollTo({ top: 0 }); }, [search]);

  return (
    <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const start = vi.index * cols;
          const items = visibleRows.slice(start, start + cols);
          return (
            <div key={vi.key} data-index={vi.index} ref={v.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)`, paddingBottom: GAP }}>
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))`, gap: GAP, alignItems: "start" }}>
                {items.map((row) => <Tile key={row.i} row={row} valueMode={valueMode} publicMode={publicMode}
                  onEdit={() => dispatch({ t: "viewing", id: row.i })} />)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const Tile = memo(function Tile({ row, valueMode, publicMode, onEdit }: { row: CompactRow; valueMode: ValueMode; publicMode: boolean; onEdit: () => void }) {
  const grade = gradeLabel(row);
  const val = publicMode ? null : cardValue(row, valueMode);
  return (
    <button onClick={onEdit} className="flex flex-col overflow-hidden rounded-lg border border-white/5 bg-white/[0.03] text-left transition hover:border-white/15">
      <div className="relative aspect-[5/7] w-full overflow-hidden bg-white/5">
        {row.pu ? <Image src={row.pu} alt={playersLabel(row)} fill sizes="180px" className="object-contain" loading="lazy" /> : <div className="flex h-full items-center justify-center text-xs text-muted">#{row.n}</div>}
        {row.sp ? <Star className="absolute right-1.5 top-1.5 size-4 fill-gold text-gold drop-shadow" /> : null}
      </div>
      <div className="flex flex-col gap-1 p-2">
        {/* card number (left) + grade/value (right) on one line */}
        <div className="flex items-center justify-between gap-1.5">
          <span className="font-mono text-sm font-semibold text-muted">#{row.n}</span>
          <div className="flex shrink-0 items-center gap-1.5">
            {grade ? <span className="rounded bg-gold/15 px-1 py-0.5 text-[10px] font-semibold text-gold">{grade}</span> : null}
            {val != null ? <span className="text-sm font-semibold tabular-nums text-ink">{money(val)}</span> : null}
          </div>
        </div>
        {/* each player on its own line with its team circle */}
        <PlayersWithTeams row={row} stacked chipSize={16} />
        {/* full series name — no truncation */}
        <div className="text-[11px] leading-snug text-muted">{row.se}</div>
        {/* flags + serial + location pill */}
        <FlagBadges row={row} locationLabel={publicMode ? null : row.ln} />
      </div>
      {/* color/parallel stripe — bottom edge of the card */}
      {row.cx ? <span aria-hidden className="mt-auto h-1.5 w-full shrink-0" style={{ backgroundColor: row.cx }} /> : null}
    </button>
  );
});
