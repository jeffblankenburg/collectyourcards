"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSeries } from "@/lib/admin/mutations";

export function NewSeriesForm({ setId }: { setId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [isBase, setIsBase] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true); setErr(null);
    try { await createSeries({ name: name.trim(), set_id: setId, is_base: isBase }); setOpen(false); setName(""); router.refresh(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (!open) return <button onClick={() => setOpen(true)} className="text-sm text-brand">+ New series</button>;
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Series name (e.g. Base, Chrome Refractor)" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
      <label className="flex items-center gap-1.5 text-xs text-muted"><input type="checkbox" checked={isBase} onChange={(e) => setIsBase(e.target.checked)} className="accent-[var(--color-brand)]" /> Base</label>
      <button onClick={go} disabled={busy || !name} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Create</button>
      <button onClick={() => setOpen(false)} className="h-10 rounded-lg border border-white/10 px-3 text-sm text-muted">Cancel</button>
      {err ? <p className="w-full text-xs text-gold">{err}</p> : null}
    </div>
  );
}
