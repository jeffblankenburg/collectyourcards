# db/app — application database objects

Indexes, grants, RLS policies, the `profiles` identity bridge, and the search/
collection RPCs that the Next.js app depends on. Separate from `migration/`
(the one-time Azure → Supabase catalog loader).

## Apply

```bash
npm run db:app   # runs db/app/*.sql in order over SUPABASE_DIRECT_CONNECTION_STRING
```

Every file is idempotent, so this is safe to re-run.

## ⚠️ Ordering hazard

`migration/` drops and recreates every `public` table on `npm run migrate`, which
**cascades away all of these indexes/grants/policies** (and would wipe app-created
collections). Rules:

- Before launch, if you ever re-run `migration/`, immediately re-run `npm run db:app`.
- After launch, treat `migration/` as decommissioned — re-running it destroys user data.

## Files
- `001_extensions.sql` — pg_trgm, unaccent
- `002_indexes.sql` — FK-child B-trees + trigram GIN (search/collection hot paths)
- `003_grants.sql` — anon/authenticated privileges (PostgREST visibility)
- `004_profiles.sql` — auth.users(uuid) ↔ collector_id(bigint) bridge, signup trigger,
  `current_collector_id()`. **Set the owner phone placeholder here.**
- `005_rls.sql` — catalog public-read; user_card/user_location/profiles owner-only
- `006_rpc_search.sql` — `search_entities`, `card_json`, `card_search`, `collection_list`, `collection_totals`
