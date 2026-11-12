"use client";

import { useState } from "react";
import { SuggestEditShell, SuggestField, suggestInp } from "./suggest-edit-shell";
import { submitTeamEdit } from "@/lib/submissions/mutations";

export function SuggestTeamEdit({ current }: {
  current: { team_id: number; name: string | null; city: string | null; abbreviation: string | null; primary_color: string | null; secondary_color: string | null };
}) {
  const [name, setName] = useState(current.name ?? "");
  const [city, setCity] = useState(current.city ?? "");
  const [abbr, setAbbr] = useState(current.abbreviation ?? "");
  const [primary, setPrimary] = useState(current.primary_color ?? "");
  const [secondary, setSecondary] = useState(current.secondary_color ?? "");
  const [why, setWhy] = useState("");

  return (
    <SuggestEditShell title="Suggest a team edit" onSubmit={() => submitTeamEdit({
      team_id: current.team_id, name: name.trim() || null, city: city.trim() || null, abbreviation: abbr.trim() || null,
      primary_color: primary.trim() || null, secondary_color: secondary.trim() || null, submission_notes: why.trim() || null,
    })}>
      <div className="grid grid-cols-2 gap-3">
        <SuggestField label="Name"><input value={name} onChange={(e) => setName(e.target.value)} className={suggestInp} /></SuggestField>
        <SuggestField label="City"><input value={city} onChange={(e) => setCity(e.target.value)} className={suggestInp} /></SuggestField>
        <SuggestField label="Abbreviation"><input value={abbr} onChange={(e) => setAbbr(e.target.value)} className={suggestInp} /></SuggestField>
        <SuggestField label="Primary color"><input value={primary} onChange={(e) => setPrimary(e.target.value)} placeholder="#RRGGBB" className={suggestInp} /></SuggestField>
        <SuggestField label="Secondary color"><input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="#RRGGBB" className={suggestInp} /></SuggestField>
      </div>
      <SuggestField label="Why this change? (optional)" className="mt-3"><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Source / reason" className={suggestInp} /></SuggestField>
    </SuggestEditShell>
  );
}
