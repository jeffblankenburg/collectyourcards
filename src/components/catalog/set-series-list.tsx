"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

export interface SeriesRow {
  series_id: number;
  name: string | null;
  slug: string;
  card_count: number | null;
  is_base: boolean | null;
  print_run_display: string | null;
  color_id: number | null;
}

// The set's series (all loaded by the server page) with an instant name filter.
// One set has few series, so a client-side `includes` is plenty.
export function SetSeriesList({ series }: { series: SeriesRow[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return series;
    return series.filter((s) => (s.name ?? "").toLowerCase().includes(term));
  }, [series, q]);

  return (
    <div>
      {series.length > 6 ? (
        <div className="mb-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            inputMode="search"
            placeholder="Filter series…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />
          {q ? <button onClick={() => setQ("")} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
        </div>
      ) : null}

      <div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5">
        {filtered.map((se) => (
          <Link key={se.series_id} href={`/series/${se.slug}`} className="flex items-center gap-2 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
            {se.color_id ? <span className="inline-block size-2 rounded-full bg-white/40" /> : null}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">
                {se.name}
                {se.is_base ? <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">BASE</span> : null}
              </div>
              <div className="text-xs text-muted">
                {se.card_count ?? 0} cards{se.print_run_display ? ` · ${se.print_run_display}` : ""}
              </div>
            </div>
            <span className="text-muted">›</span>
          </Link>
        ))}
        {filtered.length === 0 ? <div className="bg-white/[0.03] px-4 py-6 text-center text-sm text-muted">No series match.</div> : null}
      </div>
    </div>
  );
}
