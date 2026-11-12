// Shapes returned by the search/catalog RPCs (card_json, search_entities).

export interface CardPlayer {
  player_id: number;
  first_name: string | null;
  last_name: string | null;
  slug: string | null;
  team: {
    team_id: number;
    name: string | null;
    abbreviation: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;
}

export interface Card {
  card_id: number;
  card_number: string | null;
  is_rookie: boolean;
  is_autograph: boolean;
  is_relic: boolean;
  is_short_print: boolean;
  print_run: number | null;
  sort_order: number | null;
  notes: string | null;
  front_image_path: string | null;
  back_image_path: string | null;
  color: { name: string | null; hex: string | null } | null;
  series: { series_id: number; name: string | null; slug: string; is_parallel: boolean; print_run: string | null };
  set: { set_id: number; name: string | null; year: number | null; slug: string };
  players: CardPlayer[];
}

export interface SearchResults {
  players: {
    player_id: number; first_name: string | null; last_name: string | null;
    nick_name: string | null; slug: string; is_hof: boolean | null; card_count: number | null;
    teams: { team_id: number; abbreviation: string | null; primary_color: string | null; secondary_color: string | null }[];
  }[];
  teams: {
    team_id: number; name: string | null; city: string | null; abbreviation: string | null;
    primary_color: string | null; secondary_color: string | null;
    card_count: number | null; player_count: number | null; slug: string;
  }[];
  sets: { set_id: number; name: string | null; year: number | null; slug: string; card_count: number | null; series_count: number | null }[];
  series: {
    series_id: number; name: string | null; slug: string; card_count: number | null;
    is_parallel: boolean; print_run: string | null;
    set: { set_id: number; name: string | null; year: number | null; slug: string };
  }[];
  cards: Card[];
}

export function playerName(p: { first_name: string | null; last_name: string | null }): string {
  return [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
}
