"use client";

import { useState } from "react";
import { ArrowDown, ArrowDownUp, ArrowUp } from "lucide-react";
import { useCollection } from "./collection-provider";
import type { SortKey } from "@/lib/collection/pipeline";

const OPTS: { key: SortKey; label: string }[] = [
  { key: "cr", label: "Date added" },
  { key: "n", label: "Card #" },
  { key: "player", label: "Player" },
  { key: "se", label: "Series" },
  { key: "sn", label: "Serial #" },
  { key: "g", label: "Grade" },
  { key: "cv", label: "Value" },
  { key: "pp", label: "Paid" },
  { key: "ln", label: "Location" },
];

// Sort keys that reference owner-private fields — never offered on a public view.
const PUBLIC_SORT_KEYS = new Set<SortKey>(["cr", "n", "player", "se", "sn", "g"]);

// Sort picker (the engine already exists in the pipeline — this is the missing
// UI). Tap a field to sort by it; tap the active field again to reverse.
export function SortControl() {
  const { sort, dispatch, publicMode } = useCollection();
  const [open, setOpen] = useState(false);
  const opts = publicMode ? OPTS.filter((o) => PUBLIC_SORT_KEYS.has(o.key)) : OPTS;
  const cur = opts.find((o) => o.key === sort.key);
  const DirIcon = sort.dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-ink">
        <ArrowDownUp className="size-3.5 text-muted" />
        <span className="max-w-[5.5rem] truncate">{cur?.label ?? "Sort"}</span>
        <DirIcon className="size-3 text-muted" />
      </button>

      {open ? (
        <>
          <button aria-label="Close sort menu" className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 z-50 mb-2 w-44 rounded-2xl border border-white/10 bg-base p-1 shadow-xl">
            {opts.map((o) => {
              const active = o.key === sort.key;
              const DI = sort.dir === "asc" ? ArrowUp : ArrowDown;
              return (
                <button key={o.key} onClick={() => dispatch({ t: "sort", key: o.key })}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-white/5 ${active ? "text-ink" : "text-muted"}`}>
                  <span>{o.label}</span>
                  {active ? <DI className="size-3.5 text-brand" /> : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
