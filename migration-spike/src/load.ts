import pg from "pg";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pgUrl, PG_SCHEMA, dataDir } from "./config.js";
import { TABLES, TableSpec } from "./tables.js";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function ddl(spec: TableSpec): string {
  const cols = spec.cols
    .map((c) => `  "${c.tgt}" ${c.pg}${c.tgt === spec.pk ? " PRIMARY KEY" : ""}`)
    .join(",\n");
  return `CREATE TABLE "${PG_SCHEMA}"."${spec.target}" (\n${cols}\n);`;
}

function fkDDL(spec: TableSpec): string[] {
  return spec.fks.map(
    (fk) =>
      `ALTER TABLE "${PG_SCHEMA}"."${spec.target}" ADD CONSTRAINT ` +
      `"fk_${spec.target}_${fk.col}" FOREIGN KEY ("${fk.col}") ` +
      `REFERENCES "${PG_SCHEMA}"."${fk.refTable}" ("${fk.refCol}") ` +
      `DEFERRABLE INITIALLY DEFERRED;`
  );
}

function normalize(v: any): any {
  if (v === undefined) return null;
  return v; // pg accepts ISO date strings, numbers, booleans, null directly
}

async function insertRows(client: pg.PoolClient, spec: TableSpec, rows: any[]): Promise<number> {
  if (rows.length === 0) return 0;
  const cols = spec.cols.map((c) => c.tgt);
  const quoted = cols.map((c) => `"${c}"`).join(", ");
  const target = `"${PG_SCHEMA}"."${spec.target}"`;
  let inserted = 0;
  for (const batch of chunk(rows, 500)) {
    const params: any[] = [];
    const tuples = batch.map((row, ri) => {
      const ph = cols.map((c, ci) => `$${ri * cols.length + ci + 1}`);
      cols.forEach((c) => params.push(normalize(row[c])));
      return `(${ph.join(",")})`;
    });
    await client.query(`INSERT INTO ${target} (${quoted}) VALUES ${tuples.join(",")}`, params);
    inserted += batch.length;
  }
  return inserted;
}

export async function load(): Promise<void> {
  if (!pgUrl) {
    throw new Error(
      "No Postgres target. Set SUPABASE_DB_URL (direct connection string) in migration-spike/.env"
    );
  }
  const pool = new pg.Pool({
    connectionString: pgUrl,
    ssl: /supabase|amazonaws|render|neon/i.test(pgUrl) ? { rejectUnauthorized: false } : undefined,
    max: 4,
  });
  const client = await pool.connect();
  const t0 = Date.now();
  try {
    console.log(`→ resetting schema "${PG_SCHEMA}" …`);
    await client.query(`DROP SCHEMA IF EXISTS "${PG_SCHEMA}" CASCADE;`);
    await client.query(`CREATE SCHEMA "${PG_SCHEMA}";`);

    console.log("→ creating tables …");
    for (const spec of TABLES) await client.query(ddl(spec));
    for (const spec of TABLES) for (const stmt of fkDDL(spec)) await client.query(stmt);

    console.log("→ loading (constraints deferred) …");
    await client.query("BEGIN");
    await client.query("SET CONSTRAINTS ALL DEFERRED");
    let total = 0;
    for (const spec of TABLES) {
      const file = resolve(dataDir, `${spec.target}.json`);
      const rows = JSON.parse(readFileSync(file, "utf8"));
      const tt = Date.now();
      const n = await insertRows(client, spec, rows);
      total += n;
      const secs = (Date.now() - tt) / 1000;
      const rate = secs > 0 ? Math.round(n / secs) : n;
      console.log(`  ${spec.target.padEnd(18)} ${String(n).padStart(7)} rows  (${rate}/s)`);
    }
    await client.query("COMMIT");

    // Preserve original ids but keep sequences sane if anything later relies on them.
    const secs = (Date.now() - t0) / 1000;
    console.log(`\n✓ load complete: ${total} rows in ${secs.toFixed(1)}s (${Math.round(total / secs)}/s overall)`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
