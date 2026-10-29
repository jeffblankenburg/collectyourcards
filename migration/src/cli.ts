import { introspect, closeAzure } from "./catalog.js";
import { migrate as runMigrate } from "./migrate.js";
import { verify as runVerify } from "./verify.js";

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
}

async function migrate() { const cat = await introspect(); await runMigrate(cat); }
async function verify() { const cat = await introspect(); await runVerify(cat); }
async function all() { const cat = await introspect(); await runMigrate(cat); await runVerify(cat); }

const phase = process.argv[2] ?? "inspect";
const dispatch: Record<string, () => Promise<void>> = {
  inspect,
  migrate,
  verify,
  all,
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
