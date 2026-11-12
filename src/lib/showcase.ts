import { SHOWCASE_CARDS, type ShowcaseCard } from "@/data/showcase-cards";

// Fisher-Yates — returns a new shuffled copy, leaving the source untouched.
function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Random showcase selection for the home hero fan + marquee. Guarantees at most
// one card per player AND one per series (so no two cards share a face or a
// design), can exclude already-picked cards/players/series (so the fan and
// marquee stay mutually exclusive), and can skip landscape scans (the fan's
// fixed 5:7 frame crops them oddly). May return fewer than `count` if the pool
// runs out under these constraints. Called per request — see the connection()
// opt-in in lib/home-showcase.
type PickOptions = {
  exclude?: Set<number>;
  excludePlayers?: Iterable<string>;
  excludeSeries?: Iterable<string>;
  portraitOnly?: boolean;
  // Cap how many cards may share a team. `teamCounts` seeds the running tally
  // (e.g. the fan's teams) so the cap applies across the whole page, not per call.
  maxPerTeam?: number;
  teamCounts?: Iterable<readonly [string, number]>;
};

// Core selection over an arbitrary pool (the static list, or live collection
// cards mapped to ShowcaseCard). One per player AND one per series, at most
// `maxPerTeam` per team; honors the exclude sets; optionally skips cards known
// to be landscape.
export function pickFrom(
  pool: readonly ShowcaseCard[],
  count: number,
  opts?: PickOptions,
): ShowcaseCard[] {
  const seenPlayers = new Set<string>(opts?.excludePlayers);
  const seenSeries = new Set<string>(opts?.excludeSeries);
  const teamCounts = new Map<string, number>(opts?.teamCounts);
  const cap = opts?.maxPerTeam ?? Infinity;
  const out: ShowcaseCard[] = [];
  for (const card of shuffle(pool)) {
    if (opts?.exclude?.has(card.cardId)) continue;
    if (opts?.portraitOnly && card.landscape) continue;
    if (seenPlayers.has(card.player)) continue;
    if (seenSeries.has(card.series)) continue;
    if (card.team && (teamCounts.get(card.team) ?? 0) >= cap) continue;
    seenPlayers.add(card.player);
    seenSeries.add(card.series);
    if (card.team) teamCounts.set(card.team, (teamCounts.get(card.team) ?? 0) + 1);
    out.push(card);
    if (out.length >= count) break;
  }
  return out;
}

// Tally teams across a set of picks — used to seed the next pick's cap so the
// per-team limit spans the whole page.
export function teamTally(cards: readonly ShowcaseCard[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of cards) if (c.team) counts.set(c.team, (counts.get(c.team) ?? 0) + 1);
  return counts;
}

export function pickShowcaseCards(count: number, opts?: PickOptions): ShowcaseCard[] {
  return pickFrom(SHOWCASE_CARDS, count, opts);
}
