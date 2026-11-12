"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateTeam } from "@/lib/admin/mutations";

interface TeamRow { team_id: number; name: string | null; city: string | null; mascot: string | null; abbreviation: string | null; organization_id: number | null; primary_color: string | null; secondary_color: string | null; slug: string; card_count: number | null }

export function TeamEditor({ teamId, onChanged }: { teamId: number; onChanged?: () => void }) {
  const [row, setRow] = useState<TeamRow | null>(null);
  const [f, setF] = useState<Partial<TeamRow>>({});
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    createClient().from("team").select("team_id, name, city, mascot, abbreviation, organization_id, primary_color, secondary_color, slug, card_count").eq("team_id", teamId).single()
      .then(({ data }) => { setRow(data as TeamRow); setF((data as TeamRow) ?? {}); });
  }, [teamId]);

  if (!row) return <p className="text-sm text-muted">Loading…</p>;
  const set = (k: keyof TeamRow, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function save() {
    setMsg(null);
    try {
      await updateTeam(teamId, {
        name: f.name ?? "", abbreviation: f.abbreviation ?? undefined, organization_id: f.organization_id ?? null,
        city: f.city ?? undefined, mascot: f.mascot ?? undefined, primary_color: f.primary_color ?? undefined, secondary_color: f.secondary_color ?? undefined,
      });
      setMsg("Saved."); onChanged?.();
    } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-3">
        <span className="inline-flex size-9 items-center justify-center rounded-full text-[10px] font-bold text-white ring-1 ring-inset ring-white/20" style={{ backgroundColor: f.primary_color || "#334155" }}>{f.abbreviation}</span>
        <h3 className="font-semibold text-ink">{f.city} {f.name} <span className="text-xs text-muted">· {row.card_count ?? 0} cards</span></h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City"><input value={f.city ?? ""} onChange={(e) => set("city", e.target.value)} className={inp} /></Field>
        <Field label="Name"><input value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} className={inp} /></Field>
        <Field label="Mascot"><input value={f.mascot ?? ""} onChange={(e) => set("mascot", e.target.value)} className={inp} /></Field>
        <Field label="Abbreviation"><input value={f.abbreviation ?? ""} onChange={(e) => set("abbreviation", e.target.value)} className={inp} /></Field>
        <Field label="Primary color"><input value={f.primary_color ?? ""} onChange={(e) => set("primary_color", e.target.value)} placeholder="#RRGGBB" className={inp} /></Field>
        <Field label="Secondary color"><input value={f.secondary_color ?? ""} onChange={(e) => set("secondary_color", e.target.value)} placeholder="#RRGGBB" className={inp} /></Field>
      </div>
      <button onClick={save} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Save</button>
      {msg ? <p className="mt-3 text-sm text-brand">{msg}</p> : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex flex-col gap-1"><span className="text-xs text-muted">{label}</span>{children}</label>;
}
const inp = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
