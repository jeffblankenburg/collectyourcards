import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { azurePool, Catalog, Table } from "./catalog.js";
import { pgPoolConfig } from "./config.js";
import { addConstraintSql, addFkSql, buildSchemaSql, createTableSql, identityResetSql, qt, syntheticFkSql } from "./ddl.js";
import { ADDED_CONSTRAINTS, buildResolver, ColPlanEntry, Resolver, SYNTHETIC_FKS, validateTransform } from "./transform.js";
import { Decisions, requireDecisions } from "./decisions.js";
import { FIXES } from "./fixes.js";

// ---- COPY text encoding -------------------------------------------------------
const DATE_TYPES = new Set(["datetime", "datetime2", "smalldatetime", "datetimeoffset"]);

function encVal(v: any, sqlType: string): string {
  if (v === null || v === undefined) return "\\N";
  if (sqlType === "date") {
    return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  }
  if (DATE_TYPES.has(sqlType)) {
    return v instanceof Date ? v.toISOString() : String(v);
  }
  if (sqlType === "bit") return v ? "t" : "f";
  if (typeof v === "boolean") return v ? "t" : "f";
  if (Buffer.isBuffer(v)) return "\\\\x" + v.toString("hex");
  if (typeof v === "number") return String(v);
  // string (and numeric/bigint-as-string): escape for COPY text format
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

// Rows from mssql are keyed by SOURCE name; the COPY column list uses TARGET names.
// Values are emitted in plan order so they line up positionally with the column list.
function encodeRow(row: any, plan: ColPlanEntry[]): string {
  return plan.map((e) => encVal(row[e.sourceName], e.sqlType)).join("\t") + "\n";
}

// ---- schema -------------------------------------------------------------------
export async function buildSchema(client: pg.PoolClient, cat: Catalog, r: Resolver) {
  for (const stmt of buildSchemaSql(cat)) await client.query(stmt);
  for (const name of cat.order) {
    await client.query(createTableSql(cat.tables.get(name)!, r));
  }
  console.log(`  created schema + ${cat.order.length} tables`);
}

// ---- one table: stream SQL Server -> COPY into Postgres -----------------------
// SELECT uses source names (in plan order); COPY uses target names (same order);
// computed/dropped columns are absent from the plan entirely.
export function copyTable(pgClient: pg.PoolClient, table: Table, r: Resolver): Promise<number> {
  const plan = r.colPlan(table);
  const colList = plan.map((e) => `[${e.sourceName}]`).join(", ");
  const targetCols = plan.map((e) => `"${e.targetName}"`).join(", ");
  const copySql = `COPY ${qt(table.name)} (${targetCols}) FROM STDIN WITH (FORMAT text)`;

  return new Promise<number>(async (resolve, reject) => {
    const dest = pgClient.query(copyFrom(copySql));
    dest.on("error", reject);
    dest.on("finish", () => resolve(count));

    let count = 0;
    const request = (await azurePool()).request();
    (request as any).stream = true;
    request.on("row", (row: any) => {
      count++;
      if (!dest.write(encodeRow(row, plan))) {
        request.pause();
        dest.once("drain", () => request.resume());
      }
    });
    request.on("error", (e: any) => { dest.destroy(e); reject(e); });
    request.on("done", () => dest.end());
    request.query(`SELECT ${colList} FROM [${table.name}]`);
  });
}

// ---- post-load data fixes (only those the user chose: decision === "fix") -----
export async function applyFixes(client: pg.PoolClient, decisions: Decisions) {
  const toFix = Object.entries(decisions).filter(([, d]) => d.decision === "fix");
  if (!toFix.length) { console.log("  no data fixes selected"); return; }
  for (const [id, d] of toFix) {
    const gen = FIXES[d.fix ?? id];
    if (!gen) throw new Error(`decision "fix" for ${id} has no implementation in fixes.ts (key: ${d.fix ?? id})`);
    for (const sql of gen()) await client.query(sql);
    console.log(`  applied fix: ${id}`);
  }
}

// ---- FK + added (unique/not-null) constraints, after load ---------------------
export async function addConstraints(client: pg.PoolClient, cat: Catalog, r: Resolver, decisions: Decisions) {
  const failures: { name: string; error: string }[] = [];
  let fks = 0;
  for (const name of cat.order) {
    for (const fk of addFkSql(cat.tables.get(name)!, r)) {
      try { await client.query(fk.sql); fks++; }
      catch (e: any) { failures.push({ name: fk.name, error: (e.message || "").split("\n")[0] }); }
    }
  }

  const gatedSkip = (id: string, gate: string) =>
    gate === "gated" && decisions[id]?.decision === "skip";

  let added = 0, skipped = 0;
  for (const ac of ADDED_CONSTRAINTS) {
    if (gatedSkip(ac.id, ac.gate)) { skipped++; console.log(`    ↷ skipped (decision): ${ac.id}`); continue; }
    try { await client.query(addConstraintSql(ac, r)); added++; }
    catch (e: any) { failures.push({ name: ac.id, error: (e.message || "").split("\n")[0] }); }
  }

  let synth = 0;
  for (const fk of SYNTHETIC_FKS) {
    if (gatedSkip(fk.id, fk.gate)) { skipped++; console.log(`    ↷ skipped (decision): ${fk.id}`); continue; }
    try { await client.query(syntheticFkSql(fk, r).sql); synth++; }
    catch (e: any) { failures.push({ name: fk.id, error: (e.message || "").split("\n")[0] }); }
  }

  console.log(`  added ${fks} FK + ${synth} synthetic FK + ${added} unique/not-null constraints` +
    (skipped ? `, ${skipped} gated-skipped` : "") +
    (failures.length ? `, ${failures.length} FAILED` : ""));
  for (const f of failures) console.log(`    ✗ ${f.name}: ${f.error}`);
  return failures;
}

export async function resetIdentities(client: pg.PoolClient, cat: Catalog, r: Resolver) {
  let n = 0;
  for (const name of cat.order) {
    const sql = identityResetSql(cat.tables.get(name)!, r);
    if (sql) { await client.query(sql); n++; }
  }
  console.log(`  reset ${n} identity sequences`);
}

// ---- orchestrate --------------------------------------------------------------
export async function migrate(cat: Catalog) {
  const decisions = requireDecisions(); // fail-closed if a gated constraint is undecided
  const summary = validateTransform(cat); // throws on any unresolved collision/reserved word
  console.log(`  transform: ${summary.renames.length} renames, ${summary.drops.length} drops, ${summary.typeOverrides.length} type overrides`);
  const r = buildResolver(cat);

  const pool = new pg.Pool({ ...pgPoolConfig(), max: 4 });
  const t0 = Date.now();
  try {
    console.log("→ building schema …");
    let client = await pool.connect();
    try { await buildSchema(client, cat, r); } finally { client.release(); }

    console.log("→ loading data (streaming COPY) …");
    let total = 0;
    for (const name of cat.order) {
      const table = cat.tables.get(name)!;
      const c = await pool.connect();
      const tt = Date.now();
      try {
        const n = await copyTable(c, table, r);
        total += n;
        const secs = (Date.now() - tt) / 1000;
        const rate = secs > 0 ? Math.round(n / secs) : n;
        console.log(`  ${name.padEnd(30)} ${n.toLocaleString().padStart(10)}  (${rate.toLocaleString()}/s)`);
      } finally { c.release(); }
    }

    console.log("→ applying data fixes …");
    client = await pool.connect();
    try { await applyFixes(client, decisions); } finally { client.release(); }

    console.log("→ adding constraints …");
    client = await pool.connect();
    let fkFailures;
    try {
      fkFailures = await addConstraints(client, cat, r, decisions);
      await resetIdentities(client, cat, r);
    } finally { client.release(); }

    const secs = (Date.now() - t0) / 1000;
    console.log(`\n✓ migrate complete: ${total.toLocaleString()} rows in ${secs.toFixed(1)}s (${Math.round(total / secs).toLocaleString()}/s)`);
    return { total, fkFailures };
  } finally {
    await pool.end();
  }
}
