"use client";

import { createClient } from "@/lib/supabase/client";
import { EMPTY_FILTERS, type Filters, type SortState, type ValueMode, type ViewMode } from "./pipeline";

// A saved view serializes the collection screen's filter/sort/search/view state
// into a JSON-safe, versioned envelope. Sets become arrays (JSON can't hold Set);
// fromConfig/toConfig are the single round-trip source of truth so the server
// pipeline (024) and the owner's client agree on the shape.

export const SAVED_VIEW_VERSION = 1;

export interface SavedViewConfig {
  v: number;
  filters: {
    teamIds: number[];
    setId: number | null;
    locationIds: number[];
    rookie: boolean; auto: boolean; relic: boolean; graded: boolean;
    forSale: boolean; special: boolean; photo: boolean;
  };
  sort: SortState;
  search: string;
  view: ViewMode;
  valueMode: ValueMode;
}

export interface ViewState {
  filters: Filters;
  sort: SortState;
  search: string;
  view: ViewMode;
  valueMode: ValueMode;
}

export function toConfig(s: ViewState): SavedViewConfig {
  return {
    v: SAVED_VIEW_VERSION,
    filters: {
      teamIds: [...s.filters.teamIds],
      setId: s.filters.setId,
      locationIds: [...s.filters.locationIds],
      rookie: s.filters.rookie, auto: s.filters.auto, relic: s.filters.relic, graded: s.filters.graded,
      forSale: s.filters.forSale, special: s.filters.special, photo: s.filters.photo,
    },
    sort: s.sort,
    search: s.search,
    view: s.view,
    valueMode: s.valueMode,
  };
}

// Tolerant of old/partial configs: missing keys fall back to defaults so a saved
// view keeps working when the Filters model gains fields.
export function fromConfig(c: Partial<SavedViewConfig> | null | undefined): ViewState {
  const f: Partial<SavedViewConfig["filters"]> = c?.filters ?? {};
  return {
    filters: {
      ...EMPTY_FILTERS,
      teamIds: new Set(f.teamIds ?? []),
      setId: f.setId ?? null,
      locationIds: new Set(f.locationIds ?? []),
      rookie: !!f.rookie, auto: !!f.auto, relic: !!f.relic, graded: !!f.graded,
      forSale: !!f.forSale, special: !!f.special, photo: !!f.photo,
    },
    sort: c?.sort ?? { key: "cr", dir: "desc" },
    search: c?.search ?? "",
    view: c?.view ?? "list",
    valueMode: c?.valueMode ?? "current",
  };
}

export interface SavedViewRow {
  saved_view_id: number;
  name: string;
  slug: string | null;
  share_token: string;
  is_public: boolean;
  config: SavedViewConfig;
  created: string;
  updated: string;
}

export async function mySavedViews(): Promise<SavedViewRow[]> {
  const { data, error } = await createClient().rpc("my_saved_views");
  if (error) throw error;
  return (data ?? []) as SavedViewRow[];
}

export async function upsertSavedView(opts: {
  id?: number | null; name: string; config: SavedViewConfig; isPublic?: boolean; slug?: string | null;
}): Promise<number> {
  const { data, error } = await createClient().rpc("saved_view_upsert", {
    p_id: opts.id ?? null, p_name: opts.name.trim(), p_config: opts.config,
    p_is_public: opts.isPublic ?? false, p_slug: opts.slug ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function deleteSavedView(id: number): Promise<void> {
  const { error } = await createClient().rpc("saved_view_delete", { p_id: id });
  if (error) throw error;
}

export async function rotateSavedViewToken(id: number): Promise<string> {
  const { data, error } = await createClient().rpc("saved_view_rotate_token", { p_id: id });
  if (error) throw error;
  return data as string;
}
