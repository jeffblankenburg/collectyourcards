"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { CollectionProvider, useCollection } from "./collection-provider";
import { ViewToggle } from "./view-toggle";
import { SortControl } from "./sort-control";
import { ListView } from "./views/list-view";
import type { CompactRow } from "@/lib/collection/index-types";
import type { SortState, ViewMode } from "@/lib/collection/pipeline";

// Heavy views split out of the default (list) bundle, same as the owner shell.
const GalleryView = dynamic(() => import("./views/gallery-view").then((m) => m.GalleryView));
const TableView = dynamic(() => import("./views/table-view").then((m) => m.TableView));
const FiltersSheet = dynamic(() => import("./filters-sheet").then((m) => m.FiltersSheet));
const CardDetailModal = dynamic(() => import("./card-detail-modal").then((m) => m.CardDetailModal));

export interface PublicCollectionMeta {
  title: string;                       // view name or "<name>'s collection"
  ownerUsername: string | null;
  ownerLabel: string;                  // safe display label (never a phone number)
  truncated?: boolean;
  subtitle?: string;                   // e.g. "A live view of …"
}

// The interactive public collection: the SAME filter/sort/search/view engine as
// the owner's screen, in read-only publicMode (no values, locations, edits).
export function PublicCollection({ rows, initialView, initialSort, shareToken, meta }: { rows: CompactRow[]; initialView?: ViewMode; initialSort?: SortState; shareToken?: string; meta: PublicCollectionMeta }) {
  return (
    <CollectionProvider collectorId={0} publicMode initialRows={rows} initialView={initialView} initialSort={initialSort} shareToken={shareToken}>
      <PublicBody meta={meta} />
    </CollectionProvider>
  );
}

function PublicBody({ meta }: { meta: PublicCollectionMeta }) {
  const { visibleRows, view, search, filters, dispatch, viewingRow } = useCollection();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Only the public-relevant filters contribute to the badge count.
  const activeCount =
    filters.teamIds.size + (filters.setId != null ? 1 : 0) +
    (filters.rookie ? 1 : 0) + (filters.auto ? 1 : 0) + (filters.relic ? 1 : 0) + (filters.graded ? 1 : 0);

  const owner = meta.ownerUsername
    ? <Link href={`/u/${meta.ownerUsername}`} className="text-brand hover:underline">@{meta.ownerUsername}</Link>
    : <span>{meta.ownerLabel}</span>;

  return (
    <div className="mx-auto flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-w-screen-md flex-col px-2 pt-3">
      <div className="flex shrink-0 flex-col gap-2 pb-2">
        <div className="px-1">
          <h1 className="font-display text-xl text-ink">{meta.title}</h1>
          <p className="text-xs text-muted">{meta.subtitle ? `${meta.subtitle} ` : ""}by {owner}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
            <Search className="size-4 shrink-0 text-muted" aria-hidden />
            <input value={search} onChange={(e) => dispatch({ t: "search", value: e.target.value })}
              placeholder="Search these cards…"
              className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" />
            {search ? <button onClick={() => dispatch({ t: "search", value: "" })} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
          </div>
          <button onClick={() => setFiltersOpen(true)}
            className="relative flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm text-ink">
            <SlidersHorizontal className="size-4 text-muted" /> Filters
            {activeCount > 0 ? <span className="flex size-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-white">{activeCount}</span> : null}
          </button>
          <ViewToggle />
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {visibleRows.length === 0 ? (
          <p className="pt-10 text-center text-sm text-muted">No cards match.</p>
        ) : view === "gallery" ? <GalleryView /> : view === "table" ? <TableView /> : <ListView />}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-base/85 py-2 backdrop-blur [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
        <span className="shrink-0 text-xs tabular-nums text-muted">
          {visibleRows.length.toLocaleString()} cards{meta.truncated ? " (first 500)" : ""}
        </span>
        <SortControl />
      </div>

      {filtersOpen ? <FiltersSheet onClose={() => setFiltersOpen(false)} /> : null}
      {viewingRow ? <CardDetailModal /> : null}
    </div>
  );
}
