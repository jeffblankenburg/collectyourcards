"use client";

import { useMemo, useState } from "react";
import { parseText, parseXlsx, type ParsedRow } from "@/lib/admin/parse";
import {
  createSeries, createSet, importCards, matchPlayers, matchTeams,
  type ImportResult, type MatchGroup,
} from "@/lib/admin/mutations";

interface SeriesTarget { series_id: number; name: string; set_name?: string; org?: number | null }
type Choice = number | "new" | null;

function autoChoose(g: MatchGroup | undefined): Choice {
  if (!g || g.candidates.length === 0) return null;
  const top = g.candidates[0];
  const gap = top.score - (g.candidates[1]?.score ?? 0);
  if (top.exact && (g.candidates.length === 1 || gap > 0.15)) return (top.player_id ?? top.team_id)!;
  return null;
}

export function ImportWizard() {
  const [step, setStep] = useState(1);
  const [target, setTarget] = useState<SeriesTarget | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  return (
    <main>
      <h1 className="font-display text-2xl text-ink">Import checklist</h1>
      <Steps step={step} />
      {err ? <p className="mt-3 rounded-lg bg-gold/10 px-3 py-2 text-sm text-gold">{err}</p> : null}

      {step === 1 && <TargetStep onPick={(t) => { setTarget(t); setStep(2); }} setErr={setErr} />}

      {step === 2 && target && (
        <InputStep target={target} busy={busy} setBusy={setBusy} setErr={setErr}
          onParsed={(r) => { setRows(r); setStep(3); }} onBack={() => setStep(1)} />
      )}

      {step === 3 && target && (
        <ReviewStep target={target} rows={rows} setErr={setErr}
          onBack={() => setStep(2)}
          onCommit={async (built) => {
            setBusy(true); setErr(null);
            try {
              const res = await importCards(target.series_id, built, "skip");
              setResult(res); setStep(4);
            } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
          }} busy={busy} />
      )}

      {step === 4 && result && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-lg font-semibold text-ink">Import complete</h2>
          <div className="mt-3 flex gap-6 text-sm">
            <span className="text-brand">{result.created} created</span>
            <span className="text-muted">{result.skipped} skipped (duplicates)</span>
            <span className={result.errors ? "text-gold" : "text-muted"}>{result.errors} errors</span>
          </div>
          {result.errors > 0 ? (
            <ul className="mt-3 max-h-40 overflow-y-auto text-xs text-gold">
              {result.rows.filter((r) => r.status === "error").slice(0, 20).map((r) => <li key={r.row}>Row {r.row}: {r.message}</li>)}
            </ul>
          ) : null}
          <button onClick={() => { setStep(1); setTarget(null); setRows([]); setResult(null); }} className="mt-4 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white">Import another</button>
        </div>
      )}
    </main>
  );
}

function Steps({ step }: { step: number }) {
  const labels = ["Series", "Checklist", "Review", "Done"];
  return (
    <div className="mt-4 flex gap-2 text-xs">
      {labels.map((l, i) => (
        <span key={l} className={`rounded-full px-3 py-1 ${step === i + 1 ? "bg-brand text-white" : step > i + 1 ? "bg-white/10 text-ink" : "bg-white/5 text-muted"}`}>{i + 1}. {l}</span>
      ))}
    </div>
  );
}

// ── Step 1: target series ────────────────────────────────────────────────────
function TargetStep({ onPick, setErr }: { onPick: (t: SeriesTarget) => void; setErr: (s: string | null) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ series_id: number; name: string; set: { name: string | null } }[]>([]);
  const [creating, setCreating] = useState(false);

  async function search(v: string) {
    setQ(v);
    if (v.trim().length < 2) { setHits([]); return; }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(v)}`);
      const d = await res.json();
      setHits((d.series ?? []).slice(0, 8));
    } catch { /* ignore */ }
  }

  return (
    <div className="mt-6">
      <label className="text-sm text-muted">Target series</label>
      <input value={q} onChange={(e) => search(e.target.value)} placeholder="Search a series…"
        className="mt-1 h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
      {hits.length > 0 ? (
        <div className="mt-2 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/5">
          {hits.map((s) => (
            <button key={s.series_id} onClick={() => onPick({ series_id: s.series_id, name: s.name, set_name: s.set?.name ?? undefined })}
              className="flex w-full items-center justify-between bg-white/[0.03] px-4 py-2.5 text-left text-sm hover:bg-white/[0.07]">
              <span className="text-ink">{s.name}</span><span className="text-xs text-muted">{s.set?.name}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button onClick={() => setCreating((c) => !c)} className="mt-4 text-sm text-brand">{creating ? "Cancel" : "+ Create a new set / series"}</button>
      {creating ? <InlineCreate onCreated={onPick} setErr={setErr} /> : null}
    </div>
  );
}

function InlineCreate({ onCreated, setErr }: { onCreated: (t: SeriesTarget) => void; setErr: (s: string | null) => void }) {
  const [setName, setSetName] = useState("");
  const [year, setYear] = useState("");
  const [seriesName, setSeriesName] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true); setErr(null);
    try {
      const setId = await createSet({ name: setName.trim(), year: year ? Number(year) : null, organization_id: null, manufacturer_id: null });
      const seriesId = await createSeries({ name: seriesName.trim() || setName.trim(), set_id: setId, is_base: true });
      onCreated({ series_id: seriesId, name: seriesName || setName, set_name: setName });
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-3">
      <input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Set name (e.g. 2025 Topps)" className={inp} />
      <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" inputMode="numeric" className={inp} />
      <input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="Series name (e.g. Base)" className={inp} />
      <button onClick={go} disabled={busy || !setName.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-3">
        {busy ? "Creating…" : "Create set + series → continue"}
      </button>
    </div>
  );
}

// ── Step 2: paste / upload ───────────────────────────────────────────────────
function InputStep({ target, busy, setBusy, setErr, onParsed, onBack }: {
  target: SeriesTarget; busy: boolean; setBusy: (b: boolean) => void; setErr: (s: string | null) => void;
  onParsed: (r: ParsedRow[]) => void; onBack: () => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="mt-6">
      <p className="text-sm text-muted">Into <span className="text-ink">{target.name}</span>{target.set_name ? ` · ${target.set_name}` : ""}</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
        placeholder={"Paste: Card#  Player(s)  Team(s)  RC  Notes\nor a line per card:  1  Aaron Judge - NYY  RC (SSP)"}
        className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-xs text-ink outline-none focus:border-brand" />
      <div className="mt-3 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted">Back</button>
        <label className="cursor-pointer rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-ink">
          Upload .xlsx
          <input type="file" accept=".xlsx,.csv" hidden onChange={async (e) => {
            const file = e.target.files?.[0]; if (!file) return;
            setBusy(true); setErr(null);
            try {
              const rows = file.name.endsWith(".xlsx") ? await parseXlsx(await file.arrayBuffer()) : parseText(await file.text());
              onParsed(rows);
            } catch (er) { setErr((er as Error).message); } finally { setBusy(false); }
          }} />
        </label>
        <button onClick={() => { try { onParsed(parseText(text)); } catch (e) { setErr((e as Error).message); } }}
          disabled={busy || !text.trim()} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Parse →</button>
      </div>
    </div>
  );
}

// ── Step 3: match + review ───────────────────────────────────────────────────
function ReviewStep({ target, rows, onBack, onCommit, busy, setErr }: {
  target: SeriesTarget; rows: ParsedRow[]; onBack: () => void; busy: boolean;
  onCommit: (built: unknown[]) => void; setErr: (s: string | null) => void;
}) {
  const uniquePlayers = useMemo(() => [...new Set(rows.flatMap((r) => r.players))].filter(Boolean), [rows]);
  const uniqueTeams = useMemo(() => [...new Set(rows.flatMap((r) => r.teams))].filter(Boolean), [rows]);
  const [pMatch, setPMatch] = useState<MatchGroup[] | null>(null);
  const [tMatch, setTMatch] = useState<MatchGroup[] | null>(null);
  const [pChoice, setPChoice] = useState<Record<string, Choice>>({});
  const [tChoice, setTChoice] = useState<Record<string, Choice>>({});
  const [loading, setLoading] = useState(false);

  async function match() {
    setLoading(true); setErr(null);
    try {
      const [p, t] = await Promise.all([matchPlayers(uniquePlayers), matchTeams(uniqueTeams, target.org ?? null)]);
      setPMatch(p); setTMatch(t);
      const pc: Record<string, Choice> = {}; for (const g of p) pc[g.raw] = autoChoose(g);
      const tc: Record<string, Choice> = {}; for (const g of t) tc[g.raw] = autoChoose(g);
      setPChoice(pc); setTChoice(tc);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  const unresolvedP = pMatch ? pMatch.filter((g) => pChoice[g.raw] == null) : [];
  const unresolvedT = tMatch ? tMatch.filter((g) => tChoice[g.raw] == null) : [];
  const ready = pMatch != null && unresolvedP.length === 0 && unresolvedT.length === 0;

  function build() {
    const byRawP = Object.fromEntries((pMatch ?? []).map((g) => [g.raw, g]));
    const byRawT = Object.fromEntries((tMatch ?? []).map((g) => [g.raw, g]));
    return rows.map((r) => {
      const players: unknown[] = [];
      r.players.forEach((pname, i) => {
        const tname = r.teams[i] ?? r.teams[0];
        const pc = pChoice[pname]; const tc = tname ? tChoice[tname] : null;
        if (pc == null) return;
        const player = pc === "new"
          ? { new_player: splitName(byRawP[pname]?.raw ?? pname) }
          : { player_id: pc };
        let team: Record<string, unknown> | null = null;
        if (tc === "new") team = { new_team: { name: byRawT[tname!]?.raw ?? tname, abbreviation: (tname ?? "").slice(0, 5), organization_id: null } };
        else if (typeof tc === "number") team = { team_id: tc };
        if (team) players.push({ ...player, ...team });
      });
      return { row: r.row, card_number: r.card_number, is_rookie: r.is_rookie, is_autograph: r.is_autograph, is_relic: r.is_relic, is_short_print: r.is_short_print, notes: r.notes, players };
    });
  }

  return (
    <div className="mt-6">
      <p className="text-sm text-muted">{rows.length} cards · {uniquePlayers.length} players · {uniqueTeams.length} teams</p>
      {!pMatch ? (
        <button onClick={match} disabled={loading} className="mt-3 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? "Matching…" : "Match players & teams →"}
        </button>
      ) : (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ResolveList title={`Players to resolve (${unresolvedP.length})`} groups={unresolvedP} choice={pChoice} setChoice={setPChoice} kind="player" />
            <ResolveList title={`Teams to resolve (${unresolvedT.length})`} groups={unresolvedT} choice={tChoice} setChoice={setTChoice} kind="team" />
          </div>
          <p className="mt-3 text-xs text-muted">
            {(pMatch.length - unresolvedP.length)} players and {(tMatch?.length ?? 0) - unresolvedT.length} teams auto-matched.
          </p>
        </>
      )}
      <div className="mt-5 flex items-center gap-3">
        <button onClick={onBack} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted">Back</button>
        <button onClick={() => onCommit(build())} disabled={!ready || busy}
          className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Importing…" : `Import ${rows.length} cards`}
        </button>
      </div>
    </div>
  );
}

function ResolveList({ title, groups, choice, setChoice, kind }: {
  title: string; groups: MatchGroup[]; choice: Record<string, Choice>;
  setChoice: (u: (c: Record<string, Choice>) => Record<string, Choice>) => void; kind: "player" | "team";
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      {groups.length === 0 ? <p className="text-xs text-brand">All resolved ✓</p> : (
        <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {groups.map((g) => (
            <div key={g.raw} className="rounded-lg bg-white/[0.03] p-2">
              <div className="truncate text-sm text-ink">{g.raw}</div>
              <select value={choice[g.raw] ?? ""} onChange={(e) => setChoice((c) => ({ ...c, [g.raw]: e.target.value === "new" ? "new" : e.target.value ? Number(e.target.value) : null }))}
                className="mt-1 h-9 w-full rounded-lg border border-white/10 bg-white/5 px-2 text-xs text-ink outline-none focus:border-brand">
                <option value="">— pick —</option>
                {g.candidates.map((c) => {
                  const id = c.player_id ?? c.team_id;
                  const label = kind === "player"
                    ? `${c.first_name ?? ""} ${c.last_name ?? ""} ${c.teams?.length ? `(${c.teams.map((t) => t.abbreviation).join(",")})` : ""} · ${Math.round(c.score * 100)}%`
                    : `${c.city ?? ""} ${c.name ?? ""} ${c.abbreviation ? `(${c.abbreviation})` : ""} · ${Math.round(c.score * 100)}%`;
                  return <option key={id} value={id}>{label.trim()}</option>;
                })}
                <option value="new">+ Create “{g.raw}” as new</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function splitName(raw: string): { first: string; last: string } {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 1) return { first: "", last: parts[0] };
  return { first: parts.slice(0, -1).join(" "), last: parts.at(-1)! };
}

const inp = "h-10 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
