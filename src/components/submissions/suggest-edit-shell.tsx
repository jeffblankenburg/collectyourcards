"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { PencilLine, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Shared chrome for "suggest an edit" islands: auth gate, trigger button, modal,
// busy/error/done states. The caller owns the field inputs (children) and the
// onSubmit that reads them. Used by the team/player suggest-edit buttons.
export function SuggestEditShell({ title, onSubmit, children }: {
  title: string; onSubmit: () => Promise<unknown>; children: ReactNode;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);

  async function submit() {
    setBusy(true); setErr(null);
    try { await onSubmit(); setDone(true); setOpen(false); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  if (authed === null) return null;
  if (!authed) {
    return (
      <Link href="/auth/login" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-ink">
        <PencilLine className="size-4" /> Suggest an edit
      </Link>
    );
  }
  if (done) return <span className="inline-flex items-center gap-1.5 rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-sm text-brand">Submitted for review ✓</span>;

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-ink hover:bg-white/5">
        <PencilLine className="size-4" /> Suggest an edit
      </button>
      {open ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-base sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-white/5 p-4">
              <h3 className="font-semibold text-ink">{title}</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {children}
              {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}
            </div>
            <div className="flex items-center justify-end border-t border-white/5 p-4">
              <button onClick={submit} disabled={busy} className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Submitting…" : "Submit for review"}</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export const suggestInp = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
export function SuggestField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className ?? ""}`}><span className="text-xs text-muted">{label}</span>{children}</label>;
}
