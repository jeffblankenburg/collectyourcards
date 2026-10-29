import { config as loadEnv } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const here = dirname(fileURLToPath(import.meta.url)); // migration-spike/src
const repoRoot = resolve(here, "../..");
const spikeRoot = resolve(here, "..");

// Repo-root .env holds the LEGACY_SQL_SERVER_* creds the user added.
loadEnv({ path: resolve(repoRoot, ".env") });
// Local migration-spike/.env can hold the Supabase target (optional override).
loadEnv({ path: resolve(spikeRoot, ".env") });

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
  options: {
    encrypt: true,
    trustServerCertificate: false,
    enableArithAbort: true,
  },
  // tedious returns BIGINT as string by default if it can't fit a JS number;
  // our slice ids are small, but parseJSON keeps things safe.
  pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  requestTimeout: 120000,
  connectionTimeout: 30000,
};

// Postgres (Supabase) target. Use the DIRECT connection string for the spike
// (DDL + bulk load). Set SUPABASE_DB_URL in migration-spike/.env.
export const pgUrl =
  process.env.SUPABASE_DIRECT_CONNECTION_STRING ??
  process.env.SUPABASE_DB_URL ??
  process.env.DATABASE_URL ??
  "";

// Isolated schema so the spike never touches anything else in the database.
export const PG_SCHEMA = process.env.SPIKE_SCHEMA ?? "spike";

// Optional: pin a specific set to migrate. If unset, the spike auto-picks the
// smallest non-empty set (fastest meaningful slice).
export const setIdOverride = process.env.SPIKE_SET_ID
  ? Number(process.env.SPIKE_SET_ID)
  : undefined;

export const dataDir = resolve(spikeRoot, "data");
