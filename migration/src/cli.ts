import pg from "pg";
import { introspect, closeAzure } from "./catalog.js";
import { migrate as runMigrate, applyFixes } from "./migrate.js";
import { verify as runVerify } from "./verify.js";
import { audit as runAudit } from "./audit.js";
import { buildResolver, validateTransform } from "./transform.js";
import { requireDecisions } from "./decisions.js";
import { createTableSql } from "./ddl.js";
import { pgPoolConfig, TARGET_SCHEMA } from "./config.js";

async function inspect() {
  const cat = await introspect();
  const tables = [...cat.tables.values()].sort((a, b) => b.rowCount - a.rowCount);
  let total = 0;
  console.log(`\nTABLES (${cat.tables.size}) — by approx row count:\n`);
  console.log("  " + "table".padEnd(34) + "rows".padStart(12) + "  cols  pk  fks");
  console.log("  " + "-".repeat(64));
  for (const t of tables) {
    total += t.rowCount;
    console.log(
      "  " + t.name.padEnd(34) +
      t.rowCount.toLocaleString().padStart(12) +
      `  ${String(t.columns.length).padStart(4)}  ${String(t.pk.length).padStart(2)}  ${String(t.fks.length).padStart(3)}`
    );
  }
  console.log("  " + "-".repeat(64));
  console.log("  " + "TOTAL".padEnd(34) + total.toLocaleString().padStart(12));

  console.log(`\nLOAD ORDER (parents first, ${cat.order.length} tables):`);
  console.log("  " + cat.order.join(" → "));

  console.log(`\nDEFERRED FKs (cycles / self-refs, ${cat.cycles.length}) — enforced via 2nd pass:`);
  for (const fk of cat.cycles) {
    console.log(`  ${fk.childTable}.${fk.childCols.join(",")} → ${fk.parentTable}.${fk.parentCols.join(",")}`);
  }

  // Surface any tables Prisma will struggle with.
  const noPk = tables.filter((t) => t.pk.length === 0);
  if (noPk.length) {
    console.log(`\n⚠ tables WITHOUT a primary key (${noPk.length}): ${noPk.map((t) => t.name).join(", ")}`);
  }
  const composite = tables.filter((t) => t.pk.length > 1);
  if (composite.length) {
    console.log(`\nℹ composite PKs (${composite.length}): ${composite.map((t) => `${t.name}(${t.pk.join("+")})`).join(", ")}`);
  }
  const computed = tables.flatMap((t) => t.columns.filter((c) => c.isComputed).map((c) => `${t.name}.${c.name}`));
  if (computed.length) console.log(`\nℹ computed columns (skipped on load): ${computed.join(", ")}`);

  // Distinct SQL types present (so DDL type-map coverage can be confirmed).
  const types = new Set<string>();
  for (const t of tables) for (const c of t.columns) types.add(c.sqlType);
  console.log(`\nDISTINCT SQL TYPES: ${[...types].sort().join(", ")}`);

  // Transform preview — the full list a human signs off on before migrating.
  const tr = validateTransform(cat); // throws on any unresolved collision/reserved word
  console.log(`\nTRANSFORM — ${tr.renames.length} renames, ${tr.drops.length} drops, ${tr.typeOverrides.length} type overrides`);
  console.log(`\n  RENAMES:\n    ${tr.renames.join("\n    ")}`);
  console.log(`\n  DROPPED (computed/search):\n    ${tr.drops.join("\n    ")}`);
  console.log(`\n  TYPE OVERRIDES:\n    ${tr.typeOverrides.join("\n    ")}`);
}

async function ddl() {
  const cat = await introspect();
  const r = buildResolver(cat);
  for (const name of cat.order) console.log(createTableSql(cat.tables.get(name)!, r) + "\n");
}

async function audit() { const cat = await introspect(); await runAudit(cat); }
async function migrate() { const cat = await introspect(); await runMigrate(cat); }
async function verify() { const cat = await introspect(); await runVerify(cat); }
async function all() { const cat = await introspect(); await runMigrate(cat); await runVerify(cat); }

async function fix() {
  const cat = await introspect();
  const decisions = requireDecisions();
  const pool = new pg.Pool(pgPoolConfig());
  const c = await pool.connect();
  try { await applyFixes(c, decisions); } finally { c.release(); await pool.end(); }
}

// Drop the legacy experiment — ONLY after public verifies. Guarded by --confirm.
async function finalize() {
  if (!process.argv.includes("--confirm")) {
    console.error("finalize is destructive (DROP SCHEMA legacy CASCADE). Re-run with --confirm.");
    process.exit(2);
  }
  if (TARGET_SCHEMA !== "public") {
    console.error(`finalize expects TARGET_SCHEMA=public (got "${TARGET_SCHEMA}") so it can verify the real target first.`);
    process.exit(2);
  }
  const cat = await introspect();
  await runVerify(cat);
  if (process.exitCode === 1) {
    console.error("\nAborting finalize: public verify did not pass. Legacy left intact.");
    return;
  }
  const pool = new pg.Pool(pgPoolConfig());
  const c = await pool.connect();
  try {
    await c.query(`DROP SCHEMA IF EXISTS "legacy" CASCADE;`);
    console.log("\n🗑  Dropped schema \"legacy\". Cutover complete — public is the source of truth.");
  } finally { c.release(); await pool.end(); }
}

const phase = process.argv[2] ?? "inspect";
const dispatch: Record<string, () => Promise<void>> = {
  inspect,
  ddl,
  audit,
  migrate,
  verify,
  all,
  fix,
  finalize,
};

const fn = dispatch[phase];
if (!fn) {
  console.error(`Unknown phase "${phase}". Available: ${Object.keys(dispatch).join(", ")}`);
  process.exit(2);
}
fn()
  .then(async () => { await closeAzure(); })
  .catch(async (e) => {
    console.error("\n💥 failed:\n", e?.message ?? e);
    await closeAzure().catch(() => {});
    process.exit(1);
  });
