# Migration spike — Azure SQL → Supabase Postgres

Proves the migration premise (issue **#15 / P1.1**) on a small, **referentially-closed slice**
before any feature work. It picks one `set` and walks the full hierarchy:

```
set → series → card → card_player_team → player_team → player / team
                                              ↑ org / manufacturer / color (parents)
       card → user_card (the owner's collection rows for those cards) → app_user
```

…loads it into an isolated `spike` schema in Postgres, and verifies fidelity.

## What it validates
- Connectivity to the legacy Azure SQL DB.
- SQL Server → Postgres **type translation** (Money→numeric, Decimal, DateTime→timestamptz, NVarChar(Max)→text).
- **ID preservation** so foreign keys survive the move.
- The two **cyclic FKs** (`card.reference_user_card`, `player.display_card`) — kept as data, not enforced (the full ETL resolves them with a second pass).
- A **verification harness**: row-count parity, FK-orphan = 0, sampled field-level diff vs source, and collection (`user_card`) reconciliation.
- **Throughput** numbers to extrapolate the full ~50M-row load.

## Prerequisites
1. Legacy creds — already in repo-root `.env` (`LEGACY_SQL_SERVER_*`).
   > Your client IP must be allowed in the Azure SQL server firewall.
2. A Supabase project. Put its **direct** connection string in `migration-spike/.env`:
   ```
   cp .env.example .env   # then fill SUPABASE_DB_URL
   ```

## Run
```bash
cd migration-spike
npm install
npm run extract   # legacy → ./data/*.json   (needs only Azure creds)
npm run load      # ./data → Postgres "spike" schema   (needs SUPABASE_DB_URL)
npm run verify    # fidelity + reconciliation report
npm run spike     # all three in sequence
```

`extract` works on its own with just the Azure creds — useful for a first connectivity test.
Everything is defined once in `src/tables.ts` (DDL, SELECTs, and INSERTs are generated from it,
so they can't drift). The spike only ever touches the isolated `spike` schema; it drops and
recreates that schema on each load and never writes to the legacy DB.
