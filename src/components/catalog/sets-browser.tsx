"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import type { SetIndexRow } from "@/lib/catalog/queries";

// Client-side searchable + sport-filterable set browser. The full set list
// (a few thousand rows) is loaded once by the server page and filtered in the
// browser — instant, offline-friendly, mobile-first (v1 parity, phone-shaped).
export function SetsBrowser({ sets }: { sets: SetIndexRow[] }) {
  const [q, setQ] = useState("");
  const [sport, setSport] = useState<string>("all");

  // Distinct sports present, most-common first — drives the filter chips.
  const sports = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sets) {
      if (!s.sport) continue;
      counts.set(s.sport, (counts.get(s.sport) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
  }, [sets]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return sets.filter((s) => {
      if (sport !== "all" && s.sport !== sport) return false;
      if (!term) return true;
      return (s.name ?? "").toLowerCase().includes(term) || String(s.year ?? "").includes(term);
    });
  }, [sets, q, sport]);

  return (
    <div>
      {/* sticky search + sport chips */}
      <div className="sticky top-0 z-10 -mx-4 bg-base/90 px-4 pb-3 pt-1 backdrop-blur-md">
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            type="search"
            inputMode="search"
            placeholder="Search sets…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
          />
          {q ? <button onClick={() => setQ("")} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
        </div>

        {sports.length >= 1 ? (
          <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip label="All" active={sport === "all"} onClick={() => setSport("all")} />
            {sports.map((s) => (
              <Chip key={s} label={cap(s)} active={sport === s} onClick={() => setSport(s)} />
            ))}
          </div>
        ) : null}
      </div>

      <p className="px-1 pt-1 text-xs text-muted">{filtered.length} {filtered.length === 1 ? "set" : "sets"}</p>

      <div className="mt-2 flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5">
        {filtered.map((s) => (
          <Link key={s.set_id} href={`/sets/${s.slug}`} className="flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-ink">{s.name}</div>
              <div className="text-xs text-muted">{s.year ?? "—"} · {s.series_count ?? 0} series · {s.card_count ?? 0} cards</div>
            </div>
            <span className="text-muted">›</span>
          </Link>
        ))}
        {filtered.length === 0 ? <div className="bg-white/[0.03] px-4 py-6 text-center text-sm text-muted">No sets match.</div> : null}
      </div>
    </div>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active ? "border-brand bg-brand/20 text-ink" : "border-white/10 bg-white/[0.04] text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
