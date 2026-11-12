"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addCard, type AddState } from "@/app/collection/actions";
import { clearCachedRows, emitCollectionChanged } from "@/lib/collection/collection-cache";
import { loadLocations } from "@/lib/collection/load-index";
import { createLocation } from "@/lib/collection/mutations";
import type { LocationRow } from "@/lib/collection/index-types";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="h-11 w-full rounded-2xl bg-brand font-semibold text-white transition active:scale-[0.99] disabled:opacity-60">
      {pending ? "Adding…" : "Add to collection"}
    </button>
  );
}

// Client-side auth check keeps the card page cacheable (no server cookie read).
export function AddCardButton({ cardId }: { cardId: number }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [collectorId, setCollectorId] = useState<number | null>(null);
  const [li, setLi] = useState("");           // selected location id (controlled)
  const [newLoc, setNewLoc] = useState<string | null>(null); // inline-create input
  const [locErr, setLocErr] = useState<string | null>(null);
  const [state, action] = useActionState(addCard, {} as AddState);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user));
  }, []);

  // Load the user's locations + their collector id so they can file the card (and
  // create a new location) on add. RLS scopes both to the signed-in user.
  useEffect(() => {
    if (!authed) return;
    loadLocations().then(setLocations).catch(() => {});
    createClient().from("profiles").select("collector_id").maybeSingle()
      .then(({ data }) => setCollectorId((data as { collector_id?: number } | null)?.collector_id ?? null));
  }, [authed]);

  async function addLocation() {
    const name = (newLoc ?? "").trim();
    if (!name || collectorId == null) { setNewLoc(null); return; }
    try {
      const loc = await createLocation(collectorId, name);
      setLocations((ls) => [...ls, loc].sort((a, b) => (a.location ?? "").localeCompare(b.location ?? "")));
      setLi(String(loc.user_location_id)); setNewLoc(null); setLocErr(null);
    } catch (e) { setLocErr((e as Error).message); }
  }

  // After a successful add, drop the cached collection so /collection refetches
  // and shows the new card (the add runs server-side, outside the client cache).
  useEffect(() => {
    if (state.ok) { clearCachedRows(); emitCollectionChanged(cardId); }
  }, [state.ok, cardId]);

  if (authed === null) return <div className="h-11 animate-pulse rounded-2xl bg-white/5" />;

  if (!authed) {
    return (
      <Link href="/auth/login" className="flex h-11 items-center justify-center rounded-2xl border border-white/15 font-semibold text-ink">
        Sign in to add this card
      </Link>
    );
  }

  if (state.ok) {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
        <span className="text-ink">Added to your collection.</span>
        <Link href="/collection" className="font-semibold text-brand">View →</Link>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="h-11 w-full rounded-2xl bg-brand font-semibold text-white transition active:scale-[0.99]">
        Add to collection
      </button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <input type="hidden" name="card_id" value={cardId} />
      <div className="grid grid-cols-2 gap-3">
        <Field name="serial_number" label="Serial #" inputMode="numeric" />
        <Field name="grade" label="Grade" inputMode="decimal" />
        <Field name="purchase_price" label="Paid ($)" inputMode="decimal" />
        <Field name="estimated_value" label="Est. value ($)" inputMode="decimal" />
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-xs text-muted">Location</span>
        {newLoc === null ? (
          <div className="flex gap-2">
            <select name="user_location_id" value={li} onChange={(e) => setLi(e.target.value)}
              className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand">
              <option value="">No location</option>
              {locations.map((l) => <option key={l.user_location_id} value={l.user_location_id}>{l.location}</option>)}
            </select>
            <button type="button" onClick={() => { setNewLoc(""); setLocErr(null); }} title="New location"
              className="rounded-xl border border-white/10 px-3 text-muted hover:text-ink"><Plus className="size-4" /></button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input autoFocus value={newLoc} onChange={(e) => setNewLoc(e.target.value)} placeholder="New location name"
              className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
            <button type="button" onClick={addLocation} className="rounded-xl bg-brand px-3 text-sm font-semibold text-white">Add</button>
            <button type="button" onClick={() => { setNewLoc(null); setLocErr(null); }} className="rounded-xl border border-white/10 px-3 text-muted">✕</button>
          </div>
        )}
        {locErr ? <p className="text-xs text-gold">{locErr}</p> : null}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">Notes</span>
        <input name="notes" className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
      </label>
      {state.error ? <p className="text-sm text-gold">{state.error}</p> : null}
      <Submit />
    </form>
  );
}

function Field({ name, label, inputMode }: { name: string; label: string; inputMode?: "numeric" | "decimal" }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-muted">{label}</span>
      <input name={name} inputMode={inputMode}
        className="h-11 rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-ink outline-none focus:border-brand" />
    </label>
  );
}
