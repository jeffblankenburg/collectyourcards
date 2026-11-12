"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ListPlus, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { addCardToList, createListSelf, myListsFor, removeCardFromList, type MyListRow } from "@/lib/lists/mutations";

// Card-page island: add/remove this card to any of the user's lists, or make a
// new one. Signed-out users get a link to sign in.
export function AddToListButton({ cardId }: { cardId: number }) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<MyListRow[] | null>(null);
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user)); }, []);

  useEffect(() => {
    if (!open || lists) return;
    myListsFor(cardId).then(setLists).catch((e) => setErr(e.message));
  }, [open, cardId, lists]);

  // close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle(l: MyListRow) {
    setBusyId(l.user_list_id); setErr(null);
    const has = l.has;
    setLists((ls) => ls?.map((x) => x.user_list_id === l.user_list_id ? { ...x, has: !has, card_count: (x.card_count ?? 0) + (has ? -1 : 1) } : x) ?? ls);
    try { has ? await removeCardFromList(l.user_list_id, cardId) : await addCardToList(l.user_list_id, cardId); }
    catch (e) {
      setErr((e as Error).message);
      setLists((ls) => ls?.map((x) => x.user_list_id === l.user_list_id ? { ...x, has, card_count: (x.card_count ?? 0) + (has ? 1 : -1) } : x) ?? ls);
    } finally { setBusyId(null); }
  }

  async function createAndAdd() {
    if (!newName.trim()) return;
    setBusyId("new"); setErr(null);
    try {
      const id = await createListSelf(newName.trim());
      await addCardToList(id, cardId);
      setNewName("");
      setLists(await myListsFor(cardId));
    } catch (e) { setErr((e as Error).message); } finally { setBusyId(null); }
  }

  if (authed === null) return null;
  if (!authed) {
    return (
      <Link href="/auth/login" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-muted hover:text-ink">
        <ListPlus className="size-4" /> Add to list
      </Link>
    );
  }

  return (
    <div className="relative inline-block" ref={popRef}>
      <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-ink hover:bg-white/5">
        <ListPlus className="size-4" /> Add to list
      </button>

      {open ? (
        <div className="absolute z-50 mt-2 w-64 rounded-2xl border border-white/10 bg-base p-2 shadow-xl">
          {lists === null ? (
            <p className="px-2 py-3 text-xs text-muted">Loading…</p>
          ) : (
            <ul className="max-h-60 overflow-y-auto">
              {lists.map((l) => (
                <li key={l.user_list_id}>
                  <button onClick={() => toggle(l)} disabled={busyId === l.user_list_id}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm text-ink hover:bg-white/5 disabled:opacity-50">
                    <span className="truncate">{l.name || "Untitled"}</span>
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${l.has ? "border-brand bg-brand text-white" : "border-white/20"}`}>
                      {l.has ? <Check className="size-3" /> : null}
                    </span>
                  </button>
                </li>
              ))}
              {lists.length === 0 ? <li className="px-2 py-2 text-xs text-muted">No lists yet.</li> : null}
            </ul>
          )}
          <div className="mt-1 flex gap-1 border-t border-white/5 pt-2">
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createAndAdd()}
              placeholder="New list…" className="h-9 flex-1 rounded-lg border border-white/10 bg-white/5 px-2 text-sm text-ink outline-none focus:border-brand" />
            <button onClick={createAndAdd} disabled={busyId === "new" || !newName.trim()} className="flex size-9 items-center justify-center rounded-lg bg-brand text-white disabled:opacity-50"><Plus className="size-4" /></button>
          </div>
          {err ? <p className="px-2 pt-1 text-[11px] text-gold">{err}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
