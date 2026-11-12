"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, User, Shield, Layers, ListOrdered } from "lucide-react";
import { useEntitySearch } from "@/lib/use-entity-search";
import { playerName, type Card, type SearchResults } from "@/lib/catalog/types";

type Row = {
  key: string; href: string; icon: ReactNode; title: string;
  subtitle?: string; count: number; countLabel: string;
  nickname?: string | null; teams?: SearchResults["players"][number]["teams"];
};

function buildGroups(r: SearchResults): { label: string; rows: Row[] }[] {
  return [
    { label: "Players", rows: r.players.map((p) => ({
      key: `player-${p.player_id}`, href: `/players/${p.slug}`, icon: <User className="size-4" />,
      title: playerName(p), nickname: p.nick_name, teams: p.teams, count: p.card_count ?? 0, countLabel: "cards",
    })) },
    { label: "Teams", rows: r.teams.map((t) => ({
      key: `team-${t.team_id}`, href: `/teams/${t.slug}`, icon: <Shield className="size-4" />,
      title: [t.city, t.name].filter(Boolean).join(" "), subtitle: t.abbreviation ?? undefined,
      count: t.player_count ?? 0, countLabel: "players",
    })) },
    { label: "Sets", rows: r.sets.map((s) => ({
      key: `set-${s.set_id}`, href: `/sets/${s.slug}`, icon: <Layers className="size-4" />,
      title: s.name ?? "", subtitle: s.year ? String(s.year) : undefined, count: s.series_count ?? 0, countLabel: "series",
    })) },
    { label: "Series", rows: r.series.map((se) => ({
      key: `series-${se.series_id}`, href: `/series/${se.slug}`, icon: <ListOrdered className="size-4" />,
      title: se.name ?? "", subtitle: se.set?.name ?? undefined, count: se.card_count ?? 0, countLabel: "cards",
    })) },
  ].filter((g) => g.rows.length > 0);
}

function highlight(text: string, q: string): ReactNode {
  const term = q.trim();
  if (!term) return text;
  const i = text.toLowerCase().indexOf(term.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark className="bg-transparent font-semibold text-gold">{text.slice(i, i + term.length)}</mark>{text.slice(i + term.length)}</>;
}

export function HomeSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState(-1);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  const { results, loading, elapsed } = useEntitySearch(query);
  const cards = results.cards ?? [];
  const groups = useMemo(() => buildGroups(results), [results]);
  const flatHrefs = useMemo(
    () => [...cards.map((c) => `/cards/${c.card_id}`), ...groups.flatMap((g) => g.rows.map((r) => r.href))],
    [cards, groups],
  );
  const total = flatHrefs.length;

  useEffect(() => setSel(-1), [flatHrefs.length]);
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const term = query.trim();
  const showPanel = open && term.length >= 2;
  const goFull = () => { setOpen(false); router.push(`/search?q=${encodeURIComponent(term)}`); };
  const go = (href: string) => { setOpen(false); router.push(href); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!showPanel) { if (e.key === "Enter" && term) goFull(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, total - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, -1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (sel >= 0 && flatHrefs[sel]) go(flatHrefs[sel]); else if (term) goFull(); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2.5 rounded-full border border-white/12 bg-white/[0.06] py-2.5 pr-2.5 pl-4 backdrop-blur transition focus-within:border-brand/60 focus-within:bg-white/[0.09]">
        {loading ? <Loader2 className="size-[18px] shrink-0 animate-spin text-brand" aria-hidden />
                 : <Search className="size-[18px] shrink-0 text-muted" aria-hidden />}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="search" enterKeyHint="search"
          placeholder="Search players, cards, sets… e.g. “PA-SB Bieber”"
          aria-label="Search the card database"
          className="w-full bg-transparent text-[15px] text-ink placeholder:text-muted/70 focus:outline-none"
        />
      </div>

      {showPanel ? (
        <div className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10 bg-base/95 shadow-2xl backdrop-blur-xl">
          {total === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-muted">No matches for &ldquo;{term}&rdquo;. Try a different spelling.</div>
          ) : (
            <>
              {/* Cards first — the answer for a specific query like "PA-SB Bieber" */}
              {cards.length > 0 ? (
                <div>
                  <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Cards</div>
                  {cards.map((c, i) => (
                    <button key={`card-${c.card_id}`} onMouseEnter={() => setSel(i)} onClick={() => go(`/cards/${c.card_id}`)}
                      className={`flex w-full items-stretch gap-2.5 py-2 pr-4 text-left transition ${sel === i ? "bg-white/10" : "hover:bg-white/5"}`}>
                      <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: c.color?.hex || "transparent" }} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-xs text-muted">#{c.card_number}</span>
                          <span className="truncate text-sm font-medium text-ink">{c.players.map(playerName).filter(Boolean).join(", ") || c.series.name}</span>
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {c.set.year} {c.series.name}
                          {c.is_autograph ? " · AUTO" : ""}{c.is_rookie ? " · RC" : ""}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}

              {groups.map((g, gi) => {
                const offset = cards.length + groups.slice(0, gi).reduce((n, x) => n + x.rows.length, 0);
                return (
                  <div key={g.label}>
                    <div className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{g.label}</div>
                    {g.rows.map((row, ri) => {
                      const idx = offset + ri;
                      return (
                        <button key={row.key} onMouseEnter={() => setSel(idx)} onClick={() => go(row.href)}
                          className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${sel === idx ? "bg-white/10" : "hover:bg-white/5"}`}>
                          <span className="flex size-6 shrink-0 items-center justify-center text-muted">{row.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm text-ink">{highlight(row.title, term)}</span>
                              {row.nickname ? <span className="truncate text-xs text-muted">&ldquo;{row.nickname}&rdquo;</span> : null}
                              {row.teams && row.teams.length > 0 ? (
                                <span className="ml-0.5 flex shrink-0 items-center gap-1">
                                  {row.teams.slice(0, 4).map((t) => (
                                    <span key={t.team_id} title={t.abbreviation ?? ""}
                                      className="inline-flex size-[18px] items-center justify-center rounded-full text-[8px] font-bold text-white"
                                      style={{ backgroundColor: t.primary_color || "#475569", border: `1.5px solid ${t.secondary_color || "#94a3b8"}` }}>
                                      {t.abbreviation}
                                    </span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            {row.subtitle ? <span className="block truncate text-xs text-muted">{row.subtitle}</span> : null}
                          </span>
                          <span className="flex shrink-0 flex-col items-center">
                            <span className="text-sm font-bold tabular-nums text-ink">{row.count.toLocaleString()}</span>
                            <span className="text-[10px] uppercase tracking-wide text-muted">{row.countLabel}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}

              <button onClick={goFull} className="flex w-full items-center justify-between border-t border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.08]">
                <span className="text-sm font-medium text-ink">View all results for &ldquo;{term}&rdquo;</span>
                <span className="text-xs text-muted">{elapsed != null ? `${elapsed}ms` : ""}</span>
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
