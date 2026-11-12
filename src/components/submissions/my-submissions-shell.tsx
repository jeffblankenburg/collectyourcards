"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { mySubmissions, myContributorStats, submitSet, type ContributorStats, type MySubmission } from "@/lib/submissions/mutations";

const TYPE_LABEL: Record<string, string> = {
  set: "New set", card_edit: "Card edit", team_edit: "Team edit",
  player_edit: "Player edit", series: "New series", card: "New card",
};
const STATUS_TONE: Record<string, string> = {
  pending: "bg-white/10 text-muted", approved: "bg-brand/20 text-brand", rejected: "bg-gold/20 text-gold",
};

export function MySubmissionsShell({ collectorId }: { collectorId: number }) {
  const [subs, setSubs] = useState<MySubmission[] | null>(null);
  const [stats, setStats] = useState<ContributorStats | null>(null);
  const [proposing, setProposing] = useState(false);
  const [name, setName] = useState(""); const [year, setYear] = useState("");
  const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);

  async function load() {
    const [s, st] = await Promise.all([mySubmissions(), myContributorStats(collectorId)]);
    setSubs(s); setStats(st);
  }
  useEffect(() => { load().catch((e) => { setErr(e.message); setSubs([]); }); }, [collectorId]);

  async function propose() {
    if (!name.trim() || !year.trim()) return;
    setBusy(true); setErr(null);
    try { await submitSet({ name: name.trim(), year: Number(year) }); setName(""); setYear(""); setProposing(false); await load(); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">My submissions</h1>
      <p className="mt-1 text-sm text-muted">Edits and additions you’ve proposed to the catalog.</p>

      {stats ? (
        <div className="mt-4 grid grid-cols-4 divide-x divide-white/8 rounded-xl border border-white/8 bg-white/[0.03] py-3 text-center">
          <Stat label="Submitted" value={stats.total_submissions} />
          <Stat label="Pending" value={stats.pending_submissions} />
          <Stat label="Approved" value={stats.approved_submissions} />
          <Stat label="Trust" value={stats.trust_points} />
        </div>
      ) : null}

      {proposing ? (
        <div className="mt-4 flex flex-wrap items-end gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Set name (e.g. 2026 Topps Chrome)" className="h-10 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
          <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" inputMode="numeric" className="h-10 w-20 rounded-lg border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none" />
          <button onClick={propose} disabled={busy || !name.trim() || !year.trim()} className="h-10 rounded-lg bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50">Submit</button>
          <button onClick={() => setProposing(false)} className="h-10 rounded-lg border border-white/10 px-3 text-sm text-muted">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setProposing(true)} className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 py-3 text-sm font-semibold text-brand hover:bg-white/[0.03]">
          <Plus className="size-4" /> Propose a new set
        </button>
      )}

      {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}

      {subs === null ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : subs.length === 0 ? (
        <p className="mt-6 text-sm text-muted">No submissions yet. Suggest an edit from any card, player, or team page.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {subs.map((s) => (
            <li key={`${s.type}:${s.submission_id}`} className="flex items-center gap-3 border border-white/5 bg-white/[0.03] px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-muted">{TYPE_LABEL[s.type] ?? s.type}</span>
                  <span className="truncate text-sm text-ink">{s.summary}</span>
                </div>
                {s.review_notes ? <div className="mt-0.5 truncate text-xs text-muted">“{s.review_notes}”</div> : null}
              </div>
              <span className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_TONE[s.status] ?? "bg-white/10 text-muted"}`}>{s.status}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-1">
      <div className="font-mono text-lg font-bold tabular-nums text-ink">{value ?? 0}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
    </div>
  );
}
