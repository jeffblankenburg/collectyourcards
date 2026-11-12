"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useCollection } from "./collection-provider";
import { SortControl } from "./sort-control";

// Fixed thumb-zone bar: result count · refresh · sort. (View toggle lives up top
// next to Filters.) Sits at the bottom so the list gets max height.
export function CollectionFooter() {
  const { visibleRows, reload } = useCollection();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try { await reload(); } finally { setRefreshing(false); }
  }

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-base/85 py-2 backdrop-blur [padding-bottom:calc(0.5rem+env(safe-area-inset-bottom))]">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-xs tabular-nums text-muted">{visibleRows.length.toLocaleString()} cards</span>
        <button onClick={refresh} disabled={refreshing} aria-label="Refresh collection" title="Refresh collection"
          className="rounded-full p-1 text-muted transition hover:text-ink disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>
      <SortControl />
    </div>
  );
}
