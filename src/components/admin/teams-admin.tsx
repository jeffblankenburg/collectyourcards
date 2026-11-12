"use client";

import { useState } from "react";
import { EntitySearch } from "@/components/admin/entity-search";
import { TeamEditor } from "@/components/admin/team-editor";
import { createTeam } from "@/lib/admin/mutations";

export function TeamsAdmin() {
  const [picked, setPicked] = useState<number | null>(null);
  const [key, setKey] = useState(0);
  const [creating, setCreating] = useState(false);

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Teams</h1>
        <button onClick={() => setCreating((c) => !c)} className="text-sm text-brand">{creating ? "Cancel" : "+ New team"}</button>
      </div>

      {creating ? <CreateTeam onCreated={(id) => { setCreating(false); setPicked(id); setKey((k) => k + 1); }} /> : null}

      <div className="mt-4 max-w-md">
        <EntitySearch kind="teams" placeholder="Search a team to edit…" onPick={(t) => { setPicked(t.team_id as number); setKey((k) => k + 1); }} />
      </div>

      {picked ? <div className="mt-5 max-w-xl"><TeamEditor key={key} teamId={picked} /></div> : null}
    </main>
  );
}

function CreateTeam({ onCreated }: { onCreated: (id: number) => void }) {
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function go() {
    setBusy(true); setErr(null);
    try { onCreated(await createTeam({ name, abbreviation: abbr })); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-3 flex max-w-md flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Team name" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
      <input value={abbr} onChange={(e) => setAbbr(e.target.value)} placeholder="ABBR" className="h-10 w-24 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
      <button onClick={go} disabled={busy || !name} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Create</button>
      {err ? <p className="w-full text-xs text-gold">{err}</p> : null}
    </div>
  );
}
