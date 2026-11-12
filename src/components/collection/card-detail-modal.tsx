"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ExternalLink, Pencil, X } from "lucide-react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { useCollection } from "./collection-provider";
import { FlagBadges, PlayersWithTeams, ebaySoldUrl, gradeLabel, serialLabel } from "./card-row-shared";
import { listPhotos, type PhotoRow } from "@/lib/collection/mutations";
import { cardValue } from "@/lib/collection/pipeline";
import { money } from "@/lib/collection/index-types";

// Full-screen card viewer — the default on tapping a card. Swipe between photos;
// pinch / double-tap zooms the image in place (not the page). Metadata below,
// Close + Edit in the top bar (edit is a deliberate button, not the default).
export function CardDetailModal() {
  const { viewingRow, dispatch, valueMode, editingId } = useCollection();
  const row = viewingRow!;
  const [photos, setPhotos] = useState<PhotoRow[] | null>(null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadPhotos = useCallback((blank: boolean) => {
    if (blank) setPhotos(null);
    listPhotos(row.i)
      .then((ps) => setPhotos([...ps].sort((a, b) => (a.sort_order ?? 99) - (b.sort_order ?? 99))))
      .catch(() => setPhotos([]));
  }, [row.i]);

  useEffect(() => { setActive(0); setZoomed(false); loadPhotos(true); }, [loadPhotos]);

  // When the edit drawer for this card closes, re-fetch photos (without blanking)
  // so crops/rotations/adds/deletes made there show up in the viewer immediately.
  const prevEditing = useRef<number | null>(null);
  useEffect(() => {
    if (prevEditing.current != null && editingId == null) loadPhotos(false);
    prevEditing.current = editingId;
  }, [editingId, loadPhotos]);

  const close = () => dispatch({ t: "viewing", id: null });
  const edit = () => dispatch({ t: "editing", id: row.i });

  function onScroll() {
    const el = scrollRef.current;
    if (el) setActive(Math.round(el.scrollLeft / el.clientWidth));
  }

  const grade = gradeLabel(row);
  const serial = serialLabel(row);
  const value = cardValue(row, valueMode);

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-base">
      {/* top bar */}
      <div className="flex shrink-0 items-center justify-between p-3 [padding-top:calc(0.75rem+env(safe-area-inset-top))]">
        <button onClick={close} aria-label="Close" className="flex size-10 items-center justify-center rounded-full bg-white/10 text-ink transition hover:bg-white/15"><X className="size-5" /></button>
        <button onClick={edit} className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-white/15"><Pencil className="size-4" /> Edit</button>
      </div>

      {/* photos — swipe between; pinch / double-tap to zoom */}
      <div className="relative flex min-h-0 flex-[3] flex-col bg-black/30">
        {photos === null ? (
          // Show the primary (already known from the list) instantly while the full list loads.
          row.pu ? <div className="relative flex-1"><ZoomablePhoto src={row.pu} priority zoomed={zoomed} onZoomChange={setZoomed} /></div>
                 : <div className="flex flex-1 items-center justify-center text-sm text-muted">Loading…</div>
        ) : photos.length === 0 ? (
          row.pu ? <div className="relative flex-1"><ZoomablePhoto src={row.pu} priority zoomed={zoomed} onZoomChange={setZoomed} /></div>
                 : <div className="flex flex-1 items-center justify-center text-sm text-muted">No photos yet</div>
        ) : (
          <>
            <div ref={scrollRef} onScroll={onScroll}
              className={`flex flex-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${zoomed ? "overflow-hidden" : "snap-x snap-mandatory overflow-x-auto overscroll-contain"}`}>
              {photos.map((p, i) => (
                <div key={p.user_card_photo_id} className="relative h-full w-full shrink-0 snap-center">
                  <ZoomablePhoto src={p.photo_url} priority={i === 0} zoomed={zoomed} onZoomChange={setZoomed} />
                </div>
              ))}
            </div>
            {photos.length > 1 && !zoomed ? (
              <div className="flex shrink-0 items-center justify-center gap-1.5 py-2">
                {photos.map((_, i) => <span key={i} className={`size-1.5 rounded-full transition ${i === active ? "bg-brand" : "bg-white/25"}`} />)}
              </div>
            ) : null}
          </>
        )}
        {(photos?.length || row.pu) && !zoomed ? <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white/70">Pinch to zoom</span> : null}
      </div>

      {/* metadata */}
      <div className="flex-[2] overflow-y-auto border-t border-white/10 p-4 [padding-bottom:calc(1rem+env(safe-area-inset-bottom))]">
        <div className="flex items-start justify-between gap-3">
          <span className="font-mono text-sm font-semibold text-muted">#{row.n}</span>
          {value != null ? <span className="text-base font-semibold tabular-nums text-ink">{money(value)}</span> : null}
        </div>
        <div className="mt-1"><PlayersWithTeams row={row} stacked chipSize={18} /></div>
        <div className="mt-1 text-sm text-muted">{row.se}</div>
        <div className="mt-3"><FlagBadges row={row} locationLabel={row.ln} /></div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          {serial ? <Meta k="Serial" v={serial} /> : null}
          {grade ? <Meta k="Grade" v={grade} /> : null}
          {row.pp ? <Meta k="Paid" v={money(row.pp)} /> : null}
          {cardValue(row, "estimated") != null ? <Meta k="Est. value" v={money(cardValue(row, "estimated")!)} /> : null}
          {row.ln ? <Meta k="Location" v={row.ln} /> : null}
          {row.rc ? <Meta k="Code" v={row.rc} /> : null}
        </dl>
        {row.nt ? <div className="mt-4"><div className="text-xs text-muted">Notes</div><p className="mt-0.5 text-sm text-ink">{row.nt}</p></div> : null}

        <a href={ebaySoldUrl(row)} target="_blank" rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-sm text-ink transition hover:bg-white/5">
          <ExternalLink className="size-4 text-muted" /> eBay sold listings
        </a>
      </div>
    </div>
  );
}

// A single photo with in-place pinch / double-tap zoom + pan. Panning is disabled
// until the image is zoomed, so single-finger horizontal swipes pass through to
// the carousel; pinch is always handled here (never zooms the page). While any
// image is zoomed, the parent disables carousel swipe so panning takes over.
function ZoomablePhoto({ src, priority, zoomed, onZoomChange }: {
  src: string; priority?: boolean; zoomed: boolean; onZoomChange: (z: boolean) => void;
}) {
  return (
    <TransformWrapper
      minScale={1}
      maxScale={6}
      initialScale={1}
      centerOnInit
      limitToBounds
      doubleClick={{ mode: "toggle", step: 2 }}
      panning={{ disabled: !zoomed }}
      onTransform={(_ref, state) => {
        const z = state.scale > 1.01;
        if (z !== zoomed) onZoomChange(z);
      }}
    >
      <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
        <div className="relative h-full w-full">
          <Image src={src} alt="" fill sizes="100vw" className="object-contain" priority={priority} />
        </div>
      </TransformComponent>
    </TransformWrapper>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return <div><dt className="text-xs text-muted">{k}</dt><dd className="text-ink">{v}</dd></div>;
}
