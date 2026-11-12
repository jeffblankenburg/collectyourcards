"use client";

import { useEffect, useRef, useState } from "react";

type Kind = "players" | "teams" | "sets" | "series";

// Debounced catalog search backed by /api/search (search_entities). Returns the
// picked raw item to the caller.
export function EntitySearch({ kind, onPick, placeholder, autoFocus }: {
  kind: Kind; onPick: (item: Record<string, unknown>) => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Record<string, unknown>[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => {
      abort.current?.abort(); abort.current = new AbortController();
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: abort.current.signal });
        const d = await r.json();
        setHits((d[kind] ?? []).slice(0, 10));
      } catch { /* aborted */ }
    }, 200);
    return () => clearTimeout(t);
  }, [q, kind]);

  const label = (it: Record<string, unknown>): string => {
    if (kind === "players") return [it.first_name, it.last_name].filter(Boolean).join(" ");
    if (kind === "teams") return [it.city, it.name].filter(Boolean).join(" ");
    if (kind === "sets") return `${it.name}${it.year ? ` (${it.year})` : ""}`;
    return String(it.name ?? "");
  };
  const sub = (it: Record<string, unknown>): string => {
    if (kind === "players") return `${it.card_count ?? 0} cards`;
    if (kind === "teams") return String(it.abbreviation ?? "");
    if (kind === "series") return String((it.set as { name?: string })?.name ?? "");
    return String(it.card_count ?? "");
  };

  return (
    <div>
      <input autoFocus={autoFocus} value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder ?? `Search ${kind}…`}
        className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
      {hits.length > 0 ? (
        <div className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
          {hits.map((it, i) => (
            <button key={i} onClick={() => { onPick(it); setQ(""); setHits([]); }}
              className="flex w-full items-center justify-between bg-white/[0.03] px-4 py-2.5 text-left text-sm transition hover:bg-white/[0.07]">
              <span className="truncate text-ink">{label(it)}</span>
              <span className="shrink-0 text-xs text-muted">{sub(it)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
