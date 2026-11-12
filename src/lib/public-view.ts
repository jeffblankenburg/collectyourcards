import "server-only";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Card } from "@/lib/catalog/types";
import type { CompactRow } from "@/lib/collection/index-types";
import type { SortState } from "@/lib/collection/pipeline";

// A card as returned by the public (share-view / profile) RPCs: the card_json
// shape plus the owner's public-safe condition fields. No prices/values/location.
export interface PublicCard extends Card {
  user_card_id: number;
  serial_number: number | null;
  grade: number | null;
  grading_agency: string | null;
  is_favorite: boolean | null;
  primary_photo_url: string | null;
}

// Adapt a public card slice to the CompactRow the shared card-row components
// render from — so a shared/public card looks identical to the collection. The
// private fields (price/value/location/notes/random_code) are intentionally
// null/false: the slice never carries them.
export function publicCardToRow(c: PublicCard): CompactRow {
  return {
    i: c.user_card_id, c: c.card_id, n: c.card_number,
    sn: c.serial_number, pr: c.print_run, g: c.grade, ga: c.grading_agency, gid: null,
    pp: null, ev: null, cv: null, li: null, ln: null,
    sp: !!c.is_favorite, fs: false, wd: false, af: false, rc: null, nt: null,
    rk: c.is_rookie, au: c.is_autograph, rl: c.is_relic, sh: c.is_short_print,
    cl: c.color?.name ?? null, cx: c.color?.hex ?? null,
    se: c.series?.name ?? null, sid: c.series?.series_id ?? 0, sg: c.series?.slug ?? "",
    st: c.set?.name ?? null, stid: c.set?.set_id ?? 0, yr: c.set?.year ?? null,
    cr: 0, pc: c.primary_photo_url ? 1 : 0, pu: c.primary_photo_url ?? null,
    pl: c.players.map((p) => ({
      p: p.player_id, f: p.first_name, l: p.last_name,
      t: p.team?.team_id ?? 0, ta: p.team?.abbreviation ?? null,
      tp: p.team?.primary_color ?? null, ts: p.team?.secondary_color ?? null,
    })),
  };
}

export interface PublicView {
  name: string;
  view_mode: "list" | "gallery" | "table";
  sort: SortState;
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
