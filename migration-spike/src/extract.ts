import sql from "mssql";
import { writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { azureConfig, setIdOverride, dataDir } from "./config.js";
import { TABLES, byTarget, TableSpec } from "./tables.js";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}
function uniq<T>(arr: (T | null | undefined)[]): T[] {
  return [...new Set(arr.filter((x) => x !== null && x !== undefined) as T[])];
}

// Map a SQL Server recordset (keyed by src col) to target-col-keyed rows.
function mapRows(spec: TableSpec, rows: any[]): any[] {
  return rows.map((r) => {
    const o: any = {};
    for (const col of spec.cols) o[col.tgt] = r[col.src] ?? null;
    return o;
  });
}

// SELECT the spec's columns from `source` WHERE [whereCol] IN (...values), chunked.
async function selectIn(
  pool: sql.ConnectionPool,
  spec: TableSpec,
  whereCol: string,
  values: (number | string)[]
): Promise<any[]> {
  if (values.length === 0) return [];
  const colList = spec.cols.map((c) => `[${c.src}]`).join(", ");
  const out: any[] = [];
  for (const part of chunk(values, 1000)) {
    const reqst = pool.request();
    const placeholders = part.map((v, i) => {
      const p = `p${i}`;
      reqst.input(p, v);
      return `@${p}`;
    });
    const r = await reqst.query(
      `SELECT ${colList} FROM [${spec.source}] WHERE [${whereCol}] IN (${placeholders.join(",")})`
    );
    out.push(...r.recordset);
  }
  return mapRows(spec, out);
}

async function pickSetId(pool: sql.ConnectionPool): Promise<number> {
  if (setIdOverride) return setIdOverride;
  // Prefer the set where the OWNER collects the most cards — this exercises the
  // must-preserve collection data (user_card -> app_user) through the whole pipeline.
  let r = await pool.request().query(
    `SELECT TOP 1 s.[set_id], s.[name], COUNT(*) AS [card_count]
       FROM [user_card] uc
       JOIN [card] c   ON uc.[card]   = c.[card_id]
       JOIN [series] se ON c.[series] = se.[series_id]
       JOIN [set] s     ON se.[set]   = s.[set_id]
      GROUP BY s.[set_id], s.[name]
      ORDER BY COUNT(*) DESC`
  );
  // Fallback: a set that actually has cards entered (real card rows, not the
  // stale denormalized set.card_count which can be aspirational).
  if (!r.recordset.length) {
    r = await pool.request().query(
      `SELECT TOP 1 se.[set] AS [set_id], MAX(s.[name]) AS [name], COUNT(*) AS [card_count]
         FROM [card] c
         JOIN [series] se ON c.[series] = se.[series_id]
         JOIN [set] s     ON se.[set]   = s.[set_id]
        GROUP BY se.[set]
        ORDER BY COUNT(*) DESC`
    );
  }
  if (!r.recordset.length) throw new Error("No populated set found in legacy DB.");
  const row = r.recordset[0];
  console.log(`  auto-picked set ${row.set_id} ("${row.name}", card_count=${row.card_count})`);
  return Number(row.set_id);
}

export async function extract(): Promise<Record<string, any[]>> {
  mkdirSync(dataDir, { recursive: true });
  console.log("→ connecting to legacy Azure SQL …");
  const pool = await sql.connect(azureConfig as any);
  console.log("  connected.");

  const dataset: Record<string, any[]> = {};
  const save = (target: string, rows: any[]) => {
    dataset[target] = rows;
    writeFileSync(resolve(dataDir, `${target}.json`), JSON.stringify(rows, null, 0));
    console.log(`  ${target.padEnd(18)} ${rows.length}`);
  };

  try {
    const setId = await pickSetId(pool);

    // Walk the closure down from the chosen set, then back up to referenced parents.
    const set = await selectIn(pool, byTarget("set"), "set_id", [setId]);
    const series = await selectIn(pool, byTarget("series"), "set", [setId]);
    const seriesIds = series.map((s) => s.series_id);
    const card = await selectIn(pool, byTarget("card"), "series", seriesIds);
    const cardIds = card.map((c) => c.card_id);
    const cpt = await selectIn(pool, byTarget("card_player_team"), "card", cardIds);

    const ptIds = uniq(cpt.map((x) => x.player_team));
    const player_team = await selectIn(pool, byTarget("player_team"), "player_team_id", ptIds);
    const playerIds = uniq(player_team.map((x) => x.player));
    const teamIds = uniq(player_team.map((x) => x.team));
    const player = await selectIn(pool, byTarget("player"), "player_id", playerIds);
    const team = await selectIn(pool, byTarget("team"), "team_Id", teamIds);

    const orgIds = uniq([
      ...set.map((s) => s.organization),
      ...team.map((t) => t.organization),
    ]);
    const organization = await selectIn(pool, byTarget("organization"), "organization_id", orgIds);
    const mfgIds = uniq(set.map((s) => s.manufacturer));
    const manufacturer = await selectIn(pool, byTarget("manufacturer"), "manufacturer_id", mfgIds);
    const colorIds = uniq([
      ...series.map((s) => s.color),
      ...card.map((c) => c.color),
    ]);
    const color = await selectIn(pool, byTarget("color"), "color_id", colorIds);

    // The owner's collection records for these cards.
    const user_card = await selectIn(pool, byTarget("user_card"), "card", cardIds);
    const userIds = uniq(user_card.map((u) => u.user));
    const app_user = await selectIn(pool, byTarget("app_user"), "user_id", userIds);

    console.log("\nExtracted slice (target table -> row count):");
    save("organization", organization);
    save("manufacturer", manufacturer);
    save("color", color);
    save("team", team);
    save("set", set);
    save("series", series);
    save("card", card);
    save("player", player);
    save("player_team", player_team);
    save("card_player_team", cpt);
    save("app_user", app_user);
    save("user_card", user_card);

    // Manifest for the load/verify steps.
    writeFileSync(
      resolve(dataDir, "_manifest.json"),
      JSON.stringify({ setId, counts: Object.fromEntries(Object.entries(dataset).map(([k, v]) => [k, v.length])) }, null, 2)
    );
    console.log(`\n✓ extract complete for set ${setId}. Data in migration-spike/data/`);
    return dataset;
  } finally {
    await pool.close();
  }
}
