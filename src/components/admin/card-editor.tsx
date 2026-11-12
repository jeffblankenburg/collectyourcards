"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { deleteCard, removeCatalogImageObject, setCardImages, uploadCatalogImage, upsertCard } from "@/lib/admin/mutations";
import type { Card } from "@/lib/catalog/types";

interface PlayerLink { player_id: number; team_id: number; label: string }
interface PickedPlayer { player_id: number; name: string; teams: { team_id: number; abbreviation: string | null }[] }

const numOrNull = (s: string) => { const t = s.trim(); if (!t) return null; const n = Number(t); return Number.isFinite(n) ? n : null; };

export function CardEditor({ card, seriesId, onClose, onSaved }: {
  card: Card | null; seriesId: number; onClose: () => void; onSaved: () => void;
}) {
  const [num, setNum] = useState(card?.card_number ?? "");
  const [rookie, setRookie] = useState(!!card?.is_rookie);
  const [auto, setAuto] = useState(!!card?.is_autograph);
  const [relic, setRelic] = useState(!!card?.is_relic);
  const [sp, setSp] = useState(!!card?.is_short_print);
  const [printRun, setPrintRun] = useState(card?.print_run != null ? String(card.print_run) : "");
  const [notes, setNotes] = useState(card?.notes ?? "");
  const [players, setPlayers] = useState<PlayerLink[]>(
    (card?.players ?? []).filter((p) => p.team).map((p) => ({ player_id: p.player_id, team_id: p.team!.team_id, label: `${[p.first_name, p.last_name].filter(Boolean).join(" ")} (${p.team!.abbreviation ?? ""})` })),
  );
  const [pendingPlayer, setPendingPlayer] = useState<PickedPlayer | null>(null);
  const [frontUrl, setFrontUrl] = useState<string | null>(card?.front_image_path ?? null);
  const [backUrl, setBackUrl] = useState<string | null>(card?.back_image_path ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addLink(player: PickedPlayer, teamId: number, teamAbbr: string | null) {
    setPlayers((ps) => [...ps, { player_id: player.player_id, team_id: teamId, label: `${player.name} (${teamAbbr ?? ""})` }]);
    setPendingPlayer(null);
  }

  async function save() {
    setBusy(true); setErr(null);
    try {
      await upsertCard({
        card_id: card?.card_id ?? null, series_id: seriesId, card_number: num.trim() || null,
        is_rookie: rookie, is_autograph: auto, is_relic: relic, is_short_print: sp,
        print_run: numOrNull(printRun), notes: notes.trim() || null,
        players: players.map((p) => ({ player_id: p.player_id, team_id: p.team_id })),
      });
      onSaved();
    } catch (e) { setErr((e as Error).message); setBusy(false); }
  }
  async function remove() {
    if (!card) return;
    setBusy(true); setErr(null);
    try { await deleteCard(card.card_id); onSaved(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-base sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-white/5 p-4">
          <h3 className="font-semibold text-ink">{card ? `Edit card #${card.card_number}` : "New card"}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink"><X className="size-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Card #"><input value={num} onChange={(e) => setNum(e.target.value)} className={inp} /></Field>
            <Field label="Print run"><input value={printRun} inputMode="numeric" onChange={(e) => setPrintRun(e.target.value)} className={inp} /></Field>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink">
            <Chk v={rookie} set={setRookie} label="Rookie" />
            <Chk v={auto} set={setAuto} label="Auto" />
            <Chk v={relic} set={setRelic} label="Relic" />
            <Chk v={sp} set={setSp} label="SP" />
          </div>
          <Field label="Notes" className="mt-3"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inp} /></Field>

          <div className="mt-4 border-t border-white/5 pt-3">
            <div className="text-sm font-semibold text-ink">Players / teams</div>
            <div className="mt-2 flex flex-col gap-1">
              {players.map((p, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-1.5 text-sm text-ink">
                  <span>{p.label}</span>
                  <button onClick={() => setPlayers((ps) => ps.filter((_, j) => j !== i))} className="text-muted hover:text-gold"><X className="size-4" /></button>
                </div>
              ))}
            </div>
            {!pendingPlayer ? (
              <div className="mt-2">
                <EntitySearch kind="players" placeholder="Add a player…"
                  onPick={(p) => {
                    const teams = (p.teams as { team_id: number; abbreviation: string | null }[]) ?? [];
                    const picked: PickedPlayer = { player_id: p.player_id as number, name: [p.first_name, p.last_name].filter(Boolean).join(" "), teams };
                    if (teams.length === 1) addLink(picked, teams[0].team_id, teams[0].abbreviation);
                    else setPendingPlayer(picked);
                  }} />
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-white/10 bg-white/[0.03] p-2">
                <div className="text-xs text-muted">Pick a team for {pendingPlayer.name}:</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {pendingPlayer.teams.map((t) => (
                    <button key={t.team_id} onClick={() => addLink(pendingPlayer, t.team_id, t.abbreviation)} className="rounded-full border border-white/10 px-3 py-1 text-xs text-ink hover:bg-white/10">{t.abbreviation}</button>
                  ))}
                  <button onClick={() => setPendingPlayer(null)} className="rounded-full px-2 py-1 text-xs text-muted">cancel</button>
                </div>
              </div>
            )}
          </div>

          {card ? (
            <div className="mt-4 border-t border-white/5 pt-3">
              <div className="text-sm font-semibold text-ink">Images</div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <ImageSlot cardId={card.card_id} side="front" url={frontUrl}
                  onChange={async (url) => { await setCardImages(card.card_id, url, backUrl); setFrontUrl(url); }} />
                <ImageSlot cardId={card.card_id} side="back" url={backUrl}
                  onChange={async (url) => { await setCardImages(card.card_id, frontUrl, url); setBackUrl(url); }} />
              </div>
            </div>
          ) : null}

          {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}
        </div>

        <div className="flex items-center justify-between border-t border-white/5 p-4">
          {card ? <button onClick={remove} disabled={busy} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-gold">Delete card</button> : <span />}
          <button onClick={save} disabled={busy} className="rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}

function ImageSlot({ cardId, side, url, onChange }: {
  cardId: number; side: "front" | "back"; url: string | null; onChange: (url: string | null) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function pick(file: File) {
    setBusy(true); setErr(null);
    try {
      const newUrl = await uploadCatalogImage(cardId, side, file);
      await onChange(newUrl);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true); setErr(null);
    try {
      const old = url;
      await onChange(null);
      if (old) await removeCatalogImageObject(old);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted capitalize">{side}</span>
      <div className="relative aspect-[5/7] overflow-hidden border border-white/10 bg-white/[0.03]">
        {url ? (
          <Image src={url} alt={`${side} of card`} fill sizes="200px" className="object-contain" unoptimized />
        ) : (
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy}
            className="flex size-full flex-col items-center justify-center gap-1 text-muted hover:text-ink">
            <ImagePlus className="size-6" /><span className="text-[11px]">Upload</span>
          </button>
        )}
        {busy ? <div className="absolute inset-0 flex items-center justify-center bg-black/50"><Loader2 className="size-5 animate-spin text-ink" /></div> : null}
      </div>
      {url ? (
        <div className="flex gap-2 text-[11px]">
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="text-brand hover:underline">Replace</button>
          <button type="button" onClick={clear} disabled={busy} className="text-muted hover:text-gold">Remove</button>
        </div>
      ) : null}
      {err ? <p className="text-[11px] text-gold">{err}</p> : null}
      <input ref={inputRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) pick(f); e.target.value = ""; }} />
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`flex flex-col gap-1 ${className ?? ""}`}><span className="text-xs text-muted">{label}</span>{children}</label>;
}
function Chk({ v, set, label }: { v: boolean; set: (b: boolean) => void; label: string }) {
  return <label className="flex items-center gap-1.5"><input type="checkbox" checked={v} onChange={(e) => set(e.target.checked)} className="accent-[var(--color-brand)]" /> {label}</label>;
}
const inp = "h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand";
