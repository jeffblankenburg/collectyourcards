# Search design — replacing the legacy `*_indexed` hack with real Postgres search

## The problem with the old format
The legacy schema carried derived columns like `player.first_name_indexed`,
`set.name_indexed`, `card.card_number_indexed`, and `player.*_soundex`. These were
lowercased/normalized strings used for `LIKE '%term%'` matching — not full-text search.
They bloat the schema, must be kept in sync by app code, and still can't do ranking,
multi-word, or typo tolerance well.

**The migration preserved all the RAW text** (`first_name`, `last_name`, `name`,
`card_number`, `notes`, …), so we can build proper search on top and **drop every
`*_indexed` / `*_soundex` column** in the app schema.

## Recommended approach (two complementary tools)

### 1. `pg_trgm` — the workhorse for entity-name search (autocomplete, fuzzy, typo-tolerant)
Best for player/team/set/series names and card numbers, where users type partial or
misspelled terms. **Proven on the migrated data:**

```
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_player_name_trgm ON player
  USING gin ((lower(coalesce(first_name,'')||' '||coalesce(last_name,''))) gin_trgm_ops);

-- typo-tolerant, ranked:
SELECT first_name, last_name,
       similarity(lower(first_name||' '||last_name), $1) AS sim
  FROM player
 WHERE lower(first_name||' '||last_name) % $1      -- % = "similar enough" (trgm threshold)
 ORDER BY sim DESC LIMIT 10;
```
Demonstrated results: `ken griffy jr → Ken Griffey Jr`, `shoei ohtani → Shohei Ohtani`,
`mike traut → Mike Trout`, `jeter → Derek Jeter`. GIN trigram indexes also accelerate
`ILIKE '%term%'`, so substring search stays fast at scale.

### 2. `tsvector` full-text — for multi-word / notes / combined documents
Best where word-level matching and ranking matter (card notes, or a combined
"card document" of player + team + set + series + card number). Use a **generated**
column so it stays in sync automatically — no app code, unlike the old `*_indexed`:

```
ALTER TABLE card ADD COLUMN search tsvector
  GENERATED ALWAYS AS (to_tsvector('simple', coalesce(card_number,'') || ' ' || coalesce(notes,''))) STORED;
CREATE INDEX ix_card_search ON card USING gin (search);

SELECT * FROM card WHERE search @@ websearch_to_tsquery('simple', $1);
```

### 3. Card search spans joins → a search-optimized projection
The high-value query ("find cards of <player> in <set>") spans
`card → card_player_team → player_team → player/team` and `card → series → set`.
At 1M+ cards, compute that once into a **materialized view** (or a maintained
denormalized column) carrying the combined searchable text + a trigram/tsvector index,
refreshed on a schedule or via triggers. This keeps the hot search path index-only
instead of joining four tables per query.

## Plan
- **P1 (migration):** ✅ raw text preserved; legacy `*_indexed`/`*_soundex` kept only as
  inert data in the `legacy` schema (not used).
- **P2 (app schema):** drop `*_indexed`/`*_soundex`; they don't belong in the new model.
- **P3 (catalog/search):** add `pg_trgm` indexes on entity names + a card-search
  materialized view with trigram/tsvector. Start trigram-first (covers autocomplete +
  fuzzy + substring); add tsvector where multi-word/notes search is needed.

Supabase supports `pg_trgm` and Postgres FTS natively — no extra service required until
(if ever) catalog scale justifies a dedicated search engine.
