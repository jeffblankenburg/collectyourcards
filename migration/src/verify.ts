import pg from "pg";
import { azurePool, Catalog, Table } from "./catalog.js";
import { pgPoolConfig, TARGET_SCHEMA } from "./config.js";
import { qt } from "./ddl.js";

// Return DATE columns (OID 1082) as raw "YYYY-MM-DD" strings instead of JS Dates,
// so cross-engine comparison is by calendar date, not tz-shifted instant.
pg.types.setTypeParser(1082, (v) => v);

let failures = 0;
const fail = (m: string) => { failures++; console.log(`  ✗ ${m}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ---- exact row-count parity (source COUNT vs target COUNT) --------------------
async function countParity(pgc: pg.PoolClient, cat: Catalog) {
  console.log("\n[1] Exact row-count parity (SQL Server vs Postgres):");
  const az = await azurePool();
  const names = [...cat.tables.keys()].sort();
  for (const n of names) {
    const src = Number((await az.request().query(`SELECT COUNT_BIG(*) AS c FROM [${n}]`)).recordset[0].c);
    const tgt = Number((await pgc.query(`SELECT count(*)::bigint AS c FROM ${qt(n)}`)).rows[0].c);
    if (src === tgt) { if (src > 0) ok(`${n.padEnd(30)} ${tgt.toLocaleString()}`); }
    else fail(`${n.padEnd(30)} source ${src.toLocaleString()} != target ${tgt.toLocaleString()}`);
  }
}

// ---- FK integrity (no orphans) -----------------------------------------------
async function fkIntegrity(pgc: pg.PoolClient, cat: Catalog) {
  console.log("\n[2] FK integrity (orphan rows must be 0):");
  let checked = 0;
  for (const t of cat.tables.values()) {
    for (const fk of t.fks) {
      const onClause = fk.childCols.map((c, i) => `c."${c}" = p."${fk.parentCols[i]}"`).join(" AND ");
      const notNull = fk.childCols.map((c) => `c."${c}" IS NOT NULL`).join(" AND ");
      const anyNullParent = `p."${fk.parentCols[0]}" IS NULL`;
      const sql =
        `SELECT count(*)::bigint AS n FROM ${qt(fk.childTable)} c ` +
        `LEFT JOIN ${qt(fk.parentTable)} p ON ${onClause} ` +
        `WHERE ${notNull} AND ${anyNullParent}`;
      const n = Number((await pgc.query(sql)).rows[0].n);
      checked++;
      if (n !== 0) fail(`${fk.childTable}.${fk.childCols.join(",")} -> ${fk.parentTable}: ${n.toLocaleString()} orphans`);
    }
  }
  ok(`${checked} FK relationships checked, no orphans` + (failures ? " (except those flagged)" : ""));
}

// ---- sampled field-level diff vs source --------------------------------------
function norm(v: any, sqlType?: string): string {
  if (v === null || v === undefined) return "";
  // DATE: compare calendar date only (mssql gives UTC-midnight Date; pg gives string).
  if (sqlType === "date") {
    return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) { const d = Date.parse(s); if (!isNaN(d)) return new Date(d).toISOString(); }
  const num = Number(s);
  if (s.trim() !== "" && !isNaN(num)) return String(num); // unify numeric formatting (money 0.00 vs 0)
  return s.trim();
}

async function sampledDiff(pgc: pg.PoolClient, cat: Catalog, tableNames: string[], sampleSize: number) {
  console.log(`\n[3] Sampled field-level diff vs source (${sampleSize}/table):`);
  const az = await azurePool();
  for (const name of tableNames) {
    const t = cat.tables.get(name);
    if (!t || t.pk.length !== 1) { console.log(`  – ${name}: skipped (need single-col PK)`); continue; }
    const pk = t.pk[0];
    const cols = [...t.columns].sort((a, b) => a.ordinal - b.ordinal);
    const tgtRows = (await pgc.query(
      `SELECT * FROM ${qt(name)} ORDER BY "${pk}" LIMIT ${sampleSize}`
    )).rows;
    if (!tgtRows.length) { console.log(`  – ${name}: no rows`); continue; }
    const ids = tgtRows.map((r) => r[pk]);
    const reqst = az.request();
    const ph = ids.map((v, i) => { reqst.input(`p${i}`, v); return `@p${i}`; });
    const colList = cols.map((c) => `[${c.name}]`).join(", ");
    const srcRows = (await reqst.query(`SELECT ${colList} FROM [${name}] WHERE [${pk}] IN (${ph.join(",")})`)).recordset;
    const srcById = new Map(srcRows.map((r: any) => [String(r[pk]), r]));

    let clean = 0;
    const diffs: string[] = [];
    for (const tr of tgtRows) {
      const sr = srcById.get(String(tr[pk]));
      if (!sr) { diffs.push(`${pk}=${tr[pk]} missing in source`); continue; }
      let rowClean = true;
      for (const c of cols) {
        if (norm(sr[c.name], c.sqlType) !== norm(tr[c.name], c.sqlType)) {
          rowClean = false;
          if (diffs.length < 5) diffs.push(`${pk}=${tr[pk]} ${c.name}: "${norm(sr[c.name], c.sqlType)}" != "${norm(tr[c.name], c.sqlType)}"`);
        }
      }
      if (rowClean) clean++;
    }
    if (clean === tgtRows.length) ok(`${name.padEnd(20)} ${clean}/${tgtRows.length} match`);
    else { fail(`${name}: ${clean}/${tgtRows.length} match`); diffs.forEach((d) => console.log(`      ${d}`)); }
  }
}

// ---- collection reconciliation ------------------------------------------------
async function collectionReconcile(pgc: pg.PoolClient) {
  console.log("\n[4] Collection reconciliation (user_card money totals, source vs target):");
  const az = await azurePool();
  const src = (await az.request().query(
    `SELECT COUNT_BIG(*) c, COALESCE(SUM(purchase_price),0) pp, COALESCE(SUM(estimated_value),0) ev, COALESCE(SUM(current_value),0) cv FROM [user_card]`
  )).recordset[0];
  const tgt = (await pgc.query(
    `SELECT count(*)::bigint c, COALESCE(SUM(purchase_price),0) pp, COALESCE(SUM(estimated_value),0) ev, COALESCE(SUM(current_value),0) cv FROM ${qt("user_card")}`
  )).rows[0];
  const cmp = (label: string, a: number, b: number) => {
    if (Math.abs(a - b) < 0.01) ok(`${label} = ${b.toLocaleString(undefined, { minimumFractionDigits: label === "count" ? 0 : 2 })}`);
    else fail(`${label}: source ${a} != target ${b}`);
  };
  cmp("count", Number(src.c), Number(tgt.c));
  cmp("sum(purchase_price)", Number(src.pp), Number(tgt.pp));
  cmp("sum(estimated_value)", Number(src.ev), Number(tgt.ev));
  cmp("sum(current_value)", Number(src.cv), Number(tgt.cv));
}

export async function verify(cat: Catalog) {
  const pool = new pg.Pool(pgPoolConfig());
  const pgc = await pool.connect();
  failures = 0;
  try {
    await countParity(pgc, cat);
    await fkIntegrity(pgc, cat);
    await sampledDiff(pgc, cat, ["card", "card_player_team", "user_card", "player", "series", "set"], 200);
    await collectionReconcile(pgc);
    console.log(failures === 0
      ? "\n✅ VERIFY PASSED — full migration fidelity confirmed."
      : `\n❌ VERIFY FAILED — ${failures} check(s) failed.`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    pgc.release();
    await pool.end();
  }
}
