"use client";

import { useState } from "react";
import { SuggestEditShell, SuggestField, suggestInp } from "./suggest-edit-shell";
import { submitPlayerEdit } from "@/lib/submissions/mutations";

export function SuggestPlayerEdit({ current }: {
  current: { player_id: number; first_name: string | null; last_name: string | null; nick_name: string | null; is_hof: boolean };
}) {
  const [first, setFirst] = useState(current.first_name ?? "");
  const [last, setLast] = useState(current.last_name ?? "");
  const [nick, setNick] = useState(current.nick_name ?? "");
  const [hof, setHof] = useState(current.is_hof);
  const [why, setWhy] = useState("");

  return (
    <SuggestEditShell title="Suggest a player edit" onSubmit={() => submitPlayerEdit({
      player_id: current.player_id, first_name: first.trim() || null, last_name: last.trim() || null,
      nick_name: nick.trim() || null, is_hof: hof, submission_notes: why.trim() || null,
    })}>
      <div className="grid grid-cols-2 gap-3">
        <SuggestField label="First name"><input value={first} onChange={(e) => setFirst(e.target.value)} className={suggestInp} /></SuggestField>
        <SuggestField label="Last name"><input value={last} onChange={(e) => setLast(e.target.value)} className={suggestInp} /></SuggestField>
      </div>
      <SuggestField label="Nickname" className="mt-3"><input value={nick} onChange={(e) => setNick(e.target.value)} className={suggestInp} /></SuggestField>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={hof} onChange={(e) => setHof(e.target.checked)} className="accent-[var(--color-brand)]" /> Hall of Fame
      </label>
      <SuggestField label="Why this change? (optional)" className="mt-3"><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Source / reason" className={suggestInp} /></SuggestField>
    </SuggestEditShell>
  );
}
