// Declarative transform layer: the single source of truth for how the faithful
// SQL Server introspection is reshaped into the clean Postgres schema.
//
// Everything here is pure (no I/O). ddl.ts, migrate.ts, audit.ts and verify.ts
// all resolve column names / types / constraints through a Resolver built from a
// Catalog, so the rename logic lives in exactly one place.
import { Catalog, Column, ForeignKey, Table } from "./catalog.js";

// ---------------------------------------------------------------------------
// Spec: explicit overrides, drops, type overrides, added constraints.
// ---------------------------------------------------------------------------

// Postgres reserved words that could plausibly appear as column names here.
// Any resolved target landing in this set without an explicit override is a
// build-time error (caught by validateTransform).
const RESERVED = new Set([
  "user", "set", "order", "check", "column", "default", "desc", "asc", "group",
  "references", "grant", "table", "select", "where", "from", "to", "end",
  "offset", "limit", "primary", "foreign", "unique", "constraint", "index",
  "and", "or", "not", "null", "as", "on", "in", "all", "any", "case", "when",
  "then", "else", "having", "join", "left", "right", "inner", "outer", "using",
]);

// Explicit column renames, keyed "table.column" -> newName. These are cases the
// FK-derivation rule can't handle (self-refs, misleading parent names, casing).
export const RENAMES: Record<string, string> = {
  "team.team_Id": "team_id", // casing only
  "card.reference_user_card": "reference_user_card_id", // FK->user_card, but it's a *reference* card, not ownership
  "player.display_card": "display_card_id", // FK->card, but it's the display card
  "user.muted_by": "muted_by_id", // self-ref FK->user; bare rule would collide with PK user_id
  "series.parallel_of_series": "parallel_of_series_id", // self-ref-ish
  "user_location.user": "user_id", // reserved-word column, no FK in source — rename for hygiene
  // Bare entity columns that SHOULD be FKs but have no FK constraint in the source
  // (so the FK-driven rule doesn't fire). Renamed for consistency; FKs added via
  // SYNTHETIC_FKS below.
  "card.series": "series_id",
  "user_list_card.card": "card_id",
  "user_list_card.user_list": "user_list_id",
};

// Foreign keys that are MISSING in the source but belong in a clean schema. Added
// after load (like real FKs), gated the same way. Columns are SOURCE names.
export interface SyntheticFk {
  id: string;
  childTable: string;
  childCols: string[];
  parentTable: string;
  parentCols: string[];
  gate: Gate;
}
export const SYNTHETIC_FKS: SyntheticFk[] = [
  // Catalog backbone — unconstrained in source; 725 cards pointed at deleted series
  // #217 (recreated via fixes.ts) and 22 nulls (deleted). Gated on a decision.
  { id: "FK.card.series", childTable: "card", childCols: ["series"], parentTable: "series", parentCols: ["series_id"], gate: "gated" },
  // user_list_card join table — verified orphan-free, so enforced clean.
  { id: "FK.user_list_card.user_list", childTable: "user_list_card", childCols: ["user_list"], parentTable: "user_list", parentCols: ["user_list_id"], gate: "clean" },
  { id: "FK.user_list_card.card", childTable: "user_list_card", childCols: ["card"], parentTable: "card", parentCols: ["card_id"], gate: "clean" },
];

// Columns to drop beyond computed columns (which are auto-dropped). Keyed "table.column".
export const DROP_COLUMNS = new Set<string>([
  // (none extra today — the 16 computed search columns drop automatically)
]);

// Postgres type overrides, keyed "table.column" -> pg type. Overrides ddl.pgType.
export const TYPE_OVERRIDES: Record<string, string> = {
  "user_card.grade": "numeric(4,1)", // was decimal(18,0) — lossless for whole 2..10, future half-grade capacity
  "player.birthdate": "date", // was datetime — birthdays have no time component
};

// All `money` columns map to numeric(12,2) (cards don't exceed ~10 digits).
// The audit proves fit before migrate; overflow would fail the COPY loudly.
export const MONEY_PG_TYPE = "numeric(12,2)";

export type Gate = "clean" | "gated";

export interface AddConstraint {
  id: string; // stable finding id, e.g. "UNIQUE.series.slug"
  kind: "unique" | "notnull";
  table: string;
  columns: string[]; // SOURCE column names (resolved to target at emit time)
  gate: Gate; // clean = always enforce; gated = only if decisions.json says so
}

// Constraints we add on top of the source schema.
export const ADDED_CONSTRAINTS: AddConstraint[] = [
  // Spine FKs that are already clean (0 nulls in source) -> enforce NOT NULL.
  { id: "NOTNULL.card_player_team.card", kind: "notnull", table: "card_player_team", columns: ["card"], gate: "clean" },
  { id: "NOTNULL.card_player_team.player_team", kind: "notnull", table: "card_player_team", columns: ["player_team"], gate: "clean" },
  { id: "NOTNULL.user_card.user", kind: "notnull", table: "user_card", columns: ["user"], gate: "clean" },
  { id: "NOTNULL.user_card.card", kind: "notnull", table: "user_card", columns: ["card"], gate: "clean" },
  { id: "NOTNULL.series.set", kind: "notnull", table: "series", columns: ["set"], gate: "clean" },
  { id: "NOTNULL.player_team.player", kind: "notnull", table: "player_team", columns: ["player"], gate: "clean" },
  { id: "NOTNULL.player_team.team", kind: "notnull", table: "player_team", columns: ["team"], gate: "clean" },
  // Slugs are URL keys -> UNIQUE. player/set/team are clean; series has 70 dups.
  { id: "UNIQUE.player.slug", kind: "unique", table: "player", columns: ["slug"], gate: "clean" },
  { id: "UNIQUE.set.slug", kind: "unique", table: "set", columns: ["slug"], gate: "clean" },
  { id: "UNIQUE.team.slug", kind: "unique", table: "team", columns: ["slug"], gate: "clean" },
  { id: "UNIQUE.series.slug", kind: "unique", table: "series", columns: ["slug"], gate: "gated" },
  // 22 cards have no series -> gated NOT NULL.
  { id: "NOTNULL.card.series", kind: "notnull", table: "card", columns: ["series"], gate: "gated" },
];

// ---------------------------------------------------------------------------
// Resolver: built once per Catalog, used everywhere.
// ---------------------------------------------------------------------------

export interface ColPlanEntry {
  sourceName: string; // key into the mssql row object; [bracketed] in the SELECT
  targetName: string; // "quoted" in the COPY column list / DDL
  sqlType: string;
  col: Column;
}

export interface Resolver {
  /** Target column name (post-rename). Throws if the column is dropped. */
  target(table: string, col: string): string;
  /** True if the column is dropped from the target (computed or in DROP_COLUMNS). */
  isDropped(table: string, col: string): boolean;
  /** Ordered, drop-filtered column plan for a table (by ordinal). */
  colPlan(t: Table): ColPlanEntry[];
  /** Postgres type for a column, honoring overrides + money rule. */
  pgTypeFor(table: string, col: Column): string | null; // null => use ddl.pgType default
}

function key(table: string, col: string): string {
  return `${table}.${col}`;
}

// Per-table map of single-column FK child col -> parent table (for rename derivation).
function fkParentByChildCol(t: Table): Map<string, string> {
  const m = new Map<string, string>();
  for (const fk of t.fks) {
    if (fk.childCols.length === 1) m.set(fk.childCols[0], fk.parentTable);
  }
  return m;
}

// The core single-column rename derivation (no collision checking — that's the validator's job).
function deriveTarget(table: string, col: string, fkParent: Map<string, string>): string {
  const explicit = RENAMES[key(table, col)];
  if (explicit) return explicit;
  // FK-derived: only rename a *bare* FK column — one named exactly after its parent
  // entity (e.g. `card`, `series`, `user`) -> `<parentTable>_id`. Descriptive FK
  // columns (reviewed_by, resolved_by, card_id_1, matched_card_id, …) are left alone.
  const parent = fkParent.get(col);
  if (parent && col === parent) return `${parent}_id`;
  return col;
}

export function buildResolver(cat: Catalog): Resolver {
  const fkParentCache = new Map<string, Map<string, string>>();
  const getFkParent = (t: Table) => {
    let m = fkParentCache.get(t.name);
    if (!m) { m = fkParentByChildCol(t); fkParentCache.set(t.name, m); }
    return m;
  };

  const isDropped = (table: string, colName: string): boolean => {
    const t = cat.tables.get(table);
    const col = t?.columns.find((c) => c.name === colName);
    if (col?.isComputed) return true;
    return DROP_COLUMNS.has(key(table, colName));
  };

  const target = (table: string, colName: string): string => {
    if (isDropped(table, colName)) {
      throw new Error(`transform: column ${key(table, colName)} is dropped; no target name`);
    }
    const t = cat.tables.get(table);
    if (!t) throw new Error(`transform: unknown table ${table}`);
    return deriveTarget(table, colName, getFkParent(t));
  };

  const pgTypeFor = (table: string, col: Column): string | null => {
    const o = TYPE_OVERRIDES[key(table, col.name)];
    if (o) return o;
    if (col.sqlType === "money" || col.sqlType === "smallmoney") return MONEY_PG_TYPE;
    return null;
  };

  const colPlan = (t: Table): ColPlanEntry[] =>
    [...t.columns]
      .sort((a, b) => a.ordinal - b.ordinal)
      .filter((c) => !isDropped(t.name, c.name))
      .map((c) => ({ sourceName: c.name, targetName: target(t.name, c.name), sqlType: c.sqlType, col: c }));

  return { target, isDropped, colPlan, pgTypeFor };
}

// ---------------------------------------------------------------------------
// Build-time validator: catch every unresolved collision / reserved word before
// a single row is touched. Throws with a full list on any problem.
// ---------------------------------------------------------------------------
export function validateTransform(cat: Catalog): { renames: string[]; drops: string[]; typeOverrides: string[] } {
  const r = buildResolver(cat);
  const problems: string[] = [];
  const renames: string[] = [];
  const drops: string[] = [];
  const typeOverrides: string[] = [];

  for (const t of cat.tables.values()) {
    const seen = new Map<string, string>(); // targetName -> sourceName (collision detection)
    for (const c of t.columns) {
      if (r.isDropped(t.name, c.name)) { drops.push(`${t.name}.${c.name}`); continue; }
      const tgt = r.target(t.name, c.name);
      if (tgt !== c.name) renames.push(`${t.name}.${c.name} -> ${tgt}`);
      const ov = r.pgTypeFor(t.name, c);
      if (ov) typeOverrides.push(`${t.name}.${c.name} :: ${ov}`);
      // Collision: two source cols mapping to the same target.
      if (seen.has(tgt)) problems.push(`COLLISION ${t.name}: "${seen.get(tgt)}" and "${c.name}" both -> "${tgt}"`);
      seen.set(tgt, c.name);
      // Reserved-word residue.
      if (RESERVED.has(tgt.toLowerCase())) {
        problems.push(`RESERVED ${t.name}.${c.name} -> "${tgt}" is a reserved word; add an explicit RENAMES entry`);
      }
    }
  }

  // Validate ADDED_CONSTRAINTS reference real columns.
  for (const ac of ADDED_CONSTRAINTS) {
    const t = cat.tables.get(ac.table);
    if (!t) { problems.push(`CONSTRAINT ${ac.id}: unknown table ${ac.table}`); continue; }
    for (const col of ac.columns) {
      if (!t.columns.find((c) => c.name === col)) problems.push(`CONSTRAINT ${ac.id}: unknown column ${ac.table}.${col}`);
    }
  }

  // Validate SYNTHETIC_FKS reference real tables/columns on both sides.
  for (const fk of SYNTHETIC_FKS) {
    const ct = cat.tables.get(fk.childTable), pt = cat.tables.get(fk.parentTable);
    if (!ct) { problems.push(`SYNTHETIC_FK ${fk.id}: unknown child table ${fk.childTable}`); continue; }
    if (!pt) { problems.push(`SYNTHETIC_FK ${fk.id}: unknown parent table ${fk.parentTable}`); continue; }
    for (const c of fk.childCols) if (!ct.columns.find((x) => x.name === c)) problems.push(`SYNTHETIC_FK ${fk.id}: unknown child column ${fk.childTable}.${c}`);
    for (const c of fk.parentCols) if (!pt.columns.find((x) => x.name === c)) problems.push(`SYNTHETIC_FK ${fk.id}: unknown parent column ${fk.parentTable}.${c}`);
  }

  if (problems.length) {
    throw new Error(`transform validation failed (${problems.length}):\n  ` + problems.join("\n  "));
  }
  return {
    renames: renames.sort(),
    drops: drops.sort(),
    typeOverrides: typeOverrides.sort(),
  };
}

// Resolve an FK's child + parent columns to their target names (used by ddl.addFkSql).
export function resolveFk(r: Resolver, fk: ForeignKey): { childCols: string[]; parentCols: string[] } {
  return {
    childCols: fk.childCols.map((c) => r.target(fk.childTable, c)),
    parentCols: fk.parentCols.map((c) => r.target(fk.parentTable, c)),
  };
}
