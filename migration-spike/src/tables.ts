// Single source of truth for the spike's table specs.
// DDL, extract SELECT lists, and load INSERT lists are all generated from here,
// so they can never drift apart.
//
// Notes:
//  - PKs preserve the ORIGINAL identity values from SQL Server (no new sequences),
//    so foreign keys stay intact across the slice and across re-runs.
//  - Two CYCLIC FKs are intentionally NOT enforced in the spike (kept as plain
//    nullable columns so the data is preserved): card.reference_user_card -> user_card
//    and player.display_card -> card. The production migration (P1.3) resolves these
//    with a second-pass UPDATE.
//  - SQL Server type -> Postgres: bit->boolean, datetime->timestamptz, date->date,
//    nvarchar(max)->text, nvarchar(n)->varchar(n), money->numeric(19,4),
//    decimal(18,0)->numeric(18,0), int->integer, bigint->bigint.

export interface ColSpec {
  src: string; // SQL Server column name
  tgt: string; // Postgres column name
  pg: string;  // Postgres type
}
export interface FkSpec {
  col: string;        // local target column
  refTable: string;   // referenced target table
  refCol: string;     // referenced target column
}
export interface TableSpec {
  source: string;       // SQL Server table name
  target: string;       // Postgres table name
  pk: string;           // target PK column
  cols: ColSpec[];
  fks: FkSpec[];
}

const c = (name: string, pg: string): ColSpec => ({ src: name, tgt: name, pg });

// Ordered PARENT-FIRST so load order satisfies FKs (constraints are also DEFERRED).
export const TABLES: TableSpec[] = [
  {
    source: "organization", target: "organization", pk: "organization_id",
    cols: [
      c("organization_id", "integer"), c("name", "text"), c("abbreviation", "text"),
      c("created", "timestamptz"), c("sport", "varchar(255)"),
    ],
    fks: [],
  },
  {
    source: "manufacturer", target: "manufacturer", pk: "manufacturer_id",
    cols: [
      c("manufacturer_id", "integer"), c("name", "text"),
      c("created", "timestamptz"), c("name_indexed", "varchar(255)"),
    ],
    fks: [],
  },
  {
    source: "color", target: "color", pk: "color_id",
    cols: [
      c("color_id", "integer"), c("name", "text"), c("hex_value", "text"),
      c("created", "timestamptz"), c("name_indexed", "varchar(100)"),
    ],
    fks: [],
  },
  {
    source: "team", target: "team", pk: "team_id",
    cols: [
      { src: "team_Id", tgt: "team_id", pg: "integer" },
      c("name", "text"), c("city", "text"), c("mascot", "text"), c("abbreviation", "text"),
      c("organization", "integer"), c("created", "timestamptz"),
      c("primary_color", "text"), c("secondary_color", "text"),
      c("card_count", "integer"), c("player_count", "integer"),
      c("name_indexed", "varchar(255)"), c("abbreviation_indexed", "varchar(50)"),
      c("city_indexed", "varchar(255)"), c("mascot_indexed", "varchar(255)"),
      c("slug", "varchar(255)"),
    ],
    fks: [{ col: "organization", refTable: "organization", refCol: "organization_id" }],
  },
  {
    source: "set", target: "set", pk: "set_id",
    cols: [
      c("set_id", "integer"), c("name", "text"), c("year", "integer"),
      c("organization", "integer"), c("manufacturer", "integer"),
      c("created", "timestamptz"), c("card_count", "integer"), c("series_count", "integer"),
      c("is_complete", "boolean"), c("thumbnail", "text"),
      c("name_indexed", "varchar(450)"), c("slug", "varchar(255)"),
    ],
    fks: [
      { col: "organization", refTable: "organization", refCol: "organization_id" },
      { col: "manufacturer", refTable: "manufacturer", refCol: "manufacturer_id" },
    ],
  },
  {
    source: "series", target: "series", pk: "series_id",
    cols: [
      c("series_id", "bigint"), c("name", "text"), c("set", "integer"),
      c("card_count", "integer"), c("created", "timestamptz"), c("is_base", "boolean"),
      c("parallel_of_series", "bigint"), c("front_image_path", "text"), c("back_image_path", "text"),
      c("min_print_run", "integer"), c("max_print_run", "integer"),
      c("print_run_display", "varchar(50)"), c("rookie_count", "integer"),
      c("color", "integer"), c("name_indexed", "varchar(450)"), c("slug", "varchar(255)"),
    ],
    fks: [
      { col: "set", refTable: "set", refCol: "set_id" },
      { col: "color", refTable: "color", refCol: "color_id" },
    ],
  },
  {
    source: "card", target: "card", pk: "card_id",
    cols: [
      c("card_id", "bigint"), c("sort_order", "integer"), c("card_number", "text"),
      c("is_rookie", "boolean"), c("is_autograph", "boolean"), c("is_relic", "boolean"),
      c("print_run", "integer"), c("series", "bigint"), c("color", "integer"),
      c("notes", "text"), c("created", "timestamptz"), c("card_number_indexed", "varchar(100)"),
      c("reference_user_card", "bigint"), c("is_short_print", "boolean"),
      c("front_image_path", "text"), c("back_image_path", "text"),
    ],
    fks: [
      { col: "series", refTable: "series", refCol: "series_id" },
      { col: "color", refTable: "color", refCol: "color_id" },
      // reference_user_card -> user_card : CYCLIC, not enforced in spike
    ],
  },
  {
    source: "player", target: "player", pk: "player_id",
    cols: [
      c("player_id", "bigint"), c("first_name", "text"), c("last_name", "text"),
      c("nick_name", "text"), c("birthdate", "timestamptz"), c("created", "timestamptz"),
      c("is_hof", "boolean"), c("card_count", "integer"),
      c("first_name_indexed", "varchar(255)"), c("last_name_indexed", "varchar(255)"),
      c("nick_name_indexed", "varchar(255)"), c("slug", "varchar(255)"),
      c("display_card", "bigint"),
    ],
    fks: [], // display_card -> card : CYCLIC, not enforced in spike
  },
  {
    source: "player_team", target: "player_team", pk: "player_team_id",
    cols: [
      c("player_team_id", "bigint"), c("player", "bigint"), c("team", "integer"),
      c("created", "timestamptz"), c("card_count", "integer"),
    ],
    fks: [
      { col: "player", refTable: "player", refCol: "player_id" },
      { col: "team", refTable: "team", refCol: "team_id" },
    ],
  },
  {
    source: "card_player_team", target: "card_player_team", pk: "card_player_team_id",
    cols: [
      c("card_player_team_id", "bigint"), c("card", "bigint"),
      c("player_team", "bigint"), c("created", "timestamptz"),
    ],
    fks: [
      { col: "card", refTable: "card", refCol: "card_id" },
      { col: "player_team", refTable: "player_team", refCol: "player_team_id" },
    ],
  },
  {
    source: "user", target: "app_user", pk: "user_id",
    cols: [
      c("user_id", "bigint"), c("name", "text"), c("email", "varchar(255)"),
      c("created", "timestamptz"), c("first_name", "varchar(100)"), c("last_name", "varchar(100)"),
      c("is_active", "boolean"), c("is_verified", "boolean"), c("role", "varchar(50)"),
      c("username", "varchar(50)"), c("password_hash", "varchar(500)"),
      c("bio", "varchar(500)"), c("avatar_url", "varchar(500)"), c("is_public_profile", "boolean"),
    ],
    fks: [],
  },
  {
    source: "user_card", target: "user_card", pk: "user_card_id",
    cols: [
      c("user_card_id", "bigint"), c("user", "bigint"), c("card", "bigint"),
      c("serial_number", "integer"),
      c("purchase_price", "numeric(19,4)"), c("estimated_value", "numeric(19,4)"),
      c("current_value", "numeric(19,4)"), c("photo", "text"), c("notes", "text"),
      c("card_variation", "bigint"), c("grading_agency", "integer"),
      c("grade", "numeric(18,0)"), c("grade_id", "bigint"),
      c("aftermarket_autograph", "boolean"), c("is_for_sale", "boolean"),
      c("is_wanted", "boolean"), c("is_special", "boolean"), c("is_labeled", "boolean"),
      c("user_location", "bigint"), c("random_code", "text"), c("created", "timestamptz"),
      c("ebay_purchase_id", "bigint"), c("sale_id", "bigint"), c("sold_at", "timestamptz"),
    ],
    fks: [
      { col: "card", refTable: "card", refCol: "card_id" },
      { col: "user", refTable: "app_user", refCol: "user_id" },
      // card_variation / grading_agency / user_location / ebay_purchase_id / sale_id:
      // reference tables outside this spike slice -> kept as data, not enforced.
    ],
  },
];

export const byTarget = (t: string): TableSpec => {
  const s = TABLES.find((x) => x.target === t);
  if (!s) throw new Error(`no spec for target ${t}`);
  return s;
};
