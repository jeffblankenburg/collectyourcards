"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { COLLECTION_CHANGED_EVENT } from "@/lib/collection/collection-cache";

type Copy = {
  user_card_id: number;
  random_code: string | null;
  photo_url: string | null;
  location: string | null;
};

// Client-side (like AddCardButton) so the catalog card page stays cacheable.
// If the signed-in user owns this card, surface their copies with a tap-through
// to view each one in their collection (/collection?view=<userCardId>). RLS on
// user_card scopes the query to the owner, so anon/other users see nothing.
export function YourCopies({ cardId, fallbackImage }: { cardId: number; fallbackImage: string | null }) {
  const [copies, setCopies] = useState<Copy[] | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) { setCopies([]); return; }

    const { data: ucs } = await sb
      .from("user_card")
      .select("user_card_id, random_code, created, user_location_id")
      .eq("card_id", cardId)
      .is("sold_at", null)
      .order("created", { ascending: false });

    const rows = ucs ?? [];
    const ids = rows.map((r) => r.user_card_id);
    const photoByCard = new Map<number, string>();
    if (ids.length) {
      const { data: photos } = await sb
        .from("user_card_photo")
        .select("user_card_id, photo_url, sort_order")
        .in("user_card_id", ids)
        .order("sort_order", { ascending: true, nullsFirst: false });
      for (const p of photos ?? []) {
        if (!photoByCard.has(p.user_card_id)) photoByCard.set(p.user_card_id, p.photo_url);
      }
    }

    // Resolve location names for the copies that are filed somewhere.
    const locIds = [...new Set(rows.map((r) => r.user_location_id).filter((x): x is number => x != null))];
    const locById = new Map<number, string>();
    if (locIds.length) {
      const { data: locs } = await sb
        .from("user_location")
        .select("user_location_id, location")
        .in("user_location_id", locIds);
      for (const l of locs ?? []) locById.set(l.user_location_id, l.location);
    }

    setCopies(rows.map((r) => ({
      user_card_id: r.user_card_id,
      random_code: r.random_code,
      photo_url: photoByCard.get(r.user_card_id) ?? null,
      location: r.user_location_id != null ? (locById.get(r.user_location_id) ?? null) : null,
    })));
  }, [cardId]);

  useEffect(() => { void load(); }, [load]);

  // Re-fetch when a card is added to the collection elsewhere on this page (the
  // Add button), so the new copy shows without a reload.
  useEffect(() => {
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ cardId?: number }>).detail;
      if (detail?.cardId == null || detail.cardId === cardId) void load();
    };
    window.addEventListener(COLLECTION_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(COLLECTION_CHANGED_EVENT, onChange);
  }, [load, cardId]);

  if (!copies || copies.length === 0) return null;

  return (
    <section className="mt-8 border-t border-white/8 pt-5">
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        In your collection · {copies.length}
      </h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {copies.map((c) => {
          const src = c.photo_url ?? fallbackImage;
          return (
            <Link key={c.user_card_id} href={`/collection?view=${c.user_card_id}`} className="group shrink-0">
              <div className="relative aspect-[5/7] w-24 overflow-hidden border border-white/15 bg-white/5 transition group-hover:border-brand/50">
                {src ? <Image src={src} alt="" fill sizes="96px" className="object-cover" /> : null}
              </div>
              <div className="mt-1.5 flex w-24 flex-col items-center gap-1">
                {c.random_code ? (
                  <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 font-mono text-xs tracking-wide text-ink">
                    {c.random_code}
                  </span>
                ) : null}
                <span className="flex max-w-full items-center gap-0.5 text-[11px] text-muted">
                  <MapPin className="size-2.5 shrink-0" />
                  <span className="truncate">{c.location ?? "No location"}</span>
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
