"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CardEditor } from "./card-editor";
import { playerName } from "@/lib/catalog/types";
import type { Card } from "@/lib/catalog/types";

export function SeriesCardManager({ seriesId }: { seriesId: number }) {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null); // null + open = new card

  const load = useCallback(async () => {
    const { data } = await createClient().rpc("card_search", { p_series_id: seriesId, p_player_id: null, p_team_id: null, p_limit: 300, p_after: null });
    setCards((data as Card[]) ?? []);
  }, [seriesId]);
  useEffect(() => { void load(); }, [load]);

  const edit = (c: Card | null) => { setEditing(c); setOpen(true); };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm text-muted">{cards?.length ?? "…"} cards</span>
        <button onClick={() => edit(null)} className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-sm font-semibold text-white"><Plus className="size-4" /> Add card</button>
      </div>
      <div className="flex flex-col divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
        {(cards ?? []).map((c) => (
          <button key={c.card_id} onClick={() => edit(c)} className="flex items-center gap-3 bg-white/[0.03] px-4 py-2.5 text-left text-sm transition hover:bg-white/[0.07]">
            <span className="w-16 shrink-0 font-mono text-xs text-muted">#{c.card_number}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{c.players.map(playerName).filter(Boolean).join(", ") || "—"}</span>
            <span className="flex shrink-0 gap-1 text-[10px] text-muted">
              {c.is_rookie ? <b className="text-gold">RC</b> : null}{c.is_autograph ? <b className="text-brand">AU</b> : null}{c.is_relic ? <b className="text-violet-300">RL</b> : null}
            </span>
          </button>
        ))}
        {cards && cards.length === 0 ? <div className="bg-white/[0.03] px-4 py-6 text-center text-sm text-muted">No cards yet.</div> : null}
      </div>

      {open ? <CardEditor card={editing} seriesId={seriesId} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); void load(); }} /> : null}
    </div>
  );
}
