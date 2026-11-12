// Module-singleton session cache for the loaded collection. Survives client-side
// navigations (away to a card and back) so the screen is instant on return; lost
// on hard reload (which just re-fetches the ~750KB gzipped index). Keyed by
// collector so a different signed-in user never sees stale rows.
import type { CompactRow } from "./index-types";

let cache: { collectorId: number; rows: CompactRow[]; at: number } | null = null;

export function getCachedRows(collectorId: number): CompactRow[] | null {
  return cache && cache.collectorId === collectorId ? cache.rows : null;
}
export function setCachedRows(collectorId: number, rows: CompactRow[]) {
  cache = { collectorId, rows, at: Date.now() };
}
// Keep the singleton in sync after an optimistic mutation.
export function syncCachedRows(collectorId: number, rows: CompactRow[]) {
  if (cache && cache.collectorId === collectorId) cache = { ...cache, rows };
}

// Drop the cache so the next collection mount refetches a fresh index. Used after
// adds that happen OUTSIDE the collection screen (the add-to-collection server
// action on the card page can't patch the in-memory rows).
export function clearCachedRows() {
  cache = null;
}

// Fired on the window after a card is added/removed from the collection so other
// islands on the same page (e.g. a card page's "In your collection" strip) can
// re-fetch without a reload. detail.cardId lets listeners filter to their card.
export const COLLECTION_CHANGED_EVENT = "cyc:collection-changed";
export function emitCollectionChanged(cardId?: number) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(COLLECTION_CHANGED_EVENT, { detail: { cardId } }));
  }
}
