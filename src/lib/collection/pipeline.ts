import type { CompactRow } from "./index-types";
import { fullName, UNASSIGNED } from "./index-types";

export type ViewMode = "list" | "gallery" | "table";
export type ValueMode = "current" | "estimated";

export interface Filters {
  teamIds: Set<number>;
  setId: number | null;
  locationIds: Set<number>; // may include UNASSIGNED(0); empty => all locations
  rookie: boolean;
  auto: boolean;
  relic: boolean;
  graded: boolean;
  forSale: boolean;
  special: boolean;
  photo: boolean;
}

export const EMPTY_FILTERS: Filters = {
  teamIds: new Set(), setId: null, locationIds: new Set(),
  rookie: false, auto: false, relic: false, graded: false, forSale: false, special: false, photo: false,
};

export type SortKey = "cr" | "n" | "player" | "se" | "sn" | "cl" | "pp" | "ev" | "cv" | "ln" | "g" | "pc";
export interface SortState { key: SortKey; dir: "asc" | "desc" }

function matchesFilters(row: CompactRow, f: Filters): boolean {
  if (f.rookie && !row.rk) return false;
  if (f.auto && !row.au) return false;
  if (f.relic && !row.rl) return false;
  if (f.graded && row.g == null) return false;
  if (f.forSale && !row.fs) return false;
  if (f.special && !row.sp) return false;
  if (f.photo && !(row.pc > 0)) return false;
  if (f.setId != null && row.stid !== f.setId) return false;
  if (f.teamIds.size > 0 && !row.pl.some((p) => f.teamIds.has(p.t))) return false;
  if (f.locationIds.size > 0) {
    const inLoc = (row.li != null && f.locationIds.has(row.li)) || (row.li == null && f.locationIds.has(UNASSIGNED));
    if (!inLoc) return false;
  }
  return true;
}

function rowHaystack(row: CompactRow): string {
  const parts: (string | null | undefined)[] = [
    row.n, row.se, row.st, row.cl, row.ln, row.nt, row.rc, row.ga,
    row.sn != null ? String(row.sn) : null, row.g != null ? String(row.g) : null,
  ];
  for (const p of row.pl) { parts.push(p.f, p.l, p.ta); }
  return parts.filter(Boolean).join(" ").toLowerCase();
}

function matchesSearch(row: CompactRow, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const hay = rowHaystack(row);
  return tokens.every((t) => hay.includes(t));
}

function lastName(row: CompactRow): string {
  return (row.pl[0] ? (row.pl[0].l || row.pl[0].f || "") : "").toLowerCase();
}

function cmpVal(row: CompactRow, key: SortKey): string | number {
  switch (key) {
    case "cr": return row.cr;
    case "sn": return row.sn ?? -1;
    case "pp": return row.pp ?? -1;
    case "ev": return row.ev ?? -1;
    case "cv": return row.cv ?? -1;
    case "g": return row.g ?? -1;
    case "pc": return row.pc ?? 0;
    case "n": { const num = Number((row.n ?? "").replace(/\D/g, "")); return Number.isFinite(num) && row.n ? num : Number.MAX_SAFE_INTEGER; }
    case "player": return lastName(row);
    case "se": return (row.se ?? "").toLowerCase();
    case "cl": return (row.cl ?? "").toLowerCase();
    case "ln": return (row.ln ?? "").toLowerCase();
    default: return 0;
  }
}

export function runPipeline(rows: CompactRow[], filters: Filters, search: string, sort: SortState): CompactRow[] {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((r) => matchesFilters(r, filters) && matchesSearch(r, tokens));
  const dir = sort.dir === "asc" ? 1 : -1;
  filtered.sort((a, b) => {
    const av = cmpVal(a, sort.key), bv = cmpVal(b, sort.key);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return a.i - b.i;
  });
  return filtered;
}

export interface Stats {
  count: number; value: number; purchase: number;
  players: number; autos: number; relics: number; graded: number; rookies: number;
}

// The value to show for one card under the current mode. "current" falls back to
// estimated; "estimated" falls back to the PAID price when there's no estimate
// (UI-only — the DB is untouched). Treats 0 as "no value" so $0 is hidden.
export function cardValue(row: CompactRow, mode: ValueMode): number | null {
  const v = mode === "estimated" ? (row.ev || row.pp) : (row.cv ?? row.ev);
  return v ? v : null;
}

export function computeStats(rows: CompactRow[], valueMode: ValueMode): Stats {
  const players = new Set<number>();
  let value = 0, purchase = 0, autos = 0, relics = 0, graded = 0, rookies = 0;
  for (const r of rows) {
    value += cardValue(r, valueMode) ?? 0; // keep the total in step with per-card display
    purchase += r.pp ?? 0;
    if (r.au) autos++;
    if (r.rl) relics++;
    if (r.g != null) graded++;
    if (r.rk) rookies++;
    for (const p of r.pl) players.add(p.p);
  }
  return { count: rows.length, value, purchase, players: players.size, autos, relics, graded, rookies };
}

export interface TeamFacet { id: number; abbr: string | null; primary: string | null; secondary: string | null; count: number }

// Team facets from the full set (stable chips) with per-team counts.
export function teamFacets(rows: CompactRow[]): TeamFacet[] {
  const m = new Map<number, TeamFacet>();
  for (const r of rows) {
    for (const p of r.pl) {
      const t = m.get(p.t);
      if (t) t.count++;
      else m.set(p.t, { id: p.t, abbr: p.ta, primary: p.tp, secondary: p.ts, count: 1 });
    }
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

export interface SetFacet { id: number; name: string | null; year: number | null; count: number }
export function setFacets(rows: CompactRow[]): SetFacet[] {
  const m = new Map<number, SetFacet>();
  for (const r of rows) {
    const s = m.get(r.stid);
    if (s) s.count++;
    else m.set(r.stid, { id: r.stid, name: r.st, year: r.yr, count: 1 });
  }
  return [...m.values()].sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.name ?? "").localeCompare(b.name ?? ""));
}
