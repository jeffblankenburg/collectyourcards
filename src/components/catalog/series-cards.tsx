"use client";

import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/lib/catalog/types";
import { CardTile } from "@/components/catalog/card-tile";

// Cards within a series, with an instant free-text filter. The first page is
// rendered server-side (initialCards); typing re-queries card_search scoped to
// this series (p_q) so matches beyond the first page are still found.
export function SeriesCards({ seriesId, initialCards }: { seriesId: number; initialCards: Card[] }) {
  const [q, setQ] = useState("");
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  useEffect(() => {
    const term = q.trim();
    const id = setTimeout(async () => {
      const mine = ++reqId.current;
      if (!term) { setCards(initialCards); setLoading(false); return; }
      setLoading(true);
      const { data } = await createClient().rpc("card_search", {
        p_series_id: seriesId, p_limit: 200, p_q: term,
      });
      if (mine === reqId.current) { setCards((data as Card[]) ?? []); setLoading(false); }
    }, 200);
    return () => clearTimeout(id);
  }, [q, seriesId, initialCards]);

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2">
        <Search className="size-4 shrink-0 text-muted" aria-hidden />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
          inputMode="search"
          placeholder="Search cards in this series…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
        />
        {q ? <button onClick={() => setQ("")} className="shrink-0 text-muted hover:text-ink"><X className="size-4" /></button> : null}
      </div>

      <div className="flex flex-col gap-2">
        {cards.map((c) => <CardTile key={c.card_id} card={c} />)}
      </div>
      {cards.length === 0 ? (
        <p className="mt-6 text-sm text-muted">{loading ? "Searching…" : q.trim() ? "No cards match." : "No cards entered for this series yet."}</p>
      ) : null}
    </div>
  );
}
