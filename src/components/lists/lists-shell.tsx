"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ListChecks, Lock, Globe, Plus } from "lucide-react";
import { createList, myLists, type ListSummary } from "@/lib/lists/mutations";

export function ListsShell({ collectorId }: { collectorId: number }) {
  const [lists, setLists] = useState<ListSummary[] | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { myLists(collectorId).then(setLists).catch((e) => { setErr(e.message); setLists([]); }); }, [collectorId]);

  async function create() {
    if (!name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await createList(collectorId, name.trim());
      setName(""); setCreating(false);
      setLists(await myLists(collectorId));
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Lists &amp; wantlists</h1>
        <div className="flex items-center gap-3">
          <Link href="/submissions" className="text-sm text-brand">Submissions</Link>
          <Link href="/completion" className="flex items-center gap-1.5 text-sm text-brand"><ListChecks className="size-4" /> Completion</Link>
        </div>
      </div>
      <p className="mt-1 text-sm text-muted">Group cards to chase, trade, or show off. Make a list public to share it.</p>

      {creating ? (
        <div className="mt-4 flex gap-2">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="List name (e.g. 2026 Topps Chrome wantlist)" className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
          <button onClick={create} disabled={busy || !name.trim()} className="rounded-xl bg-brand px-4 text-sm font-semibold text-white disabled:opacity-60">Create</button>
          <button onClick={() => { setCreating(false); setName(""); }} className="rounded-xl border border-white/10 px-3 text-sm text-muted">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setCreating(true)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-brand hover:bg-white/[0.03]">
          <Plus className="size-4" /> New list
        </button>
      )}

      {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}

      {lists === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : lists.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No lists yet. Create one to start a wantlist or a set to chase.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {lists.map((l) => (
            <li key={l.user_list_id}>
              <Link href={`/lists/${l.user_list_id}`} className="flex items-center justify-between gap-3 border border-white/5 bg-white/[0.03] px-4 py-3 transition hover:border-white/15 hover:bg-white/[0.06]">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">{l.name || "Untitled list"}</div>
                  {l.summary ? <div className="truncate text-xs text-muted">{l.summary}</div> : null}
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {l.is_public ? <Globe className="size-3.5 text-brand" /> : <Lock className="size-3.5" />}
                  <span className="font-mono">{l.card_count ?? 0}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
