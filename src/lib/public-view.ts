import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/lib/catalog/types";

// A card as returned by the public (share-view / profile) RPCs: the card_json
// shape plus the owner's public-safe condition fields. No prices/values/location.
export interface PublicCard extends Card {
  user_card_id: number;
  serial_number: number | null;
  grade: number | null;
  grading_agency: string | null;
  is_favorite: boolean | null;
}

export interface PublicView {
  name: string;
  view_mode: "list" | "gallery" | "table";
  is_owner: boolean;
  is_public: boolean;
  owner_username: string | null;
  owner_display: string | null;
}

export interface PublicViewResult {
  view: PublicView;
  cards: PublicCard[];
  truncated: boolean;
}

// Uses the cookie-aware server client so an authenticated owner gets the
// owner-preview path (private views + private sort keys); anon visitors get the
// public-safe slice. Returns null when the token is unknown or the view is
// private and the viewer isn't the owner.
export async function getPublicView(token: string): Promise<PublicViewResult | null> {
  await connection(); // request-time boundary: the server client's JWT check uses Date.now()
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_view_cards", { p_token: token });
  return (data as PublicViewResult | null) ?? null;
}

export interface PublicProfileView {
  name: string;
  share_token: string;
  slug: string | null;
  updated: string;
}

export interface PublicProfileResult {
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_owner: boolean;
  favorites: PublicCard[];
  views: PublicProfileView[];
}

// A collector's public profile: header + favorite cards + public shared views.
// Null when the handle is unknown or the profile is private (owner bypass).
export async function getPublicProfile(username: string): Promise<PublicProfileResult | null> {
  await connection();
  const supabase = await createClient();
  const { data } = await supabase.rpc("public_profile", { p_username: username });
  return (data as PublicProfileResult | null) ?? null;
}
