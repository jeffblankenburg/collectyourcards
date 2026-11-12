import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url)); // migration/src
const repoRoot = resolve(here, "../..");
const localRoot = resolve(here, "..");

loadEnv({ path: resolve(repoRoot, ".env") });     // LEGACY_SQL_SERVER_* + SUPABASE_*
loadEnv({ path: resolve(localRoot, ".env") });    // optional overrides

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const azureConfig = {
  server: req("LEGACY_SQL_SERVER_ADDRESS"),
  database: req("LEGACY_SQL_SERVER_DATABASE"),
  port: Number(process.env.LEGACY_SQL_SERVER_PORT ?? 1433),
  user: req("LEGACY_SQL_SERVER_USERNAME"),
  password: req("LEGACY_SQL_SERVER_PASSWORD"),
  options: { encrypt: true, trustServerCertificate: false, enableArithAbort: true },
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 600000,
  connectionTimeout: 30000,
};

export const pgUrl =
  process.env.SUPABASE_DIRECT_CONNECTION_STRING ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  "";

export function pgPoolConfig() {
  if (!pgUrl) throw new Error("No Postgres target (SUPABASE_DIRECT_CONNECTION_STRING).");
  return {
    connectionString: pgUrl,
    ssl: /supabase|amazonaws|render|neon/i.test(pgUrl) ? { rejectUnauthorized: false } : undefined,
  };
}

// Target schema for the migrated data. Kept separate from `public` so the app's
// future Prisma-managed schema and this raw import don't collide during cutover.
export const TARGET_SCHEMA = process.env.TARGET_SCHEMA ?? "legacy";

// Tables to SKIP (schema-trim decision, #16). Default: migrate EVERYTHING — the
// prime directive is data preservation. These are documented defer/drop candidates;
// uncomment to exclude. Operational/transient tables only.
export const SKIP_TABLES = new Set<string>([
  // Empty duplicate session tables: both 0 rows, and "userSession" collides with
  // "user_session" once snake-cased. Dropping loses no data (Supabase Auth owns
  // sessions going forward). The populated user_session (197 rows) is kept.
  "userSession",
  "user_session_new",
  // Other documented defer/drop candidates (keep migrating by default):
  // "staging_data",
  // "import_recovery_point",
  // "duplicate_detection_job",
  // "campaign_visit",
]);

export const dataDir = resolve(localRoot, "data");
