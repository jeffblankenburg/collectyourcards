"use client";

import { useState } from "react";
import { EntitySearch } from "@/components/admin/entity-search";
import { PlayerEditor } from "@/components/admin/player-editor";
import { createPlayer } from "@/lib/admin/mutations";

export function PlayersAdmin() {
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [key, setKey] = useState(0); // force editor reload after merge
  const [creating, setCreating] = useState(false);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Players</h1>
        <button onClick={() => setCreating((c) => !c)} className="text-sm text-brand">{creating ? "Cancel" : "+ New player"}</button>
      </div>

      {creating ? <CreatePlayer onCreated={(id, name) => { setCreating(false); setPicked({ id, name }); setKey((k) => k + 1); }} /> : null}

      <div className="mt-4 max-w-md">
        <EntitySearch kind="players" placeholder="Search a player to edit…" onPick={(p) => { setPicked({ id: p.player_id as number, name: "" }); setKey((k) => k + 1); }} />
      </div>

      {picked ? <div className="mt-5 max-w-xl"><PlayerEditor key={key} playerId={picked.id} onChanged={() => setKey((k) => k + 1)} /></div> : null}
    </main>
  );
}

function CreatePlayer({ onCreated }: { onCreated: (id: number, name: string) => void }) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try { const id = await createPlayer({ first, last }); onCreated(id, `${first} ${last}`); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3 flex max-w-md flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <input value={first} onChange={(e) => setFirst(e.target.value)} placeholder="First" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
      <input value={last} onChange={(e) => setLast(e.target.value)} placeholder="Last" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
      <button onClick={go} disabled={busy || (!first && !last)} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Create</button>
      {err ? <p className="w-full text-xs text-gold">{err}</p> : null}
    </div>
  );
}
