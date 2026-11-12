// Compact row shape returned by the collection_index() RPC. Short keys keep the
// one-time payload small; this is the single source the whole screen filters,
// sorts, and renders from — never re-fetched for interactions.

export interface CompactPlayer {
  p: number;            // player_id
  f: string | null;     // first_name
  l: string | null;     // last_name
  t: number;            // team_id
  ta: string | null;    // team abbreviation
  tp: string | null;    // team primary_color
  ts: string | null;    // team secondary_color
}

export interface CompactRow {
  i: number;            // user_card_id (react key)
  c: number;            // card_id
  n: string | null;     // card_number
  sn: number | null;    // serial_number
  pr: number | null;    // print_run
  g: number | null;     // grade
  ga: string | null;    // grading agency abbreviation
  gid: number | null;   // grade_id
  pp: number | null;    // purchase_price
  ev: number | null;    // estimated_value
  cv: number | null;    // current_value
  li: number | null;    // user_location_id
  ln: string | null;    // location name
  sp: boolean;          // is_special (favorite)
  fs: boolean;          // is_for_sale
  wd: boolean;          // is_wanted
  af: boolean;          // aftermarket_autograph
  rc: string | null;    // random_code
  nt: string | null;    // notes
  rk: boolean;          // is_rookie
  au: boolean;          // is_autograph
  rl: boolean;          // is_relic
  sh: boolean;          // is_short_print
  cl: string | null;    // color name
  cx: string | null;    // color hex
  se: string | null;    // series name
  sid: number;          // series_id
  sg: string;           // series slug
  st: string | null;    // set name
  stid: number;         // set_id
  yr: number | null;    // year
  cr: number;           // created (epoch seconds)
  pc: number;           // photo count
  pu: string | null;    // primary photo url
  pl: CompactPlayer[];  // players/teams
}

export interface LocationRow { user_location_id: number; location: string | null; card_count: number | null }
export interface AgencyRow { grading_agency_id: number; abbreviation: string | null; name: string | null }

export const UNASSIGNED = 0; // sentinel location id meaning "no location"

export function fullName(p: CompactPlayer): string {
  return [p.f, p.l].filter(Boolean).join(" ").trim();
}
export function money(n: number | null | undefined): string {
  const v = n ?? 0;
  // Over $100, cents are noise — show whole dollars; below, keep cents.
  const digits = Math.abs(v) >= 100 ? 0 : 2;
  return `$${v.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}
