"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Card, SearchResults } from "@/lib/catalog/types";
import { playerName } from "@/lib/catalog/types";

const EMPTY: SearchResults = { players: [], teams: [], sets: [], series: [], cards: [] };

// Debounced instant search. Mobile-first: big input, tap-through results.
export function SearchBox({ initialQuery = "" }: { initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults(EMPTY); return; }
    const id = setTimeout(async () => {
      abort.current?.abort();
      abort.current = new AbortController();
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: abort.current.signal });
        setResults(await res.json());
        setOpen(true);
      } catch { /* aborted */ }
    }, 150);
    return () => clearTimeout(id);
  }, [q]);

  const go = (href: string) => { setOpen(false); router.push(href); };
  const cards = results.cards ?? [];
  const hasAny = cards.length || results.players.length || results.teams.length || results.sets.length || results.series.length;
  // When the query carries a card-number-ish token, specific cards are the most
  // likely target — float them above the entity sections.
  const cardsFirst = /[\d-]/.test(q);

  const cardsSection = cards.length ? (
    <div className="mb-1" key="cards">
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Cards</div>
      {cards.slice(0, 5).map((c) => <CardRow key={`c${c.card_id}`} card={c} onGo={go} />)}
    </div>
  ) : null;

  return (
    <div className="relative">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => q.trim().length >= 2 && setOpen(true)}
        type="search"
        inputMode="search"
        placeholder="Search players, teams, sets, series…"
        className="h-14 w-full rounded-2xl border border-white/10 bg-white/5 px-5 text-base text-ink outline-none placeholder:text-muted focus:border-brand"
      />

      {open && hasAny ? (
        <div className="absolute z-50 mt-2 max-h-[70vh] w-full overflow-y-auto rounded-2xl border border-white/10 bg-base/95 p-2 shadow-2xl backdrop-blur-xl">
          {cardsFirst ? cardsSection : null}
          <Section label="Players" items={results.players.map((p) => ({
            key: `p${p.player_id}`, title: playerName(p), sub: `${p.card_count ?? 0} cards`, href: `/players/${p.slug}`,
          }))} onGo={go} />
          <Section label="Teams" items={results.teams.map((t) => ({
            key: `t${t.team_id}`, title: [t.city, t.name].filter(Boolean).join(" "), sub: t.abbreviation ?? "", href: `/teams/${t.slug}`,
          }))} onGo={go} />
          <Section label="Sets" items={results.sets.map((s) => ({
            key: `s${s.set_id}`, title: s.name ?? "", sub: s.year ? String(s.year) : "", href: `/sets/${s.slug}`,
          }))} onGo={go} />
          <Section label="Series" items={results.series.map((se) => ({
            key: `se${se.series_id}`, title: se.name ?? "", sub: se.set?.name ?? "", href: `/series/${se.slug}`,
          }))} onGo={go} />
          {cardsFirst ? null : cardsSection}
        </div>
      ) : null}
    </div>
  );
}

function Section({
  label, items, onGo,
}: {
  label: string;
  items: { key: string; title: string; sub: string; href: string }[];
  onGo: (href: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="mb-1">
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      {items.map((it) => (
        <button
          key={it.key}
          onClick={() => onGo(it.href)}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
        >
          <span className="truncate text-sm text-ink">{it.title}</span>
          <span className="shrink-0 text-xs text-muted">{it.sub}</span>
        </button>
      ))}
    </div>
  );
}

// A specific card result: #number · players · series. Richer than the generic
// Section row so a number-first query (e.g. "145 ohtani") reads at a glance.
function CardRow({ card, onGo }: { card: Card; onGo: (href: string) => void }) {
  const names = card.players.map(playerName).filter(Boolean).join(", ") || "—";
  return (
    <button
      onClick={() => onGo(`/cards/${card.card_id}`)}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/5"
    >
      <span className="shrink-0 font-mono text-xs text-muted">#{card.card_number}</span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink">{names}</span>
      <span className="shrink-0 truncate text-xs text-muted">
        {card.set?.year ? `${card.set.year} ` : ""}{card.series?.name ?? ""}
      </span>
    </button>
  );
}
