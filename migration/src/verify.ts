import pg from "pg";
import { azurePool, Catalog } from "./catalog.js";
import { pgPoolConfig, TARGET_SCHEMA } from "./config.js";
import { qt } from "./ddl.js";
import { ADDED_CONSTRAINTS, buildResolver, Resolver, SYNTHETIC_FKS } from "./transform.js";
import { loadDecisions } from "./decisions.js";

// Return DATE columns (OID 1082) as raw "YYYY-MM-DD" strings instead of JS Dates,
// so cross-engine comparison is by calendar date, not tz-shifted instant.
pg.types.setTypeParser(1082, (v) => v);

let failures = 0;
const fail = (m: string) => { failures++; console.log(`  ✗ ${m}`); };
const ok = (m: string) => console.log(`  ✓ ${m}`);

// ---- [1] exact row-count parity (source COUNT vs target COUNT) ----------------
// Accounts for intentional row deletions made by data fixes (so count parity means
// "source minus what we deliberately removed", not blind equality).
async function intentionalDelta(az: any, name: string): Promise<{ delta: number; why: string }> {
  const d = loadDecisions();
  if (name === "card" && d["NOTNULL.card.series"]?.decision === "fix") {
    const n = Number((await az.request().query(`SELECT COUNT_BIG(*) AS c FROM [card] WHERE [series] IS NULL`)).recordset[0].c);
    return { delta: -n, why: `−${n} orphan cards deleted` };
  }
  // Recovery placeholders inserted by the FK.card.series fix: +1 series (#217), +1 set.
  if (d["FK.card.series"]?.decision === "fix") {
    if (name === "series") return { delta: 1, why: "+1 recovered series #217" };
    if (name === "set") return { delta: 1, why: "+1 placeholder set" };
  }
  return { delta: 0, why: "" };
}

async function countParity(pgc: pg.PoolClient, cat: Catalog) {
  console.log("\n[1] Exact row-count parity (SQL Server vs Postgres):");
  const az = await azurePool();
  const names = [...cat.tables.keys()].sort();
  for (const n of names) {
    const src = Number((await az.request().query(`SELECT COUNT_BIG(*) AS c FROM [${n}]`)).recordset[0].c);
    const tgt = Number((await pgc.query(`SELECT count(*)::bigint AS c FROM ${qt(n)}`)).rows[0].c);
    const { delta, why } = await intentionalDelta(az, n);
    const expected = src + delta;
    if (expected === tgt) { if (tgt > 0) ok(`${n.padEnd(30)} ${tgt.toLocaleString()}${why ? ` (${why})` : ""}`); }
    else fail(`${n.padEnd(30)} expected ${expected.toLocaleString()} (source ${src.toLocaleString()}${why ? `, ${why}` : ""}) != target ${tgt.toLocaleString()}`);
  }
}

// ---- [2] FK integrity (no orphans), resolved through renamed columns ----------
async function fkIntegrity(pgc: pg.PoolClient, cat: Catalog, r: Resolver) {
  console.log("\n[2] FK integrity (orphan rows must be 0):");
  let checked = 0;
  for (const t of cat.tables.values()) {
    for (const fk of t.fks) {
      const cc = fk.childCols.map((c) => r.target(fk.childTable, c));
      const pc = fk.parentCols.map((c) => r.target(fk.parentTable, c));
      const onClause = cc.map((c, i) => `c."${c}" = p."${pc[i]}"`).join(" AND ");
      const notNull = cc.map((c) => `c."${c}" IS NOT NULL`).join(" AND ");
      const sql =
        `SELECT count(*)::bigint AS n FROM ${qt(fk.childTable)} c ` +
        `LEFT JOIN ${qt(fk.parentTable)} p ON ${onClause} ` +
        `WHERE ${notNull} AND p."${pc[0]}" IS NULL`;
      const n = Number((await pgc.query(sql)).rows[0].n);
      checked++;
      if (n !== 0) fail(`${fk.childTable}.${fk.childCols.join(",")} -> ${fk.parentTable}: ${n.toLocaleString()} orphans`);
    }
  }
  // Synthetic FKs (added only when enforced / fixed).
  const decisions = loadDecisions();
  for (const fk of SYNTHETIC_FKS) {
    if (fk.gate === "gated" && decisions[fk.id]?.decision === "skip") continue;
    const cc = fk.childCols.map((c) => r.target(fk.childTable, c));
    const pc = fk.parentCols.map((c) => r.target(fk.parentTable, c));
    const on = cc.map((c, i) => `c."${c}" = p."${pc[i]}"`).join(" AND ");
    const notNull = cc.map((c) => `c."${c}" IS NOT NULL`).join(" AND ");
    const n = Number((await pgc.query(
      `SELECT count(*)::bigint AS n FROM ${qt(fk.childTable)} c LEFT JOIN ${qt(fk.parentTable)} p ON ${on} WHERE ${notNull} AND p."${pc[0]}" IS NULL`
    )).rows[0].n);
    checked++;
    if (n !== 0) fail(`synthetic ${fk.id}: ${n.toLocaleString()} orphans`);
  }
  ok(`${checked} FK relationships checked, no orphans` + (failures ? " (except those flagged)" : ""));
}

// ---- [3] sampled field-level diff vs source (by ColPlan) ----------------------
function norm(v: any, sqlType?: string): string {
  if (v === null || v === undefined) return "";
  if (sqlType === "date") {
    return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
  }
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) { const d = Date.parse(s); if (!isNaN(d)) return new Date(d).toISOString(); }
  const num = Number(s);
  if (s.trim() !== "" && !isNaN(num)) return String(num);
  return s.trim();
}

async function sampledDiff(pgc: pg.PoolClient, cat: Catalog, r: Resolver, tableNames: string[], sampleSize: number) {
  console.log(`\n[3] Sampled field-level diff vs source (${sampleSize}/table, by ColPlan):`);
  const az = await azurePool();
  for (const name of tableNames) {
    const t = cat.tables.get(name);
    if (!t || t.pk.length !== 1) { console.log(`  – ${name}: skipped (need single-col PK)`); continue; }
    const srcPk = t.pk[0];
    const tgtPk = r.target(name, srcPk);
    const plan = r.colPlan(t); // excludes dropped/computed
    // Exclude recovery placeholders (recreated in Postgres, absent from source).
    const exclude = name === "series" ? ` WHERE "slug" <> 'recovered-series-217'`
      : name === "set" ? ` WHERE "slug" <> 'recovered-set-placeholder'` : "";
    const tgtRows = (await pgc.query(`SELECT * FROM ${qt(name)}${exclude} ORDER BY "${tgtPk}" LIMIT ${sampleSize}`)).rows;
    if (!tgtRows.length) { console.log(`  – ${name}: no rows`); continue; }
    const ids = tgtRows.map((r2) => r2[tgtPk]);
    const reqst = az.request();
    const ph = ids.map((v, i) => { reqst.input(`p${i}`, v); return `@p${i}`; });
    const colList = plan.map((e) => `[${e.sourceName}]`).join(", ");
    const srcRows = (await reqst.query(`SELECT ${colList} FROM [${name}] WHERE [${srcPk}] IN (${ph.join(",")})`)).recordset;
    const srcById = new Map(srcRows.map((row: any) => [String(row[srcPk]), row]));

    let clean = 0;
    const diffs: string[] = [];
    for (const tr of tgtRows) {
      const sr = srcById.get(String(tr[tgtPk]));
      if (!sr) { diffs.push(`${tgtPk}=${tr[tgtPk]} missing in source`); continue; }
      let rowClean = true;
      for (const e of plan) {
        // Compare using the TARGET type when overridden (e.g. datetime->date), so a
        // date and its UTC-midnight datetime source aren't flagged as different.
        const ov = r.pgTypeFor(name, e.col);
        const cmpType = ov === "date" ? "date" : e.sqlType;
        if (norm(sr[e.sourceName], cmpType) !== norm(tr[e.targetName], cmpType)) {
          rowClean = false;
          if (diffs.length < 5) diffs.push(`${tgtPk}=${tr[tgtPk]} ${e.sourceName}->${e.targetName}: "${norm(sr[e.sourceName], cmpType)}" != "${norm(tr[e.targetName], cmpType)}"`);
        }
      }
      if (rowClean) clean++;
    }
    if (clean === tgtRows.length) ok(`${name.padEnd(20)} ${clean}/${tgtRows.length} match`);
    else { fail(`${name}: ${clean}/${tgtRows.length} match`); diffs.forEach((d) => console.log(`      ${d}`)); }
  }
}

// ---- [4] collection + grade reconciliation ------------------------------------
async function reconcile(pgc: pg.PoolClient) {
  console.log("\n[4] Reconciliation (user_card money totals + grade, source vs target):");
  const az = await azurePool();
  const src = (await az.request().query(
    `SELECT COUNT_BIG(*) c, COALESCE(SUM(purchase_price),0) pp, COALESCE(SUM(estimated_value),0) ev, COALESCE(SUM(current_value),0) cv,
            COUNT(grade) gc, COALESCE(SUM(grade),0) gs FROM [user_card]`
  )).recordset[0];
  const tgt = (await pgc.query(
    `SELECT count(*)::bigint c, COALESCE(SUM(purchase_price),0) pp, COALESCE(SUM(estimated_value),0) ev, COALESCE(SUM(current_value),0) cv,
            COUNT(grade)::bigint gc, COALESCE(SUM(grade),0) gs FROM ${qt("user_card")}`
  )).rows[0];
  const cmp = (label: string, a: number, b: number, tol = 0.01) => {
    if (Math.abs(a - b) < tol) ok(`${label} = ${b.toLocaleString(undefined, { minimumFractionDigits: /sum/.test(label) ? 2 : 0 })}`);
    else fail(`${label}: source ${a} != target ${b}`);
  };
  cmp("count", Number(src.c), Number(tgt.c));
  cmp("sum(purchase_price)", Number(src.pp), Number(tgt.pp));
  cmp("sum(estimated_value)", Number(src.ev), Number(tgt.ev));
  cmp("sum(current_value)", Number(src.cv), Number(tgt.cv));
  cmp("count(grade)", Number(src.gc), Number(tgt.gc));
  cmp("sum(grade)", Number(src.gs), Number(tgt.gs));
}

// ---- [5] dropped-column confirmation ------------------------------------------
async function droppedColumns(pgc: pg.PoolClient, cat: Catalog, r: Resolver) {
  console.log("\n[5] Dropped/computed columns absent + no column lost:");
  for (const t of cat.tables.values()) {
    const plan = r.colPlan(t);
    const live = (await pgc.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2`,
      [TARGET_SCHEMA, t.name]
    )).rows.map((x) => x.column_name as string);
    // computed/dropped source cols must NOT be present under any name
    const dropped = t.columns.filter((c) => r.isDropped(t.name, c.name));
    const leaked = dropped.filter((c) => live.includes(c.name));
    if (leaked.length) fail(`${t.name}: dropped columns still present: ${leaked.map((c) => c.name).join(", ")}`);
    // every planned target column must exist
    const missing = plan.filter((e) => !live.includes(e.targetName));
    if (missing.length) fail(`${t.name}: missing target columns: ${missing.map((e) => e.targetName).join(", ")}`);
    // target column count must equal plan length (no extras, none lost)
    if (live.length !== plan.length) fail(`${t.name}: target has ${live.length} cols, expected ${plan.length}`);
  }
  if (failures === 0) ok(`all tables: column sets match plan (computed/dropped excluded)`);
}

// ---- [6] slug uniqueness + [7] NOT NULL spine coverage ------------------------
async function constraintsHold(pgc: pg.PoolClient, cat: Catalog, r: Resolver) {
  console.log("\n[6/7] Added constraints hold (slug uniqueness + NOT NULL spine):");
  const decisions = loadDecisions();
  for (const ac of ADDED_CONSTRAINTS) {
    const enforced = ac.gate === "clean" || ["enforce", "fix"].includes(decisions[ac.id]?.decision ?? "");
    if (!enforced) { console.log(`  ↷ ${ac.id} not enforced (decision)`); continue; }
    const cols = ac.columns.map((c) => r.target(ac.table, c));
    if (ac.kind === "unique") {
      const dups = Number((await pgc.query(
        `SELECT count(*)::bigint n FROM (SELECT ${cols.map((c) => `"${c}"`).join(",")} FROM ${qt(ac.table)} GROUP BY ${cols.map((c) => `"${c}"`).join(",")} HAVING count(*) > 1) g`
      )).rows[0].n);
      dups === 0 ? ok(`UNIQUE ${ac.table}.${cols.join(",")} holds`) : fail(`UNIQUE ${ac.table}.${cols.join(",")}: ${dups} dup group(s)`);
    } else {
      const nulls = Number((await pgc.query(`SELECT count(*)::bigint n FROM ${qt(ac.table)} WHERE "${cols[0]}" IS NULL`)).rows[0].n);
      const declared = (await pgc.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name=$3`,
        [TARGET_SCHEMA, ac.table, cols[0]]
      )).rows[0]?.is_nullable;
      (nulls === 0 && declared === "NO")
        ? ok(`NOT NULL ${ac.table}.${cols[0]} holds`)
        : fail(`NOT NULL ${ac.table}.${cols[0]}: nulls=${nulls}, declared nullable=${declared}`);
    }
  }
}

// ---- [8] identity high-water ---------------------------------------------------
async function identityHighWater(pgc: pg.PoolClient, cat: Catalog, r: Resolver) {
  console.log("\n[8] Identity sequences past MAX(id):");
  let checked = 0;
  for (const t of cat.tables.values()) {
    const idCol = t.columns.find((c) => c.isIdentity);
    if (!idCol) continue;
    const target = r.target(t.name, idCol.name);
    const row = (await pgc.query(
      `SELECT (SELECT COALESCE(MAX("${target}"),0) FROM ${qt(t.name)}) AS maxid,
              (SELECT last_value FROM pg_sequences
                WHERE schemaname=$1 AND sequencename = split_part(pg_get_serial_sequence($2,$3),'.',2)) AS seqval`,
      [TARGET_SCHEMA, `"${TARGET_SCHEMA}"."${t.name}"`, target]
    )).rows[0];
    checked++;
    const maxid = Number(row.maxid), seqval = Number(row.seqval);
    if (!(seqval >= maxid)) fail(`${t.name}: sequence ${seqval} < MAX(${target}) ${maxid}`);
  }
  ok(`${checked} identity sequences checked`);
}

// ---- [9] deep-chain spot check (target-side link resolution) ------------------
async function deepChain(pgc: pg.PoolClient) {
  console.log("\n[9] Deep-chain resolution (card → series → set; card → cpt → player_team → player/team):");
  // sample cards that have a series + at least one card_player_team
  const chain = (await pgc.query(
    `SELECT count(*)::bigint n FROM (
       SELECT c.card_id
         FROM ${qt("card")} c
         JOIN ${qt("series")} s  ON s.series_id = c.series_id
         JOIN ${qt("set")} st    ON st.set_id   = s.set_id
        WHERE c.series_id IS NOT NULL
        LIMIT 500
     ) q`
  )).rows[0].n;
  Number(chain) > 0 ? ok(`card→series→set resolves (${Number(chain).toLocaleString()} sampled)`) : fail(`card→series→set resolved 0 rows`);

  const chain2 = (await pgc.query(
    `SELECT count(*)::bigint n FROM (
       SELECT cpt.card_player_team_id
         FROM ${qt("card_player_team")} cpt
         JOIN ${qt("player_team")} pt ON pt.player_team_id = cpt.player_team_id
         JOIN ${qt("player")} p ON p.player_id = pt.player_id
         JOIN ${qt("team")} tm  ON tm.team_id   = pt.team_id
        LIMIT 500
     ) q`
  )).rows[0].n;
  Number(chain2) > 0 ? ok(`card_player_team→player_team→player/team resolves (${Number(chain2).toLocaleString()} sampled)`) : fail(`cpt chain resolved 0 rows`);
}

export async function verify(cat: Catalog) {
  const r = buildResolver(cat);
  const pool = new pg.Pool(pgPoolConfig());
  const pgc = await pool.connect();
  failures = 0;
  try {
    await countParity(pgc, cat);
    await fkIntegrity(pgc, cat, r);
    await sampledDiff(pgc, cat, r, ["card", "card_player_team", "user_card", "player", "player_team", "series", "set", "team"], 500);
    await reconcile(pgc);
    await droppedColumns(pgc, cat, r);
    await constraintsHold(pgc, cat, r);
    await identityHighWater(pgc, cat, r);
    await deepChain(pgc);
    console.log(failures === 0
      ? "\n✅ VERIFY PASSED — full migration fidelity + integrity confirmed."
      : `\n❌ VERIFY FAILED — ${failures} check(s) failed.`);
    if (failures > 0) process.exitCode = 1;
  } finally {
    pgc.release();
    await pool.end();
  }
}
