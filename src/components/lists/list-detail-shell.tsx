"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, Globe, Lock, Trash2, X } from "lucide-react";
import { CardTile } from "@/components/catalog/card-tile";
import { deleteList, getListDetail, removeCardFromList, updateList, type ListDetail } from "@/lib/lists/mutations";
import type { Card } from "@/lib/catalog/types";

export function ListDetailShell({ listId }: { listId: number }) {
  const router = useRouter();
  const [list, setList] = useState<ListDetail | null | "missing">(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getListDetail(listId).then((d) => { setList(d ?? "missing"); if (d) setName(d.name ?? ""); }).catch(() => setList("missing"));
  }, [listId]);

  if (list === null) return <main className="mx-auto max-w-screen-sm px-4 py-10 text-sm text-muted">Loading…</main>;
  if (list === "missing") return (
    <main className="mx-auto max-w-screen-sm px-4 py-10">
      <p className="text-sm text-muted">This list is private or doesn&apos;t exist.</p>
      <Link href="/lists" className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand"><ArrowLeft className="size-4" /> All lists</Link>
    </main>
  );

  const owner = list.is_owner;

  async function saveMeta(patch: { name?: string; is_public?: boolean }) {
    setBusy(true); setErr(null);
    try { await updateList(listId, patch); setList((l) => (l && l !== "missing" ? { ...l, ...patch } : l)); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function removeCard(cardId: number) {
    if (!list || list === "missing") return;
    const next = list.cards.filter((c) => (c as unknown as Card).card_id !== cardId);
    setList({ ...list, cards: next, card_count: next.length });
    try { await removeCardFromList(listId, cardId); } catch (e) { setErr((e as Error).message); }
  }

  async function doDelete() {
    setBusy(true);
    try { await deleteList(listId); router.push("/lists"); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <Link href="/lists" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink"><ArrowLeft className="size-4" /> All lists</Link>

      <div className="mt-3 flex items-start justify-between gap-3">
        {owner ? (
          <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== list.name && saveMeta({ name: name.trim() })}
            className="min-w-0 flex-1 bg-transparent font-display text-2xl text-ink outline-none" />
        ) : (
          <h1 className="font-display text-2xl text-ink">{list.name || "Untitled list"}</h1>
        )}
        <span className="mt-1 shrink-0 font-mono text-sm text-muted">{list.card_count ?? list.cards.length}</span>
      </div>

      {owner ? (
        <div className="mt-2 flex items-center gap-3">
          <button onClick={() => saveMeta({ is_public: !list.is_public })} disabled={busy}
            className="flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-xs text-ink hover:bg-white/5">
            {list.is_public ? <><Globe className="size-3.5 text-brand" /> Public</> : <><Lock className="size-3.5" /> Private</>}
          </button>
          <button onClick={doDelete} disabled={busy} className="flex items-center gap-1.5 text-xs text-muted hover:text-gold"><Trash2 className="size-3.5" /> Delete list</button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">Shared list{list.is_public ? " · public" : ""}</p>
      )}

      {err ? <p className="mt-3 text-sm text-gold">{err}</p> : null}

      <div className="mt-5 flex flex-col gap-2">
        {list.cards.length === 0 ? (
          <p className="text-sm text-muted">No cards in this list yet. Add cards from any card page.</p>
        ) : list.cards.map((c) => {
          const card = c as unknown as Card & { owned: boolean };
          return (
            <div key={card.card_id} className="relative">
              <div className={card.owned ? "" : "opacity-70"}>
                <CardTile card={card} />
              </div>
              <span className={`absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-semibold ${card.owned ? "bg-brand/20 text-brand" : "bg-white/10 text-muted"}`}>
                {card.owned ? <span className="flex items-center gap-0.5"><Check className="size-2.5" /> Owned</span> : "Need"}
              </span>
              {owner ? (
                <button onClick={() => removeCard(card.card_id)} title="Remove from list"
                  className="absolute -right-1.5 -top-1.5 rounded-full bg-red-500 p-0.5 text-white"><X className="size-3" /></button>
              ) : null}
            </div>
          );
        })}
      </div>
    </main>
  );
}
