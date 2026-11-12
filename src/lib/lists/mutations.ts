"use client";

import { createClient } from "@/lib/supabase/client";

// Lists / wantlists (workstream #28). Writes are direct table ops under RLS
// (owner-only, mirrors collection mutations); the two computed reads are RPCs.
// user_list.card_count is kept current by a DB trigger — never set it by hand.

export interface ListSummary {
  user_list_id: number;
  name: string | null;
  summary: string | null;
  card_count: number | null;
  is_public: boolean | null;
  created: string | null;
}

export async function myLists(collectorId: number): Promise<ListSummary[]> {
  const { data, error } = await createClient()
    .from("user_list")
    .select("user_list_id, name, summary, card_count, is_public, created")
    .eq("user_id", collectorId)
    .order("created", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ListSummary[];
}

// The caller's lists, each flagged `has` if it already contains p_card_id. Uses
// the my_lists() RPC so a client island needn't know its own collector_id.
export interface MyListRow extends ListSummary { has: boolean }
export async function myListsFor(cardId: number | null): Promise<MyListRow[]> {
  const { data, error } = await createClient().rpc("my_lists", { p_card_id: cardId });
  if (error) throw error;
  return (data ?? []) as MyListRow[];
}

export async function createList(collectorId: number, name: string, isPublic = false): Promise<number> {
  const { data, error } = await createClient()
    .from("user_list")
    .insert({ user_id: collectorId, name: name.trim(), is_public: isPublic, card_count: 0, created: new Date().toISOString() })
    .select("user_list_id")
    .single();
  if (error) throw error;
  return (data as { user_list_id: number }).user_list_id;
}

// Create a list for the current user without knowing collector_id (client island).
export async function createListSelf(name: string, isPublic = false): Promise<number> {
  const { data, error } = await createClient().rpc("list_create", { p_name: name.trim(), p_is_public: isPublic });
  if (error) throw error;
  return data as number;
}

export async function updateList(listId: number, patch: { name?: string; summary?: string | null; is_public?: boolean }): Promise<void> {
  const { error } = await createClient().from("user_list").update(patch).eq("user_list_id", listId);
  if (error) throw error;
}

export async function deleteList(listId: number): Promise<void> {
  const supabase = createClient();
  // Remove children first (no ON DELETE cascade on the migrated FK).
  await supabase.from("user_list_card").delete().eq("user_list_id", listId);
  const { error } = await supabase.from("user_list").delete().eq("user_list_id", listId);
  if (error) throw error;
}

export async function addCardToList(listId: number, cardId: number): Promise<void> {
  const { error } = await createClient()
    .from("user_list_card")
    .upsert({ user_list_id: listId, card_id: cardId, created: new Date().toISOString() },
      { onConflict: "user_list_id,card_id", ignoreDuplicates: true });
  if (error) throw error;
}

export async function removeCardFromList(listId: number, cardId: number): Promise<void> {
  const { error } = await createClient()
    .from("user_list_card").delete().eq("user_list_id", listId).eq("card_id", cardId);
  if (error) throw error;
}

export interface ListDetail {
  user_list_id: number;
  name: string | null;
  summary: string | null;
  card_count: number | null;
  is_public: boolean;
  is_owner: boolean;
  created: string | null;
  cards: (Record<string, unknown> & { card_id: number; owned: boolean })[];
}

export async function getListDetail(listId: number): Promise<ListDetail | null> {
  const { data, error } = await createClient().rpc("list_detail", { p_list_id: listId });
  if (error) throw error;
  return (data as ListDetail) ?? null;
}

export interface SeriesCompletion {
  series_id: number;
  series_name: string;
  series_slug: string;
  set_name: string;
  total: number;
  owned: number;
}

export async function getSeriesCompletion(): Promise<SeriesCompletion[]> {
  const { data, error } = await createClient().rpc("series_completion");
  if (error) throw error;
  return (data ?? []) as SeriesCompletion[];
}
