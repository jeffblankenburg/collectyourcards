"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mergePlayer, updatePlayer } from "@/lib/admin/mutations";
import { EntitySearch } from "./entity-search";

interface PlayerRow { player_id: number; first_name: string | null; last_name: string | null; nick_name: string | null; is_hof: boolean | null; birthdate: string | null; card_count: number | null; slug: string }

export function PlayerEditor({ playerId, onChanged }: { playerId: number; onChanged?: () => void }) {
  const [row, setRow] = useState<PlayerRow | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [nick, setNick] = useState("");
  const [hof, setHof] = useState(false);
  const [bd, setBd] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ id: number; name: string } | null>(null);

  useEffect(() => {
    createClient().from("player").select("player_id, first_name, last_name, nick_name, is_hof, birthdate, card_count, slug").eq("player_id", playerId).single()
      .then(({ data }) => {
        const r = data as PlayerRow; setRow(r);
        setFirst(r?.first_name ?? ""); setLast(r?.last_name ?? ""); setNick(r?.nick_name ?? ""); setHof(!!r?.is_hof); setBd(r?.birthdate ?? "");
      });
  }, [playerId]);

  if (!row) return <p className="text-sm text-muted">Loading…</p>;

  async function save() {
    setMsg(null);
    try { await updatePlayer(playerId, { first, last, nick, birthdate: bd || null, is_hof: hof }); setMsg("Saved."); onChanged?.(); }
    catch (e) { setMsg((e as Error).message); }
  }
  async function doMerge() {
    if (!mergeTarget) return;
    setMsg(null);
    try { await mergePlayer(playerId, mergeTarget.id); setMsg(`Merged “${mergeTarget.name}” into this player.`); setMergeTarget(null); onChanged?.(); }
    catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-ink">{first} {last} <span className="text-xs text-muted">· {row.card_count ?? 0} cards</span></h3>
        <a href={`/players/${row.slug}`} target="_blank" className="text-xs text-brand">View ↗</a>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="First"><input value={first} onChange={(e) => setFirst(e.target.value)} className={inp} /></Field>
        <Field label="Last"><input value={last} onChange={(e) => setLast(e.target.value)} className={inp} /></Field>
        <Field label="Nickname"><input value={nick} onChange={(e) => setNick(e.target.value)} className={inp} /></Field>
        <Field label="Birthdate"><input type="date" value={bd ? bd.slice(0, 10) : ""} onChange={(e) => setBd(e.target.value)} className={inp} /></Field>
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink"><input type="checkbox" checked={hof} onChange={(e) => setHof(e.target.checked)} className="accent-[var(--color-brand)]" /> Hall of Fame</label>
      <button onClick={save} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>

      <div className="mt-5 border-t border-white/5 pt-4">
        <div className="text-sm font-semibold text-ink">Merge a duplicate into this player</div>
        <p className="text-xs text-muted">Find the duplicate; its cards &amp; teams move here and it&apos;s deleted.</p>
        {!mergeTarget ? (
          <div className="mt-2"><EntitySearch kind="players" placeholder="Search the duplicate player…"
            onPick={(p) => setMergeTarget({ id: p.player_id as number, name: [p.first_name, p.last_name].filter(Boolean).join(" ") })} /></div>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-gold">Merge “{mergeTarget.name}” → this player?</span>
            <button onClick={doMerge} className="rounded-lg bg-red-500/90 px-3 py-1.5 text-sm font-semibold text-white">Merge</button>
            <button onClick={() => setMergeTarget(null)} className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted">Cancel</button>
          </div>
        )}
      </div>
      {msg ? <p className="mt-3 text-sm text-brand">{msg}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted">{label}</span>{children}</label>;
}
const inp = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
