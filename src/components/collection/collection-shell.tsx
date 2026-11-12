"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CollectionProvider, useCollection } from "./collection-provider";
import { StatsStrip } from "./stats-strip";
import { CollectionFooter } from "./collection-footer";
import { ViewToggle } from "./view-toggle";
import { SavedViewsControl } from "./saved-views-control";
import { ListView } from "./views/list-view";

// Heavy pieces split out of the default (mobile list) bundle.
const GalleryView = dynamic(() => import("./views/gallery-view").then((m) => m.GalleryView));
const TableView = dynamic(() => import("./views/table-view").then((m) => m.TableView));
const EditCardModal = dynamic(() => import("./edit-card-modal").then((m) => m.EditCardModal));
const CardDetailModal = dynamic(() => import("./card-detail-modal").then((m) => m.CardDetailModal));
const FiltersSheet = dynamic(() => import("./filters-sheet").then((m) => m.FiltersSheet));

export function CollectionShell({ collectorId }: { collectorId: number }) {
  return (
    <CollectionProvider collectorId={collectorId}>
      <CollectionBody />
    </CollectionProvider>
  );
}

function CollectionBody() {
  const { status, error, visibleRows, view, viewingRow, editingRow, filters, search, dispatch } = useCollection();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeCount =
    filters.teamIds.size + filters.locationIds.size + (filters.setId != null ? 1 : 0) +
    (filters.rookie ? 1 : 0) + (filters.auto ? 1 : 0) + (filters.relic ? 1 : 0) +
    (filters.graded ? 1 : 0) + (filters.forSale ? 1 : 0) + (filters.special ? 1 : 0) +
    (filters.photo ? 1 : 0);

  if (status === "error") {
    return <div className="mx-auto max-w-screen-md px-4 pt-6"><p className="text-sm text-gold">Couldn&apos;t load your collection: {error}</p></div>;
  }
  if (status === "loading") {
    return <div className="mx-auto max-w-screen-md px-4 pt-6"><p className="text-sm text-muted">Loading your collection…</p></div>;
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-w-screen-md flex-col px-2 pt-3">
      {/* sticky top: compact stats + search / filters */}
      <div className="flex shrink-0 flex-col gap-2 pb-2">
        <StatsStrip />
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input value={search} onChange={(e) => dispatch({ t: "search", value: e.target.value })}
              placeholder="Search your collection…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" />
            {search ? <button onClick={() => dispatch({ t: "search", value: "" })} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
          </div>
          <button onClick={() => setFiltersOpen(true)}
            className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-ink">
            <SlidersHorizontal className="size-4 text-muted" /> Filters
            {activeCount > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">{activeCount}</span> : null}
          </button>
          <SavedViewsControl />
          <ViewToggle />
        </div>
      </div>

      {/* list fills the remaining height */}
      <div className="min-h-0 flex-1">
        {visibleRows.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">No cards match your filters.</p>
        ) : view === "gallery" ? <GalleryView /> : view === "table" ? <TableView /> : <ListView />}
      </div>

      <CollectionFooter />

      {filtersOpen ? <FiltersSheet onClose={() => setFiltersOpen(false)} /> : null}
      {viewingRow ? <CardDetailModal /> : null}
      {editingRow ? <EditCardModal /> : null}
    </div>
  );
}
