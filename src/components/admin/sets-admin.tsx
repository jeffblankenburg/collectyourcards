"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntitySearch } from "@/components/admin/entity-search";
import { createSet } from "@/lib/admin/mutations";

export function SetsAdmin() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setBusy(true); setErr(null);
    try {
      await createSet({ name: name.trim(), year: year ? Number(year) : null, organization_id: null, manufacturer_id: null });
      // reload search by navigating; simplest: just reset
      setCreating(false); setName(""); setYear("");
      router.refresh();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Sets &amp; series</h1>
        <button onClick={() => setCreating((c) => !c)} className="text-sm text-brand">{creating ? "Cancel" : "+ New set"}</button>
      </div>

      {creating ? (
        <div className="mt-3 flex max-w-md flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Set name (e.g. 2026 Topps)" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" inputMode="numeric" className="h-10 w-24 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
          <button onClick={create} disabled={busy || !name} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Create</button>
          {err ? <p className="w-full text-xs text-gold">{err}</p> : null}
        </div>
      ) : null}

      <p className="mt-4 text-sm text-muted">Search a set to manage its series and cards.</p>
      <div className="mt-2 max-w-md">
        <EntitySearch kind="sets" placeholder="Search a set…" onPick={(s) => router.push(`/admin/sets/${s.slug}`)} />
      </div>
    </main>
  );
}
