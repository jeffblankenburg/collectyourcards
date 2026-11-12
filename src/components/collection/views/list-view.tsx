"use client";

import { memo, useEffect, useRef } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCollection } from "../collection-provider";
import { FlagBadges, PlayersWithTeams, gradeLabel, playersLabel } from "../card-row-shared";
import { cardValue, type ValueMode } from "@/lib/collection/pipeline";
import { money, type CompactRow } from "@/lib/collection/index-types";

export function ListView() {
  const { visibleRows, dispatch, search, valueMode } = useCollection();
  const parentRef = useRef<HTMLDivElement>(null);
  // A new search reorders the whole list — jump back to the top so results read
  // from the start (and the virtualizer lays out from a clean scroll position).
  useEffect(() => { parentRef.current?.scrollTo({ top: 0 }); }, [search]);
  // Rows are variable height now (stacked players + full series names), so the
  // virtualizer measures each rendered row instead of assuming a fixed size.
  const v = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 104,
    overscan: 8,
    // Key measured heights by the card's stable id — not the row index — so that
    // filtering/sorting (which puts a different card at each index) doesn't reuse
    // a neighbour's height and overlap rows.
    getItemKey: (index) => visibleRows[index]?.i ?? index,
  });

  return (
    <div ref={parentRef} className="h-full overflow-y-auto overscroll-contain">
      <div style={{ height: v.getTotalSize(), position: "relative" }}>
        {v.getVirtualItems().map((vi) => {
          const row = visibleRows[vi.index];
          return (
            <div key={row.i} data-index={vi.index} ref={v.measureElement}
              style={{ position: "absolute", top: 0, left: 0, width: "100%", transform: `translateY(${vi.start}px)` }}
              className="px-0.5 py-1">
              <ListRow row={row} valueMode={valueMode} onEdit={() => dispatch({ t: "viewing", id: row.i })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ListRow = memo(function ListRow({ row, valueMode, onEdit }: { row: CompactRow; valueMode: ValueMode; onEdit: () => void }) {
  const grade = gradeLabel(row);
  const val = cardValue(row, valueMode);
  return (
    <button onClick={onEdit} className="flex w-full items-stretch gap-3 overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] pl-3 text-left transition hover:border-white/15 hover:bg-white/[0.06]">
      <div className="my-2 flex shrink-0 flex-col items-center gap-1 self-start">
        <div className="relative aspect-[5/7] w-12 overflow-hidden border border-white/10 bg-white/5">
          {row.pu ? <Image src={row.pu} alt={playersLabel(row)} fill sizes="48px" className="object-contain" /> : <div className="flex h-full items-center justify-center text-[9px] text-muted">#{row.n}</div>}
        </div>
        {row.rc ? <span className="rounded-full border border-white/15 bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] leading-none tracking-wide text-ink">{row.rc}</span> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-1">
        {/* card number (left) + grade/value/favorite (right) — one line, so the
            value never steals width from the series name below */}
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-muted">#{row.n}</span>
          <div className="flex shrink-0 items-center gap-2">
            {grade ? <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">{grade}</span> : null}
            {val != null ? <span className="text-sm font-semibold tabular-nums text-ink">{money(val)}</span> : null}
            {row.sp ? <Star className="size-4 fill-gold text-gold" /> : null}
          </div>
        </div>
        <PlayersWithTeams row={row} stacked />
        {/* full series name — no truncation, full width */}
        <div className="text-xs leading-snug text-muted">{row.se}</div>
        {/* flags + serial + location pill */}
        <FlagBadges row={row} locationLabel={row.ln} />
      </div>

      {/* color/parallel stripe — right edge */}
      <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: row.cx || "transparent" }} />
    </button>
  );
});
