import pg from "pg";
import { from as copyFrom } from "pg-copy-streams";
import { azurePool, Catalog, Column, Table } from "./catalog.js";
import { pgPoolConfig } from "./config.js";
import { addFkSql, createSchemaSql, createTableSql, identityResetSql, qt } from "./ddl.js";

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

function encodeRow(row: any, cols: Column[]): string {
  return cols.map((c) => encVal(row[c.name], c.sqlType)).join("\t") + "\n";
}

// ---- schema -------------------------------------------------------------------
export async function buildSchema(client: pg.PoolClient, cat: Catalog) {
  for (const stmt of createSchemaSql()) await client.query(stmt);
  for (const name of cat.order) {
    await client.query(createTableSql(cat.tables.get(name)!));
  }
  console.log(`  created schema + ${cat.order.length} tables`);
}

// ---- one table: stream SQL Server -> COPY into Postgres -----------------------
export function copyTable(pgClient: pg.PoolClient, table: Table): Promise<number> {
  const cols = [...table.columns].sort((a, b) => a.ordinal - b.ordinal);
  const colList = cols.map((c) => `[${c.name}]`).join(", ");
  const targetCols = cols.map((c) => `"${c.name}"`).join(", ");
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
      if (!dest.write(encodeRow(row, cols))) {
        request.pause();
        dest.once("drain", () => request.resume());
      }
    });
    request.on("error", (e: any) => { dest.destroy(e); reject(e); });
    request.on("done", () => dest.end());
    request.query(`SELECT ${colList} FROM [${table.name}]`);
  });
}

// ---- FK constraints (after load) ---------------------------------------------
export async function addConstraints(client: pg.PoolClient, cat: Catalog) {
  const failures: { name: string; error: string }[] = [];
  let added = 0;
  for (const name of cat.order) {
    for (const fk of addFkSql(cat.tables.get(name)!)) {
      try { await client.query(fk.sql); added++; }
      catch (e: any) { failures.push({ name: fk.name, error: (e.message || "").split("\n")[0] }); }
    }
  }
  console.log(`  added ${added} FK constraints` + (failures.length ? `, ${failures.length} FAILED` : ""));
  for (const f of failures) console.log(`    ✗ ${f.name}: ${f.error}`);
  return failures;
}

export async function resetIdentities(client: pg.PoolClient, cat: Catalog) {
  let n = 0;
  for (const name of cat.order) {
    const sql = identityResetSql(cat.tables.get(name)!);
    if (sql) { await client.query(sql); n++; }
  }
  console.log(`  reset ${n} identity sequences`);
}

// ---- orchestrate --------------------------------------------------------------
export async function migrate(cat: Catalog) {
  const pool = new pg.Pool({ ...pgPoolConfig(), max: 4 });
  const t0 = Date.now();
  try {
    console.log("→ building schema …");
    let client = await pool.connect();
    try { await buildSchema(client, cat); } finally { client.release(); }

    console.log("→ loading data (streaming COPY) …");
    let total = 0;
    // Load order doesn't matter for COPY (FKs added later), but parents-first
    // keeps the log readable.
    for (const name of cat.order) {
      const table = cat.tables.get(name)!;
      const c = await pool.connect();
      const tt = Date.now();
      try {
        const n = await copyTable(c, table);
        total += n;
        const secs = (Date.now() - tt) / 1000;
        const rate = secs > 0 ? Math.round(n / secs) : n;
        console.log(`  ${name.padEnd(30)} ${n.toLocaleString().padStart(10)}  (${rate.toLocaleString()}/s)`);
      } finally { c.release(); }
    }

    console.log("→ adding FK constraints …");
    client = await pool.connect();
    let fkFailures;
    try {
      fkFailures = await addConstraints(client, cat);
      await resetIdentities(client, cat);
    } finally { client.release(); }

    const secs = (Date.now() - t0) / 1000;
    console.log(`\n✓ migrate complete: ${total.toLocaleString()} rows in ${secs.toFixed(1)}s (${Math.round(total / secs).toLocaleString()}/s)`);
    return { total, fkFailures };
  } finally {
    await pool.end();
  }
}
