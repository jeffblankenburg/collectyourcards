"use client";

import { createClient } from "@/lib/supabase/client";
import type { AgencyRow, CompactRow, LocationRow } from "./index-types";

// One-time loads via the browser Supabase client (session JWT -> RLS scopes to
// the signed-in collector). The index is the big one (~750KB gzip); locations
// and agencies are tiny.
export async function loadCollectionIndex(): Promise<CompactRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("collection_index");
  if (error) throw error;
  return (data as CompactRow[]) ?? [];
}

export async function loadLocations(): Promise<LocationRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("user_location")
    .select("user_location_id, location, card_count")
    .order("location");
  return (data as LocationRow[]) ?? [];
}

export async function loadAgencies(): Promise<AgencyRow[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("grading_agency")
    .select("grading_agency_id, abbreviation, name")
    .order("sort_order");
  return (data as AgencyRow[]) ?? [];
}
