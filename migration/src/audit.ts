// Pre-flight AUDIT: read-only probes against the Azure source enumerating every
// constraint the clean schema would add but the data might violate. Produces a
// console report + migration/audit-report.json so the human can decide each gated
// item ("pause & show me"). Never mutates Azure.
import { writeFileSync } from "fs";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import { azurePool, Catalog } from "./catalog.js";
import { ADDED_CONSTRAINTS, MONEY_PG_TYPE, SYNTHETIC_FKS } from "./transform.js";

const here = dirname(fileURLToPath(import.meta.url));
const reportPath = resolve(here, "..", "audit-report.json");

export type Severity = "BLOCKER" | "WARN" | "INFO";
export type Category = "FK_ORPHAN" | "UNIQUE" | "NOT_NULL" | "TYPE_FIT";

export interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  target: string; // what it blocks, e.g. "UNIQUE series.slug"
  count: number; // violating rows (or dup groups for UNIQUE)
  gate: "clean" | "gated";
  samples: any[];
  proposedFixes: string[];
}

async function scalar(sql: string): Promise<number> {
  const r = await (await azurePool()).request().query(sql);
  return Number(Object.values(r.recordset[0])[0]);
}
async function rows(sql: string): Promise<any[]> {
  return (await (await azurePool()).request().query(sql)).recordset;
}

// ---- FK orphans: every FK in the catalog (source column names) ----------------
async function auditFkOrphans(cat: Catalog): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const t of cat.tables.values()) {
    for (const fk of t.fks) {
      const on = fk.childCols.map((c, i) => `c.[${c}] = p.[${fk.parentCols[i]}]`).join(" AND ");
      const notNull = fk.childCols.map((c) => `c.[${c}] IS NOT NULL`).join(" AND ");
      const anyNullParent = `p.[${fk.parentCols[0]}] IS NULL`;
      const n = await scalar(
        `SELECT COUNT_BIG(*) n FROM [${fk.childTable}] c ` +
        `LEFT JOIN [${fk.parentTable}] p ON ${on} WHERE ${notNull} AND ${anyNullParent}`
      );
      if (n > 0) {
        const samples = await rows(
          `SELECT TOP 50 ${fk.childCols.map((c) => `c.[${c}]`).join(", ")} FROM [${fk.childTable}] c ` +
          `LEFT JOIN [${fk.parentTable}] p ON ${on} WHERE ${notNull} AND ${anyNullParent}`
        );
        out.push({
          id: `FKORPHAN.${fk.childTable}.${fk.childCols.join("+")}`,
          severity: "BLOCKER", category: "FK_ORPHAN",
          target: `FK ${fk.childTable}(${fk.childCols.join(",")}) -> ${fk.parentTable}`,
          count: n, gate: "gated", samples,
          proposedFixes: ["null-out orphan child values", "delete orphan child rows", "skip this FK"],
        });
      }
    }
  }
  return out;
}

// ---- Synthetic FK orphans (FKs missing in source we intend to add) ------------
async function auditSyntheticFks(): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const fk of SYNTHETIC_FKS) {
    const on = fk.childCols.map((c, i) => `c.[${c}] = p.[${fk.parentCols[i]}]`).join(" AND ");
    const notNull = fk.childCols.map((c) => `c.[${c}] IS NOT NULL`).join(" AND ");
    const n = await scalar(
      `SELECT COUNT_BIG(*) n FROM [${fk.childTable}] c ` +
      `LEFT JOIN [${fk.parentTable}] p ON ${on} WHERE ${notNull} AND p.[${fk.parentCols[0]}] IS NULL`
    );
    out.push({
      id: fk.id, severity: n > 0 ? "BLOCKER" : "INFO", category: "FK_ORPHAN",
      target: `SYNTHETIC FK ${fk.childTable}(${fk.childCols.join(",")}) -> ${fk.parentTable}`,
      count: n, gate: fk.gate, samples: [],
      proposedFixes: n > 0 ? ["recreate missing parent(s)", "delete orphan child rows", "skip this FK"] : [],
    });
  }
  return out;
}

// ---- UNIQUE / slug collisions --------------------------------------------------
async function auditUnique(cat: Catalog): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const ac of ADDED_CONSTRAINTS.filter((c) => c.kind === "unique")) {
    const cols = ac.columns.map((c) => `[${c}]`).join(", ");
    const groups = await scalar(
      `SELECT COUNT_BIG(*) n FROM (SELECT ${cols} FROM [${ac.table}] GROUP BY ${cols} HAVING COUNT_BIG(*) > 1) g`
    );
    const nullEmpty = await scalar(
      `SELECT COUNT_BIG(*) n FROM [${ac.table}] WHERE ${ac.columns.map((c) => `([${c}] IS NULL OR LTRIM(RTRIM([${c}])) = '')`).join(" OR ")}`
    );
    if (groups > 0 || nullEmpty > 0) {
      const samples = groups > 0
        ? await rows(`SELECT TOP 200 ${cols}, COUNT_BIG(*) n FROM [${ac.table}] GROUP BY ${cols} HAVING COUNT_BIG(*) > 1 ORDER BY n DESC`)
        : [];
      out.push({
        id: ac.id,
        severity: ac.gate === "gated" ? "BLOCKER" : "WARN",
        category: "UNIQUE",
        target: `UNIQUE ${ac.table}.${ac.columns.join(",")}`,
        count: groups, gate: ac.gate, samples,
        proposedFixes: ["suffix-slug (append -<id> to dups)", "merge duplicates", "skip (leave non-unique)"]
          .concat(nullEmpty > 0 ? [`${nullEmpty} null/empty value(s) present`] : []),
      });
    }
  }
  return out;
}

// ---- NOT NULL candidates -------------------------------------------------------
async function auditNotNull(cat: Catalog): Promise<Finding[]> {
  const out: Finding[] = [];
  for (const ac of ADDED_CONSTRAINTS.filter((c) => c.kind === "notnull")) {
    const col = ac.columns[0];
    const n = await scalar(`SELECT COUNT_BIG(*) n FROM [${ac.table}] WHERE [${col}] IS NULL`);
    if (n > 0) {
      const t = cat.tables.get(ac.table)!;
      const pk = t.pk[0] ?? col;
      const samples = await rows(`SELECT TOP 50 [${pk}] FROM [${ac.table}] WHERE [${col}] IS NULL`);
      out.push({
        id: ac.id,
        severity: ac.gate === "gated" ? "BLOCKER" : "WARN",
        category: "NOT_NULL",
        target: `NOT NULL ${ac.table}.${col}`,
        count: n, gate: ac.gate, samples,
        proposedFixes: ["assign a value to the nulls", "delete the null rows", "skip (leave nullable)"],
      });
    }
  }
  return out;
}

// ---- Type-fit ------------------------------------------------------------------
async function auditTypeFit(cat: Catalog): Promise<Finding[]> {
  const out: Finding[] = [];

  // grade decimal(18,0) -> numeric(4,1): must be integral-or-.5 and |v| < 100.
  if (cat.tables.get("user_card")) {
    const n = await scalar(
      `SELECT COUNT_BIG(*) n FROM [user_card] WHERE grade IS NOT NULL AND (grade <> ROUND(grade,1) OR ABS(grade) >= 100)`
    );
    out.push({
      id: "TYPEFIT.user_card.grade", severity: n > 0 ? "BLOCKER" : "INFO", category: "TYPE_FIT",
      target: "user_card.grade -> numeric(4,1)", count: n, gate: "clean", samples: [],
      proposedFixes: n > 0 ? ["widen target type", "clean offending values"] : [],
    });
  }

  // birthdate datetime -> date: any nonzero time component is lossy.
  if (cat.tables.get("player")) {
    const n = await scalar(
      `SELECT COUNT_BIG(*) n FROM [player] WHERE birthdate IS NOT NULL AND CAST(birthdate AS time) <> '00:00:00'`
    );
    out.push({
      id: "TYPEFIT.player.birthdate", severity: n > 0 ? "WARN" : "INFO", category: "TYPE_FIT",
      target: "player.birthdate -> date (drops time)", count: n, gate: "clean", samples: [],
      proposedFixes: n > 0 ? ["keep timestamptz instead of date"] : [],
    });
  }

  // Every money column -> numeric(12,2): overflow (>=10 digits) or sub-cent precision is lossy.
  for (const t of cat.tables.values()) {
    for (const c of t.columns) {
      if (c.sqlType !== "money" && c.sqlType !== "smallmoney") continue;
      const n = await scalar(
        `SELECT COUNT_BIG(*) n FROM [${t.name}] WHERE [${c.name}] IS NOT NULL AND (ABS([${c.name}]) >= 10000000000 OR [${c.name}] <> ROUND([${c.name}],2))`
      );
      out.push({
        id: `TYPEFIT.${t.name}.${c.name}`, severity: n > 0 ? "BLOCKER" : "INFO", category: "TYPE_FIT",
        target: `${t.name}.${c.name} -> ${MONEY_PG_TYPE}`, count: n, gate: "clean", samples: [],
        proposedFixes: n > 0 ? ["widen to numeric(12,4)"] : [],
      });
    }
  }

  return out;
}

export async function audit(cat: Catalog): Promise<Finding[]> {
  console.log("\n=== PRE-FLIGHT AUDIT (read-only against Azure source) ===");
  const findings = [
    ...(await auditFkOrphans(cat)),
    ...(await auditSyntheticFks()),
    ...(await auditUnique(cat)),
    ...(await auditNotNull(cat)),
    ...(await auditTypeFit(cat)),
  ];

  const gated = [
    ...ADDED_CONSTRAINTS.filter((c) => c.gate === "gated").map((c) => c.id),
    ...SYNTHETIC_FKS.filter((c) => c.gate === "gated").map((c) => c.id),
  ];

  console.log(`\nFindings: ${findings.length} total — ` +
    `${findings.filter((f) => f.severity === "BLOCKER").length} blocker, ` +
    `${findings.filter((f) => f.severity === "WARN").length} warn, ` +
    `${findings.filter((f) => f.severity === "INFO").length} info.\n`);

  for (const f of findings.filter((f) => f.count > 0)) {
    console.log(`  [${f.severity}] ${f.id}`);
    console.log(`      ${f.target} — ${f.count.toLocaleString()} row(s)/group(s), gate=${f.gate}`);
    if (f.samples.length) {
      const preview = f.samples.slice(0, 8).map((s) => JSON.stringify(s)).join(", ");
      console.log(`      samples: ${preview}${f.samples.length > 8 ? ` … (+${f.samples.length - 8})` : ""}`);
    }
    if (f.proposedFixes.length) console.log(`      options: ${f.proposedFixes.join(" | ")}`);
  }
  if (!findings.some((f) => f.count > 0)) console.log("  (no violations — all proposed constraints are clean)");

  console.log(`\nGated constraints requiring a decision in migration/decisions.json:`);
  for (const id of gated) {
    const f = findings.find((x) => x.id === id);
    console.log(`  - ${id}  (${f ? `${f.count.toLocaleString()} violating` : "clean"})`);
  }

  writeFileSync(reportPath, JSON.stringify({ generatedAgainst: "azure", findings }, null, 2));
  console.log(`\nFull report written to ${reportPath}`);
  return findings;
}
