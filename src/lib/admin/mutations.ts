"use client";

import { createClient } from "@/lib/supabase/client";

// Admin catalog writes — all go through SECURITY DEFINER RPCs gated by
// assert_admin(); the browser client carries the admin's JWT so is_admin() resolves.

export interface PlayerPick {
  player_id?: number;
  team_id?: number;
  new_player?: { first?: string; last?: string; nick?: string };
  new_team?: { name?: string; city?: string; abbreviation?: string; organization_id?: number };
}

export interface MatchCandidate {
  player_id?: number; team_id?: number;
  first_name?: string; last_name?: string; nick_name?: string;
  name?: string; city?: string; abbreviation?: string;
  slug?: string; score: number; exact: boolean;
  teams?: { team_id: number; abbreviation: string | null; primary_color: string | null; secondary_color: string | null; organization_id: number | null }[];
  primary_color?: string | null; secondary_color?: string | null; organization_id?: number | null;
}
export interface MatchGroup { ord: number; raw: string; candidates: MatchCandidate[] }

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createClient().rpc(fn, args);
  if (error) throw error;
  return data as T;
}

// Keep the card search index fresh after catalog edits. The MV rebuild is slow
// (~20s+) and REFRESH CONCURRENTLY can't overlap itself, so we debounce (coalesce
// a burst of edits) and run it in the background — never blocking the admin's
// save. `pending` re-runs once if an edit lands mid-refresh.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing = false;
let pending = false;
async function runRefresh() {
  if (refreshing) { pending = true; return; }
  refreshing = true;
  try { await rpc<void>("refresh_card_search", {}); } catch { /* next edit / retry catches up */ }
  finally {
    refreshing = false;
    if (pending) { pending = false; void runRefresh(); }
  }
}
function scheduleSearchRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => { refreshTimer = null; void runRefresh(); }, 3000);
}
// Wrap a catalog write so a successful one schedules a search-index refresh.
function withRefresh<T>(pr: Promise<T>): Promise<T> {
  return pr.then((v) => { scheduleSearchRefresh(); return v; });
}

export const createSet = (p: { name: string; year: number | null; organization_id: number | null; manufacturer_id: number | null }) =>
  rpc<number>("admin_create_set", { p_name: p.name, p_year: p.year, p_organization_id: p.organization_id, p_manufacturer_id: p.manufacturer_id });

export const createSeries = (p: {
  name: string; set_id: number; color_id?: number | null; is_base?: boolean;
  parallel_of_series_id?: number | null; print_run?: number | null; print_run_display?: string | null; card_count?: number;
}) => rpc<number>("admin_create_series", {
  p_name: p.name, p_set_id: p.set_id, p_color_id: p.color_id ?? null, p_is_base: p.is_base ?? false,
  p_parallel_of_series_id: p.parallel_of_series_id ?? null, p_print_run: p.print_run ?? null,
  p_print_run_display: p.print_run_display ?? null, p_card_count: p.card_count ?? 0,
});

export const createPlayer = (p: { first?: string; last?: string; nick?: string; is_hof?: boolean; team_id?: number }) =>
  rpc<number>("admin_create_player", { p_first_name: p.first ?? null, p_last_name: p.last ?? null, p_nick_name: p.nick ?? null, p_is_hof: p.is_hof ?? false, p_team_id: p.team_id ?? null });

export const createTeam = (p: { name: string; abbreviation?: string; organization_id?: number | null; city?: string; primary_color?: string; secondary_color?: string }) =>
  rpc<number>("admin_create_team", { p_name: p.name, p_abbreviation: p.abbreviation ?? null, p_organization_id: p.organization_id ?? null, p_city: p.city ?? null, p_primary_color: p.primary_color ?? null, p_secondary_color: p.secondary_color ?? null });

export const upsertCard = (p: {
  card_id?: number | null; series_id: number; card_number?: string | null;
  is_rookie?: boolean; is_autograph?: boolean; is_relic?: boolean; is_short_print?: boolean;
  print_run?: number | null; color_id?: number | null; sort_order?: number | null; notes?: string | null;
  players?: { player_id: number; team_id: number }[];
}) => withRefresh(rpc<number>("admin_upsert_card", {
  p_card_id: p.card_id ?? null, p_series_id: p.series_id, p_card_number: p.card_number ?? null,
  p_is_rookie: p.is_rookie ?? false, p_is_autograph: p.is_autograph ?? false, p_is_relic: p.is_relic ?? false, p_is_short_print: p.is_short_print ?? false,
  p_print_run: p.print_run ?? null, p_color_id: p.color_id ?? null, p_sort_order: p.sort_order ?? null, p_notes: p.notes ?? null,
  p_players: p.players ?? [],
}));

export const matchPlayers = (names: string[]) => rpc<MatchGroup[]>("match_players", { p_names: names });
export const matchTeams = (names: string[], org?: number | null) => rpc<MatchGroup[]>("match_teams", { p_names: names, p_org: org ?? null });

// --- edit existing entities (names feed the card search text → refresh) ---
export const updatePlayer = (id: number, p: { first?: string; last?: string; nick?: string; birthdate?: string | null; is_hof?: boolean }) =>
  withRefresh(rpc<number>("admin_update_player", { p_player_id: id, p_first_name: p.first ?? null, p_last_name: p.last ?? null, p_nick_name: p.nick ?? null, p_birthdate: p.birthdate ?? null, p_is_hof: p.is_hof ?? false }));

export const updateTeam = (id: number, p: { name: string; abbreviation?: string; organization_id?: number | null; city?: string; mascot?: string; primary_color?: string; secondary_color?: string }) =>
  withRefresh(rpc<number>("admin_update_team", { p_team_id: id, p_name: p.name, p_abbreviation: p.abbreviation ?? null, p_organization_id: p.organization_id ?? null, p_city: p.city ?? null, p_mascot: p.mascot ?? null, p_primary_color: p.primary_color ?? null, p_secondary_color: p.secondary_color ?? null }));

export const updateSet = (id: number, p: { name: string; year: number | null; organization_id?: number | null; manufacturer_id?: number | null }) =>
  withRefresh(rpc<number>("admin_update_set", { p_set_id: id, p_name: p.name, p_year: p.year, p_organization_id: p.organization_id ?? null, p_manufacturer_id: p.manufacturer_id ?? null }));

export const updateSeries = (id: number, p: { name: string; color_id?: number | null; is_base?: boolean; parallel_of_series_id?: number | null; print_run?: number | null; print_run_display?: string | null; card_count?: number | null }) =>
  withRefresh(rpc<number>("admin_update_series", { p_series_id: id, p_name: p.name, p_color_id: p.color_id ?? null, p_is_base: p.is_base ?? false, p_parallel_of_series_id: p.parallel_of_series_id ?? null, p_print_run: p.print_run ?? null, p_min_print_run: null, p_max_print_run: null, p_print_run_display: p.print_run_display ?? null, p_production_code: null, p_card_count: p.card_count ?? null }));

export const mergePlayer = (keepId: number, dupId: number) => withRefresh(rpc<void>("admin_merge_player", { p_keep: keepId, p_dup: dupId }));
export const deleteCard = (cardId: number) => withRefresh(rpc<void>("admin_delete_card", { p_card_id: cardId }));

// --- catalog card images (workstream #27) ---
const CATALOG_BUCKET = "catalog-images";

// Upload (overwrite) a card's front/back image to Storage and return a
// cache-busted public URL. Admin-only via the bucket's is_admin() RLS policy.
export async function uploadCatalogImage(cardId: number, side: "front" | "back", file: File): Promise<string> {
  const supabase = createClient();
  const path = `cards/${cardId}/${side}.jpg`;
  const { error } = await supabase.storage.from(CATALOG_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const url = supabase.storage.from(CATALOG_BUCKET).getPublicUrl(path).data.publicUrl;
  return `${url}?v=${Date.now()}`; // bust next/image + browser cache on replace
}

// Remove a card image object from Storage (best-effort; ignores Azure-hosted URLs).
export async function removeCatalogImageObject(url: string): Promise<void> {
  const marker = `/public/${CATALOG_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return; // not a Supabase catalog-images object (e.g. legacy Azure URL)
  const path = url.slice(idx + marker.length).split("?")[0];
  await createClient().storage.from(CATALOG_BUCKET).remove([path]);
}

// Persist the final front/back paths on the card row (pass both; unchanged side
// keeps its current value). Null clears that side.
export const setCardImages = (cardId: number, front: string | null, back: string | null) =>
  rpc<number>("admin_set_card_images", { p_card_id: cardId, p_front_image_path: front, p_back_image_path: back });

export interface ImportResult {
  created: number; skipped: number; errors: number;
  rows: { row: number; status: "created" | "skipped" | "error"; card_id?: number; message?: string }[];
}
export const importCards = (seriesId: number, rows: unknown[], onDuplicate: "skip" | "error" = "skip") =>
  withRefresh(rpc<ImportResult>("admin_import_cards", { p_series_id: seriesId, p_rows: rows, p_on_duplicate: onDuplicate }));

export const refreshSearchIndex = () => rpc<void>("refresh_card_search", {});

// --- crowdsourcing review (workstream #29) ---
export interface PendingSubmission {
  type: "set" | "card_edit" | "team_edit" | "player_edit" | "series" | "card";
  submission_id: number;
  user_id: number;
  summary: string;
  notes: string | null;
  created_at: string;
}
export const pendingSubmissions = () => rpc<PendingSubmission[]>("pending_submissions", {});
export const reviewSubmission = (type: string, id: number, approve: boolean, notes?: string | null) =>
  rpc<{ status: string; created_set_id?: number }>("review_submission",
    { p_type: type, p_submission_id: id, p_approve: approve, p_notes: notes ?? null });

// Approve-applies is wired for every submission type.
export const APPROVABLE_TYPES = new Set(["set", "card_edit", "team_edit", "player_edit", "series", "card"]);
