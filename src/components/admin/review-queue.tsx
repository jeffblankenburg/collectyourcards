"use client";

import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { APPROVABLE_TYPES, pendingSubmissions, reviewSubmission, type PendingSubmission } from "@/lib/admin/mutations";

const TYPE_LABEL: Record<string, string> = {
  set: "New set", card_edit: "Card edit", team_edit: "Team edit",
  player_edit: "Player edit", series: "New series", card: "New card",
};

export function ReviewQueue() {
  const [rows, setRows] = useState<PendingSubmission[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { pendingSubmissions().then(setRows).catch((e) => { setErr(e.message); setRows([]); }); }, []);

  async function act(row: PendingSubmission, approve: boolean) {
    const key = `${row.type}:${row.submission_id}`;
    setBusy(key); setErr(null);
    try {
      await reviewSubmission(row.type, row.submission_id, approve);
      setRows((rs) => rs?.filter((r) => !(r.type === row.type && r.submission_id === row.submission_id)) ?? rs);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">Review queue</h1>
      <p className="mt-1 text-sm text-muted">Community-submitted additions and corrections. Approving applies the change.</p>
      {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}

      {rows === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nothing pending. 🎉</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {rows.map((r) => {
            const key = `${r.type}:${r.submission_id}`;
            const canApprove = APPROVABLE_TYPES.has(r.type);
            return (
              <li key={key} className="flex items-center gap-3 border border-white/5 bg-white/[0.03] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{TYPE_LABEL[r.type] ?? r.type}</span>
                    <span className="truncate text-sm text-ink">{r.summary}</span>
                  </div>
                  {r.notes ? <div className="mt-0.5 truncate text-xs text-muted">“{r.notes}”</div> : null}
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button onClick={() => act(r, true)} disabled={busy === key || !canApprove}
                    title={canApprove ? "Approve & apply" : "Approve not yet supported for this type"}
                    className="flex size-8 items-center justify-center rounded-lg bg-brand/90 text-white disabled:opacity-40"><Check className="size-4" /></button>
                  <button onClick={() => act(r, false)} disabled={busy === key}
                    title="Reject" className="flex size-8 items-center justify-center rounded-lg border border-white/10 text-muted hover:text-gold disabled:opacity-40"><X className="size-4" /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
