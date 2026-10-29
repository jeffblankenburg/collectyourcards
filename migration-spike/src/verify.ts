import pg from "pg";
import sql from "mssql";
import { readFileSync } from "fs";
import { resolve } from "path";
import { pgUrl, PG_SCHEMA, dataDir, azureConfig } from "./config.js";
import { TABLES, byTarget, TableSpec } from "./tables.js";

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  ✗ ${msg}`); };
const ok = (msg: string) => console.log(`  ✓ ${msg}`);

async function countParity(client: pg.PoolClient) {
  console.log("\n[1] Row-count parity (extracted JSON vs Postgres):");
  for (const spec of TABLES) {
    const rows = JSON.parse(readFileSync(resolve(dataDir, `${spec.target}.json`), "utf8"));
    const r = await client.query(`SELECT count(*)::int AS n FROM "${PG_SCHEMA}"."${spec.target}"`);
    const pgN = r.rows[0].n;
    if (pgN === rows.length) ok(`${spec.target.padEnd(18)} ${pgN}`);
    else fail(`${spec.target.padEnd(18)} expected ${rows.length}, got ${pgN}`);
  }
}

async function fkIntegrity(client: pg.PoolClient) {
  console.log("\n[2] FK integrity (orphan rows must be 0):");
  for (const spec of TABLES) {
    for (const fk of spec.fks) {
      const q = `
        SELECT count(*)::int AS n
          FROM "${PG_SCHEMA}"."${spec.target}" c
          LEFT JOIN "${PG_SCHEMA}"."${fk.refTable}" p ON c."${fk.col}" = p."${fk.refCol}"
         WHERE c."${fk.col}" IS NOT NULL AND p."${fk.refCol}" IS NULL`;
      const n = (await client.query(q)).rows[0].n;
      const label = `${spec.target}.${fk.col} -> ${fk.refTable}.${fk.refCol}`;
      if (n === 0) ok(label);
      else fail(`${label}: ${n} orphans`);
    }
  }
}

// Re-read sampled cards from Azure and deep-compare against Postgres.
async function sampledDiff(client: pg.PoolClient) {
  console.log("\n[3] Sampled field-level diff (card, up to 10):");
  const cards = JSON.parse(readFileSync(resolve(dataDir, "card.json"), "utf8"));
  if (!cards.length) { ok("no cards in slice"); return; }
  const sample = cards.slice(0, 10);
  const ids = sample.map((c: any) => c.card_id);
  const spec = byTarget("card");

  const pool = await sql.connect(azureConfig as any);
  try {
    const reqst = pool.request();
    const ph = ids.map((v: any, i: number) => { reqst.input(`p${i}`, v); return `@p${i}`; });
    const colList = spec.cols.map((c) => `[${c.src}]`).join(", ");
    const src = (await reqst.query(
      `SELECT ${colList} FROM [card] WHERE [card_id] IN (${ph.join(",")})`
    )).recordset;
    const srcById = new Map(src.map((r: any) => [String(r.card_id), r]));

    const pgRows = (await client.query(
      `SELECT * FROM "${PG_SCHEMA}"."card" WHERE card_id = ANY($1::bigint[])`,
      [ids]
    )).rows;
    const pgById = new Map(pgRows.map((r: any) => [String(r.card_id), r]));

    let clean = 0;
    for (const id of ids) {
      const s = srcById.get(String(id));
      const p = pgById.get(String(id));
      if (!s || !p) { fail(`card ${id} missing on one side`); continue; }
      const diffs: string[] = [];
      for (const col of spec.cols) {
        const a = norm(s[col.src]);
        const b = norm(p[col.tgt]);
        if (a !== b) diffs.push(`${col.tgt}: "${a}" != "${b}"`);
      }
      if (diffs.length) fail(`card ${id}: ${diffs.join("; ")}`);
      else clean++;
    }
    if (clean === ids.length) ok(`all ${clean} sampled cards match field-for-field`);
  } finally {
    await pool.close();
  }
}

// Normalize values for cross-engine comparison (dates -> ISO, trim, null -> "").
function norm(v: any): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string") {
    const d = Date.parse(v);
    // Leave plain strings alone; only canonicalize ISO-ish timestamps.
    if (/^\d{4}-\d{2}-\d{2}[T ]/.test(v) && !isNaN(d)) return new Date(d).toISOString();
    return v.trim();
  }
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
}

async function collectionReconcile(client: pg.PoolClient) {
  console.log("\n[4] Collection reconciliation (user_card):");
  const rows = JSON.parse(readFileSync(resolve(dataDir, "user_card.json"), "utf8"));
  const r = await client.query(
    `SELECT count(*)::int AS n,
            COALESCE(sum(current_value),0)::numeric AS cv,
            COALESCE(sum(purchase_price),0)::numeric AS pp
       FROM "${PG_SCHEMA}"."user_card"`
  );
  const jsonCv = rows.reduce((a: number, x: any) => a + Number(x.current_value ?? 0), 0);
  const jsonPp = rows.reduce((a: number, x: any) => a + Number(x.purchase_price ?? 0), 0);
  const pgCv = Number(r.rows[0].cv), pgPp = Number(r.rows[0].pp);
  if (r.rows[0].n === rows.length) ok(`count ${r.rows[0].n}`);
  else fail(`count expected ${rows.length}, got ${r.rows[0].n}`);
  const close = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (close(jsonCv, pgCv)) ok(`sum(current_value) = ${pgCv.toFixed(2)}`);
  else fail(`sum(current_value) expected ${jsonCv.toFixed(2)}, got ${pgCv.toFixed(2)}`);
  if (close(jsonPp, pgPp)) ok(`sum(purchase_price) = ${pgPp.toFixed(2)}`);
  else fail(`sum(purchase_price) expected ${jsonPp.toFixed(2)}, got ${pgPp.toFixed(2)}`);
}

export async function verify(): Promise<void> {
  if (!pgUrl) throw new Error("No Postgres target. Set SUPABASE_DB_URL in migration-spike/.env");
  const pool = new pg.Pool({
    connectionString: pgUrl,
    ssl: /supabase|amazonaws|render|neon/i.test(pgUrl) ? { rejectUnauthorized: false } : undefined,
  });
  const client = await pool.connect();
  failures = 0;
  try {
    await countParity(client);
    await fkIntegrity(client);
    await sampledDiff(client);
    await collectionReconcile(client);
    console.log(
      failures === 0
        ? "\n✅ VERIFY PASSED — slice migrated with full fidelity."
        : `\n❌ VERIFY FAILED — ${failures} check(s) failed (see above).`
    );
    if (failures > 0) process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}
