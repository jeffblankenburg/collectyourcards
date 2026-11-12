// Idempotent, Postgres-side data fixes keyed to audit finding IDs. A fix runs
// during migrate's fix phase ONLY when decisions.json selects decision:"fix" for
// that id. Every statement is guarded so re-running is a no-op. Fixes target the
// loaded Postgres schema — never the Azure source.
import { qt } from "./ddl.js";

export const FIXES: Record<string, () => string[]> = {
  // De-dup series slugs: append "-<series_id>" to every row whose slug is shared.
  // Idempotent — after one pass all slugs are unique, so the EXISTS guard is empty.
  "UNIQUE.series.slug": () => [
    `UPDATE ${qt("series")} x
        SET "slug" = x."slug" || '-' || x."series_id"::text
      WHERE EXISTS (
        SELECT 1 FROM ${qt("series")} y
         WHERE y."slug" = x."slug" AND y."series_id" <> x."series_id"
      );`,
  ],

  // card.series NOT NULL: delete the orphan cards that have no series. These were
  // verified (audit) to have no player/team links and no owned copies — accidental
  // double-entry of incomplete inserts. Idempotent: re-running deletes nothing.
  // verify.ts accounts for this intentional row delta in count parity.
  "NOTNULL.card.series": () => [
    `DELETE FROM ${qt("card")} WHERE "series_id" IS NULL;`,
  ],

  // card.series FK: 725 cards point to deleted series #217. Recreate #217 as a
  // recovery placeholder (plus a placeholder set to satisfy series.set_id NOT NULL)
  // so those real cards keep a valid parent and the FK can be enforced. Idempotent:
  // guarded by NOT EXISTS on stable slugs / the #217 id.
  "FK.card.series": () => [
    // Explicit set_id = MAX+1: the identity sequence isn't reset until after fixes,
    // so letting it auto-generate would collide with an already-loaded id.
    `INSERT INTO ${qt("set")} ("set_id", "name", "created", "slug")
     SELECT (SELECT COALESCE(MAX("set_id"), 0) + 1 FROM ${qt("set")}),
            '[Recovered] placeholder set', now(), 'recovered-set-placeholder'
      WHERE NOT EXISTS (SELECT 1 FROM ${qt("set")} WHERE "slug" = 'recovered-set-placeholder');`,
    `INSERT INTO ${qt("series")} ("series_id", "name", "set_id", "card_count", "created", "slug")
     SELECT 217, '[Recovered] orphaned series #217',
            (SELECT "set_id" FROM ${qt("set")} WHERE "slug" = 'recovered-set-placeholder'),
            0, now(), 'recovered-series-217'
      WHERE NOT EXISTS (SELECT 1 FROM ${qt("series")} WHERE "series_id" = 217);`,
  ],
};
