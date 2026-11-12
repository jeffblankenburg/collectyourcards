"use client";

import { useEffect } from "react";
import { LayoutGrid, List, Table2 } from "lucide-react";
import { useCollection } from "./collection-provider";
import type { ViewMode } from "@/lib/collection/pipeline";

const LS_KEY = "cyc.collection.view";
const ORDER: ViewMode[] = ["list", "gallery", "table"];
const ICON: Record<ViewMode, React.ReactNode> = {
  list: <List className="size-4" />,
  gallery: <LayoutGrid className="size-4" />,
  table: <Table2 className="size-4" />,
};
const LABEL: Record<ViewMode, string> = { list: "Card", gallery: "Gallery", table: "Table" };

// Single button that cycles list → gallery → table. Shows the CURRENT view's
// icon; tap to advance. Persists the choice (shared key with the old switch).
export function ViewToggle() {
  const { view, dispatch } = useCollection();

  useEffect(() => {
    const v = localStorage.getItem(LS_KEY);
    if (v === "list" || v === "gallery" || v === "table") dispatch({ t: "view", view: v });
  }, [dispatch]);

  function next() {
    const nv = ORDER[(ORDER.indexOf(view) + 1) % ORDER.length];
    dispatch({ t: "view", view: nv });
    try { localStorage.setItem(LS_KEY, nv); } catch { /* ignore */ }
  }

  return (
    <button onClick={next} aria-label={`View: ${LABEL[view]} — tap to switch`} title={`${LABEL[view]} view · tap to switch`}
      className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-2 text-ink">
      {ICON[view]}
    </button>
  );
}
