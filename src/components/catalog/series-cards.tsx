"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ListChecks, Plus, Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/lib/catalog/types";
import { playerName } from "@/lib/catalog/types";
import { CardTile } from "@/components/catalog/card-tile";
import type { LocationRow } from "@/lib/collection/index-types";
import { loadLocations } from "@/lib/collection/load-index";
import { bulkAddCards, createLocation, seriesOwnedCounts } from "@/lib/collection/mutations";
import { clearCachedRows, emitCollectionChanged } from "@/lib/collection/collection-cache";

const PAGE = 200;

// Series checklist: browse + search every card, see which you own, and bulk-add
// a selection to your collection with a location (e.g. "In Transit"). The full
// checklist is loaded client-side so "select all / missing" covers the whole set.
export function SeriesCards({
  seriesId, initialCards, totalCount, seriesName,
}: {
  seriesId: number;
  initialCards: Card[];
  totalCount?: number | null;
  seriesName?: string | null;
}) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [q, setQ] = useState("");
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [collectorId, setCollectorId] = useState<number | null>(null);
  const [owned, setOwned] = useState<Map<number, number>>(new Map());
  const [locations, setLocations] = useState<LocationRow[]>([]);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  // Load the full checklist (beyond the server's first page) so selection covers
  // the whole series.
  useEffect(() => {
    if (initialCards.length < PAGE) return; // already complete
    let cancelled = false;
    (async () => {
      const sb = createClient();
      const all = [...initialCards];
      let after = initialCards[initialCards.length - 1]?.card_id ?? null;
      for (let i = 0; i < 10 && after != null; i++) {
        const { data } = await sb.rpc("card_search", { p_series_id: seriesId, p_limit: PAGE, p_after: after });
        const page = (data as Card[]) ?? [];
        all.push(...page);
        if (page.length < PAGE) break;
        after = page[page.length - 1].card_id;
      }
      if (!cancelled) setCards(all);
    })();
    return () => { cancelled = true; };
  }, [seriesId, initialCards]);

  // Auth + ownership + locations (owner-scoped; anon sees a plain checklist).
  const loadOwnership = useCallback(async () => {
    try { setOwned(await seriesOwnedCounts(seriesId)); } catch { /* ignore */ }
  }, [seriesId]);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(({ data }) => {
      const isAuthed = !!data.user;
      setAuthed(isAuthed);
      if (!isAuthed) return;
      void loadOwnership();
      loadLocations().then(setLocations).catch(() => {});
      sb.from("profiles").select("collector_id").maybeSingle()
        .then(({ data: p }) => setCollectorId((p as { collector_id?: number } | null)?.collector_id ?? null));
    });
  }, [loadOwnership]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cards;
    const toks = term.split(/\s+/).filter(Boolean);
    return cards.filter((c) => {
      const hay = `#${c.card_number ?? ""} ${c.players.map(playerName).join(" ")} ${c.color?.name ?? ""}`.toLowerCase();
      return toks.every((t) => hay.includes(t));
    });
  }, [cards, q]);

  const ownedUnique = useMemo(() => cards.reduce((n, c) => n + (owned.get(c.card_id) ? 1 : 0), 0), [cards, owned]);
  const total = totalCount ?? cards.length;
  const pct = total > 0 ? Math.round((ownedUnique / total) * 100) : 0;

  const toggle = (cardId: number) => setSelected((s) => {
    const next = new Set(s);
    next.has(cardId) ? next.delete(cardId) : next.add(cardId);
    return next;
  });
  const selectAll = () => setSelected(new Set(filtered.map((c) => c.card_id)));
  const selectMissing = () => setSelected(new Set(filtered.filter((c) => !owned.get(c.card_id)).map((c) => c.card_id)));
  const clearSel = () => setSelected(new Set());

  const exitSelect = () => { setSelectMode(false); setSelected(new Set()); setSheetOpen(false); };

  const doAdd = async (locationId: number | null) => {
    if (collectorId == null || selected.size === 0 || adding) return;
    setAdding(true);
    try {
      const ids = [...selected];
      const n = await bulkAddCards(collectorId, ids, locationId, seriesName ? `Added from ${seriesName}` : null);
      clearCachedRows();
      emitCollectionChanged();
      await loadOwnership();
      exitSelect();
      setDone(n); setTimeout(() => setDone(null), 2500);
    } catch (e) { alert((e as Error).message); } finally { setAdding(false); }
  };

  return (
    <div className={selectMode ? "pb-24" : ""}>
      {/* ownership completion (signed-in only) */}
      {authed && total > 0 ? (
        <div className="mb-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink"><span className="font-semibold">{ownedUnique}</span> of {total} owned</span>
            <span className="font-semibold tabular-nums text-emerald-300">{pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-emerald-400/80" style={{ width: `${pct}%` }} />
          </div>
        </div>
      ) : null}

      {/* search + select toggle */}
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
          <Search className="size-4 shrink-0 text-muted" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} type="search" inputMode="search"
            placeholder="Search cards in this series…"
            className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70" />
          {q ? <button onClick={() => setQ("")} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
        </div>
        {authed ? (
          <button onClick={() => (selectMode ? exitSelect() : setSelectMode(true))}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-sm transition ${selectMode ? "border-brand/60 bg-brand/15 text-ink" : "border-white/10 bg-white/[0.05] text-ink"}`}>
            <ListChecks className="size-4 text-muted" /> {selectMode ? "Done" : "Select"}
          </button>
        ) : null}
      </div>

      {/* quick select actions */}
      {selectMode ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <button onClick={selectAll} className="rounded-full border border-white/10 px-3 py-1.5 text-muted hover:text-ink">Select all ({filtered.length})</button>
          <button onClick={selectMissing} className="rounded-full border border-white/10 px-3 py-1.5 text-muted hover:text-ink">Select missing</button>
          <button onClick={clearSel} className="rounded-full border border-white/10 px-3 py-1.5 text-muted hover:text-ink">Clear</button>
        </div>
      ) : null}

      {done != null ? (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">
          <CheckCircle2 className="size-4" /> Added {done} card{done === 1 ? "" : "s"} to your collection.
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        {filtered.map((c) => (
          <CardTile key={c.card_id} card={c}
            owned={authed ? owned.get(c.card_id) : undefined}
            selection={selectMode ? { selected: selected.has(c.card_id), onToggle: () => toggle(c.card_id) } : undefined} />
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{q.trim() ? "No cards match." : "No cards entered for this series yet."}</p>
      ) : null}

      {/* bottom action bar */}
      {selectMode ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-base/95 backdrop-blur [padding-bottom:calc(0.75rem+env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-screen-sm items-center justify-between gap-3 px-4 pt-3">
            <span className="text-sm text-muted"><span className="font-semibold text-ink">{selected.size}</span> selected</span>
            <button onClick={() => setSheetOpen(true)} disabled={selected.size === 0}
              className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40">
              Add to collection
            </button>
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <LocationSheet
          locations={locations} collectorId={collectorId} count={selected.size} adding={adding}
          onClose={() => setSheetOpen(false)}
          onCreated={(loc) => setLocations((ls) => [...ls, loc].sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "")))}
          onConfirm={doAdd}
        />
      ) : null}
    </div>
  );
}

// Pick (or create) a location for the bulk add. Defaults to an existing
// "In Transit" location when present.
function LocationSheet({
  locations, collectorId, count, adding, onClose, onCreated, onConfirm,
}: {
  locations: LocationRow[];
  collectorId: number | null;
  count: number;
  adding: boolean;
  onClose: () => void;
  onCreated: (loc: LocationRow) => void;
  onConfirm: (locationId: number | null) => void;
}) {
  const inTransit = locations.find((l) => /in\s*transit/i.test(l.location ?? ""));
  const [li, setLi] = useState<string>(inTransit ? String(inTransit.user_location_id) : "");
  const [newLoc, setNewLoc] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const creating = useRef(false);

  const addLocation = async () => {
    const name = (newLoc ?? "").trim();
    if (!name || collectorId == null || creating.current) { setNewLoc(null); return; }
    creating.current = true;
    try {
      const loc = await createLocation(collectorId, name);
      onCreated(loc); setLi(String(loc.user_location_id)); setNewLoc(null); setErr(null);
    } catch (e) { setErr((e as Error).message); } finally { creating.current = false; }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border border-white/10 bg-base p-5 sm:rounded-3xl [padding-bottom:calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Add {count} card{count === 1 ? "" : "s"}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="size-5" /></button>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Location</span>
          {newLoc === null ? (
            <div className="flex gap-2">
              <select value={li} onChange={(e) => setLi(e.target.value)}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand">
                <option value="">No location</option>
                {locations.map((l) => <option key={l.user_location_id} value={l.user_location_id}>{l.location}</option>)}
              </select>
              <button type="button" onClick={() => { setNewLoc(""); setErr(null); }} title="New location"
                className="rounded-xl border border-white/10 px-3 text-muted hover:text-ink"><Plus className="size-4" /></button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input autoFocus value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="e.g. In Transit"
                onKeyDown={(e) => { if (e.key === "Enter") void addLocation(); }}
                className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
              <button type="button" onClick={addLocation} className="rounded-xl bg-brand px-3 text-sm font-semibold text-white">Add</button>
              <button type="button" onClick={() => { setNewLoc(null); setErr(null); }} className="rounded-xl border border-white/10 px-3 text-muted">✕</button>
            </div>
          )}
          {err ? <p className="text-xs text-gold">{err}</p> : null}
        </div>

        <button onClick={() => onConfirm(li ? Number(li) : null)} disabled={adding}
          className="h-11 rounded-2xl bg-brand font-semibold text-white transition active:scale-[0.99] disabled:opacity-60">
          {adding ? "Adding…" : `Add ${count} to collection`}
        </button>
      </div>
    </div>
  );
}
