import type { Metadata } from "next";
import Link from "next/link";
import { SearchBox } from "@/components/search/search-box";
import { CardTile } from "@/components/catalog/card-tile";
import { searchEntities } from "@/lib/catalog/queries";
import { playerName } from "@/lib/catalog/types";

export const metadata: Metadata = { title: "Search" };
export const instant = false; // reads searchParams + live DB

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const results = term.length >= 2 ? await searchEntities(term, 12) : null;

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Search</h1>
      <div className="mt-4">
        <SearchBox initialQuery={term} />
      </div>

      {results ? (
        <div className="mt-6 flex flex-col gap-6">
          {results.cards.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Cards</h2>
              <div className="flex flex-col gap-2">
                {results.cards.map((c) => <CardTile key={c.card_id} card={c} />)}
              </div>
            </section>
          ) : null}
          <ResultGroup label="Players" rows={results.players.map((p) => ({
            key: `p${p.player_id}`, title: playerName(p), sub: `${p.card_count ?? 0} cards`, href: `/players/${p.slug}`,
          }))} />
          <ResultGroup label="Teams" rows={results.teams.map((t) => ({
            key: `t${t.team_id}`, title: [t.city, t.name].filter(Boolean).join(" "), sub: t.abbreviation ?? "", href: `/teams/${t.slug}`,
          }))} />
          <ResultGroup label="Sets" rows={results.sets.map((s) => ({
            key: `s${s.set_id}`, title: s.name ?? "", sub: s.year ? String(s.year) : "", href: `/sets/${s.slug}`,
          }))} />
          <ResultGroup label="Series" rows={results.series.map((se) => ({
            key: `se${se.series_id}`, title: se.name ?? "", sub: se.set?.name ?? "", href: `/series/${se.slug}`,
          }))} />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">Type at least 2 characters to search the catalog.</p>
      )}
    </main>
  );
}

function ResultGroup({ label, rows }: { label: string; rows: { key: string; title: string; sub: string; href: string }[] }) {
  if (!rows.length) return null;
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{label}</h2>
      <div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/5">
        {rows.map((r) => (
          <Link key={r.key} href={r.href} className="flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.06]">
            <span className="truncate text-sm text-ink">{r.title}</span>
            <span className="shrink-0 text-xs text-muted">{r.sub}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
