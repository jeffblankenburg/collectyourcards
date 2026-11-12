"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSeriesCompletion, type SeriesCompletion } from "@/lib/lists/mutations";

export function CompletionView() {
  const [rows, setRows] = useState<SeriesCompletion[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { getSeriesCompletion().then(setRows).catch((e) => { setErr(e.message); setRows([]); }); }, []);

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <Link href="/lists" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> Lists</Link>
      <h1 className="mt-3 font-display text-2xl text-ink">Set completion</h1>
      <p className="mt-1 text-sm text-muted">How close you are on every series you own a card in.</p>

      {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}

      {rows === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No cards yet — add some to your collection to track completion.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {rows.map((r) => {
            const pct = r.total > 0 ? Math.min(100, Math.round((r.owned / r.total) * 100)) : null;
            const complete = pct === 100;
            return (
              <li key={r.series_id}>
                <Link href={`/series/${r.series_slug}`} className="block border border-white/5 bg-white/[0.03] p-3 transition hover:border-white/15">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{r.series_name}</div>
                      <div className="truncate text-xs text-muted">{r.set_name}</div>
                    </div>
                    <div className="shrink-0 font-mono text-xs text-muted">
                      {r.owned}{r.total > 0 ? `/${r.total}` : ""} {pct !== null ? <span className={complete ? "text-gold" : "text-ink"}>· {pct}%</span> : null}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${complete ? "bg-gold" : "bg-brand"}`} style={{ width: `${pct ?? Math.min(100, r.owned)}%` }} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
