import { sbPublic } from "@/lib/supabase/public";
import type { Card, SearchResults } from "@/lib/catalog/types";

// Public catalog reads (anon, RLS public-read). Cookie-less -> cache-safe.

// A query is treated as a specific-card search (so we also run card_text_search)
// when it has >=2 distinctive words, or any card-number-ish token (digit/hyphen).
// A single plain name ("bieber") stays an entity search — the player result covers it.
function isCardQuery(q: string): boolean {
  const toks = q.trim().toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const distinctive = toks.filter((t) => t.length >= 3 && !/^\d+$/.test(t));
  return distinctive.length >= 2 || toks.some((t) => /[\d-]/.test(t));
}

export async function searchEntities(q: string, lim = 8): Promise<SearchResults> {
  // Not `use cache`: the client hook already caches repeat queries, and the RPCs
  // are ~30ms. Avoids the disk-cache staleness that `use cache` introduces here.
  const [entities, cards] = await Promise.all([
    sbPublic.rpc("search_entities", { q, lim }),
    isCardQuery(q)
      ? sbPublic.rpc("card_text_search", { q, lim: Math.min(lim, 8) })
      : Promise.resolve({ data: [] as Card[] }),
  ]);
  const base = (entities.data as Omit<SearchResults, "cards">) ?? { players: [], teams: [], sets: [], series: [] };
  return { ...base, cards: ((cards.data as Card[]) ?? []) };
}

export async function getCard(cardId: number): Promise<Card | null> {
  const { data } = await sbPublic.rpc("card_json", { p_card_id: cardId });
  return (data as Card) ?? null;
}

export async function cardSearch(opts: {
  seriesId?: number; playerId?: number; teamId?: number; limit?: number; after?: number; q?: string;
}): Promise<Card[]> {
  const { data } = await sbPublic.rpc("card_search", {
    p_series_id: opts.seriesId ?? null,
    p_player_id: opts.playerId ?? null,
    p_team_id: opts.teamId ?? null,
    p_limit: opts.limit ?? 60,
    p_after: opts.after ?? null,
    p_q: opts.q?.trim() || null,
  });
  return (data as Card[]) ?? [];
}

export async function listSets(limit = 60, offset = 0) {
  const { data } = await sbPublic
    .from("set")
    .select("set_id, name, year, slug, card_count, series_count")
    .order("year", { ascending: false })
    .order("name", { ascending: true })
    .range(offset, offset + limit - 1);
  return data ?? [];
}

export interface SetIndexRow {
  set_id: number;
  name: string | null;
  year: number | null;
  slug: string;
  card_count: number | null;
  series_count: number | null;
  sport: string | null;
  org: string | null;
}

// Every set as one compact array (a few thousand rows) for the client-side
// searchable/sport-filterable /sets browser.
export async function setsIndex(): Promise<SetIndexRow[]> {
  const { data } = await sbPublic.rpc("sets_index");
  return (data as SetIndexRow[]) ?? [];
}

export async function getSetBySlug(slug: string) {
  const { data } = await sbPublic
    .from("set")
    .select("set_id, name, year, slug, card_count, series_count")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function listSeriesForSet(setId: number) {
  const { data } = await sbPublic
    .from("series")
    .select("series_id, name, slug, card_count, is_base, parallel_of_series_id, print_run_display, color_id")
    .eq("set_id", setId)
    .order("is_base", { ascending: false })
    .order("name", { ascending: true });
  return data ?? [];
}

export async function getSeriesBySlug(slug: string) {
  const { data } = await sbPublic
    .from("series")
    .select("series_id, name, slug, card_count, is_base, print_run_display, set_id, set:set_id(set_id, name, year, slug)")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getPlayerBySlug(slug: string) {
  const { data } = await sbPublic
    .from("player")
    .select("player_id, first_name, last_name, nick_name, slug, is_hof, card_count")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

export async function getTeamBySlug(slug: string) {
  const { data } = await sbPublic
    .from("team")
    .select("team_id, name, city, abbreviation, slug, primary_color, secondary_color, card_count, player_count")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}
