// Applies every db/app/*.sql (in filename order) over the Supabase DIRECT
// connection. Each file is idempotent, so this is safe to re-run — and MUST be
// re-run after any `migration/` run, which drops+recreates the public tables and
// cascades away these indexes/grants/policies.
//
//   npm run db:app
import { config as loadEnv } from "dotenv";
import { Client } from "pg";
import { readdirSync, readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(here, "..", ".env") });

const url = process.env.SUPABASE_DIRECT_CONNECTION_STRING;
if (!url) throw new Error("Missing SUPABASE_DIRECT_CONNECTION_STRING in .env");

const dir = join(here, "app");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

(async () => {
  const client = new Client({
    connectionString: url,
    ssl: /supabase|amazonaws|pooler/i.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  const t0 = Date.now();
  await client.connect();
  try {
    for (const f of files) {
      const sql = readFileSync(join(dir, f), "utf8");
      process.stdout.write(`→ ${f} … `);
      const tt = Date.now();
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("commit");
        console.log(`ok (${((Date.now() - tt) / 1000).toFixed(1)}s)`);
      } catch (e) {
        await client.query("rollback");
        throw new Error(`failed in ${f}: ${(e as Error).message}`);
      }
    }
    console.log(`\n✓ db:app applied ${files.length} files in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    await client.end();
  }
})().catch((e) => { console.error("\n💥 " + (e as Error).message); process.exit(1); });
