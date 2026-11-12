import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/lib/catalog/types";

export interface CollectionCard {
  user_card_id: number;
  serial_number: number | null;
  purchase_price: number | null;
  estimated_value: number | null;
  current_value: number | null;
  grade: number | null;
  grading_agency: string | null;
  is_for_sale: boolean | null;
  is_special: boolean | null;
  notes: string | null;
  location: string | null;
  created: string;
  primary_photo_url: string | null;
  card: Card;
}

export interface CollectionTotals {
  count: number;
  total_purchase: number;
  total_estimated: number;
  total_value: number;
  rookies: number;
  autographs: number;
  relics: number;
  graded: number;
  unique_series: number;
}

// Owner-scoped by RLS. Uses the authenticated server client (carries the session).
export async function getCollection(after?: number, limit = 50): Promise<CollectionCard[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("collection_list", {
    p_limit: limit,
    p_after: after ?? null,
    p_series_id: null, p_set_id: null, p_team_id: null, p_location_id: null,
    p_rookie: null, p_autograph: null, p_relic: null, p_graded: null,
  });
  return (data as CollectionCard[]) ?? [];
}

export async function getCollectionTotals(): Promise<CollectionTotals | null> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("collection_totals");
  return (data as CollectionTotals) ?? null;
}
