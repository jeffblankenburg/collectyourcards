"use client";

import { memo, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCollection } from "../collection-provider";
import { CardRowInner } from "../card-row-shared";
import { cardValue, type ValueMode } from "@/lib/collection/pipeline";
import { money, type CompactRow } from "@/lib/collection/index-types";

export function ListView() {
  const { visibleRows, dispatch, search, valueMode, publicMode } = useCollection();
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
              <ListRow row={row} valueMode={valueMode} publicMode={publicMode}
                onEdit={() => dispatch({ t: "viewing", id: row.i })} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const ListRow = memo(function ListRow({ row, valueMode, publicMode, onEdit }: { row: CompactRow; valueMode: ValueMode; publicMode: boolean; onEdit: () => void }) {
  const val = publicMode ? null : cardValue(row, valueMode);
  return (
    <button onClick={onEdit} className="block w-full">
      <CardRowInner row={row} value={val != null ? money(val) : null} locationLabel={publicMode ? null : row.ln} />
    </button>
  );
});
