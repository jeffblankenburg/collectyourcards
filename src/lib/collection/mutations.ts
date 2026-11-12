"use client";

import { createClient } from "@/lib/supabase/client";

// All writes go through the browser client under the existing owner-only RLS
// (user_id = current_collector_id()), so no server action / privilege is needed.

export interface UserCardPatch {
  random_code?: string | null;
  serial_number?: number | null;
  user_location_id?: number | null;
  notes?: string | null;
  aftermarket_autograph?: boolean;
  purchase_price?: number | null;
  estimated_value?: number | null;
  grading_agency?: number | null;
  grade?: number | null;
  grade_id?: number | null;
  is_special?: boolean;
}

export async function updateUserCard(id: number, patch: UserCardPatch) {
  const supabase = createClient();
  const { error } = await supabase.from("user_card").update(patch).eq("user_card_id", id);
  if (error) throw error;
}

// Short per-card human label (matches the server addCard action + legacy format):
// 4 mixed-case alphanumerics. Not unique — a tag, not a key.
function randomCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Bulk-add: one new user_card per card_id (a copy even if already owned — matches
// v1), all filed to the same location/notes. Writes under owner-only RLS; chunked
// so a big checklist (hundreds of cards) stays within a sane statement size.
export async function bulkAddCards(
  collectorId: number, cardIds: number[], locationId: number | null, notes: string | null,
): Promise<number> {
  const supabase = createClient();
  const now = new Date().toISOString();
  let added = 0;
  for (let i = 0; i < cardIds.length; i += 300) {
    const rows = cardIds.slice(i, i + 300).map((card_id) => ({
      user_id: collectorId, card_id, user_location_id: locationId,
      notes: notes || null, random_code: randomCode(), created: now,
    }));
    const { error, count } = await supabase.from("user_card").insert(rows, { count: "exact" });
    if (error) throw error;
    added += count ?? rows.length;
  }
  return added;
}

// card_id -> owned copy count for the signed-in user within a series (RLS-scoped).
export async function seriesOwnedCounts(seriesId: number): Promise<Map<number, number>> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("series_owned_counts", { p_series_id: seriesId });
  if (error) throw error;
  const m = new Map<number, number>();
  for (const r of (data ?? []) as { card_id: number; cnt: number }[]) m.set(Number(r.card_id), Number(r.cnt));
  return m;
}

export async function deleteUserCard(id: number) {
  const supabase = createClient();
  await supabase.from("user_card_photo").delete().eq("user_card_id", id); // rows; objects removed by caller
  const { error } = await supabase.from("user_card").delete().eq("user_card_id", id);
  if (error) throw error;
}

// --- locations ---
export async function createLocation(collectorId: number, name: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_location")
    .insert({ user_id: collectorId, location: name, is_dashboard: true, card_count: 0, created: new Date().toISOString() })
    .select("user_location_id, location, card_count")
    .single();
  if (error) throw error;
  return data as { user_location_id: number; location: string; card_count: number };
}

export async function renameLocation(id: number, name: string) {
  const supabase = createClient();
  const { error } = await supabase.from("user_location").update({ location: name }).eq("user_location_id", id);
  if (error) throw error;
}

export async function deleteLocation(id: number, reassignTo: number | null) {
  const supabase = createClient();
  await supabase.from("user_card").update({ user_location_id: reassignTo }).eq("user_location_id", id);
  const { error } = await supabase.from("user_location").delete().eq("user_location_id", id);
  if (error) throw error;
}

// --- photos (user_card_photo rows) ---
export interface PhotoRow { user_card_photo_id: number; photo_url: string; sort_order: number | null }

export async function listPhotos(userCardId: number): Promise<PhotoRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_card_photo")
    .select("user_card_photo_id, photo_url, sort_order")
    .eq("user_card_id", userCardId)
    .order("sort_order", { nullsFirst: false });
  return (data as PhotoRow[]) ?? [];
}

export async function insertPhotoRow(userCardId: number, url: string, sortOrder: number): Promise<PhotoRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_card_photo")
    .insert({ user_card_id: userCardId, photo_url: url, sort_order: sortOrder, created: new Date().toISOString() })
    .select("user_card_photo_id, photo_url, sort_order")
    .single();
  if (error) throw error;
  return data as PhotoRow;
}

export async function deletePhotoRow(photoId: number) {
  const supabase = createClient();
  const { error } = await supabase.from("user_card_photo").delete().eq("user_card_photo_id", photoId);
  if (error) throw error;
}

export async function reorderPhotos(orders: { id: number; sort: number }[]) {
  const supabase = createClient();
  await Promise.all(orders.map((o) => supabase.from("user_card_photo").update({ sort_order: o.sort }).eq("user_card_photo_id", o.id)));
}

export async function updatePhotoUrl(photoId: number, url: string) {
  const supabase = createClient();
  const { error } = await supabase.from("user_card_photo").update({ photo_url: url }).eq("user_card_photo_id", photoId);
  if (error) throw error;
}
