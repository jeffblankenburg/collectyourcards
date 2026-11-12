"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PencilLine, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { submitCardEdit, type CardEditInput } from "@/lib/submissions/mutations";

type Current = Omit<CardEditInput, "submission_notes">;

const numOrNull = (s: string) => { const t = s.trim(); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

// Card-page island: lets any signed-in user propose a correction to the catalog
// card. Submits to the crowdsourcing queue (admins review at /admin/review).
export function SuggestEditButton({ current }: { current: Current }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [num, setNum] = useState(current.card_number ?? "");
  const [rc, setRc] = useState(current.is_rookie);
  const [auto, setAuto] = useState(current.is_autograph);
  const [relic, setRelic] = useState(current.is_relic);
  const [sp, setSp] = useState(current.is_short_print);
  const [printRun, setPrintRun] = useState(current.print_run != null ? String(current.print_run) : "");
  const [notes, setNotes] = useState(current.notes ?? "");
  const [why, setWhy] = useState("");

  useEffect(() => { createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);

  async function submit() {
    setBusy(true); setErr(null);
    try {
      await submitCardEdit({
        card_id: current.card_id, card_number: num.trim() || null, is_rookie: rc, is_autograph: auto,
        is_relic: relic, is_short_print: sp, print_run: numOrNull(printRun), notes: notes.trim() || null,
        submission_notes: why.trim() || null,
      });
      setDone(true); setOpen(false);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
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
              <h3 className="font-semibold text-ink">Suggest an edit</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-ink"><X className="size-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Card #"><input value={num} onChange={(e) => setNum(e.target.value)} className={inp} /></Field>
                <Field label="Print run"><input value={printRun} inputMode="numeric" onChange={(e) => setPrintRun(e.target.value)} className={inp} /></Field>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink">
                <Chk v={rc} set={setRc} label="Rookie" />
                <Chk v={auto} set={setAuto} label="Auto" />
                <Chk v={relic} set={setRelic} label="Relic" />
                <Chk v={sp} set={setSp} label="SP" />
              </div>
              <Field label="Notes" className="mt-3"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} /></Field>
              <Field label="Why this change? (optional)" className="mt-3"><input value={why} onChange={(e) => setWhy(e.target.value)} placeholder="Source / reason" className={inp} /></Field>
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

const inp = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className ?? ""}`}><span className="text-xs text-muted">{label}</span>{children}</label>;
}
function Chk({ v, set, label }: { v: boolean; set: (b: boolean) => void; label: string }) {
  return <label className="flex items-center gap-1.5"><input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="accent-[var(--color-brand)]" /> {label}</label>;
}
