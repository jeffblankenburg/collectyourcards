import sql from "mssql";
import { azureConfig, SKIP_TABLES } from "./config.js";

export interface Column {
  name: string;
  sqlType: string;       // SQL Server data_type
  maxLen: number | null; // character_maximum_length (-1 = MAX)
  precision: number | null;
  scale: number | null;
  nullable: boolean;
  isIdentity: boolean;
  isComputed: boolean;
  ordinal: number;
}
export interface ForeignKey {
  name: string;
  childTable: string;
  childCols: string[];
  parentTable: string;
  parentCols: string[];
}
export interface Table {
  name: string;
  columns: Column[];
  pk: string[];           // primary key column names (may be empty)
  fks: ForeignKey[];      // FKs where this table is the child
  rowCount: number;
}
export interface Catalog {
  tables: Map<string, Table>;
  order: string[];        // FK-dependency-safe load order (parents first)
  cycles: ForeignKey[];   // FKs deferred because they form cycles
}

let pool: sql.ConnectionPool | null = null;
export async function azurePool(): Promise<sql.ConnectionPool> {
  if (!pool) pool = await sql.connect(azureConfig as any);
  return pool;
}
export async function closeAzure() {
  if (pool) { await pool.close(); pool = null; }
}

export async function introspect(): Promise<Catalog> {
  const p = await azurePool();

  const cols = (await p.request().query(`
    SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE,
           c.CHARACTER_MAXIMUM_LENGTH, c.NUMERIC_PRECISION, c.NUMERIC_SCALE,
           c.IS_NULLABLE, c.ORDINAL_POSITION,
           COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA)+'.'+QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'IsIdentity') AS IS_IDENTITY,
           COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA)+'.'+QUOTENAME(c.TABLE_NAME)), c.COLUMN_NAME, 'IsComputed') AS IS_COMPUTED
      FROM INFORMATION_SCHEMA.COLUMNS c
      JOIN INFORMATION_SCHEMA.TABLES t
        ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
     WHERE t.TABLE_TYPE = 'BASE TABLE' AND t.TABLE_SCHEMA = 'dbo'
     ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`)).recordset;

  const pks = (await p.request().query(`
    SELECT kcu.TABLE_NAME, kcu.COLUMN_NAME, kcu.ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
      JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
     WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY' AND tc.TABLE_SCHEMA = 'dbo'
     ORDER BY kcu.TABLE_NAME, kcu.ORDINAL_POSITION`)).recordset;

  const fkRows = (await p.request().query(`
    SELECT fk.name AS FK_NAME,
           OBJECT_NAME(fkc.parent_object_id)     AS CHILD_TABLE,
           COL_NAME(fkc.parent_object_id, fkc.parent_column_id)         AS CHILD_COL,
           OBJECT_NAME(fkc.referenced_object_id) AS PARENT_TABLE,
           COL_NAME(fkc.referenced_object_id, fkc.referenced_column_id) AS PARENT_COL,
           fkc.constraint_column_id AS COL_ORDER
      FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
     ORDER BY fk.name, fkc.constraint_column_id`)).recordset;

  const counts = (await p.request().query(`
    SELECT t.name AS TABLE_NAME, SUM(pt.rows) AS ROWS
      FROM sys.tables t
      JOIN sys.partitions pt ON t.object_id = pt.object_id
     WHERE pt.index_id IN (0,1)
     GROUP BY t.name`)).recordset;
  const countByTable = new Map<string, number>(counts.map((r: any) => [r.TABLE_NAME, Number(r.ROWS)]));

  // Assemble tables.
  const tables = new Map<string, Table>();
  for (const r of cols) {
    const tn = r.TABLE_NAME as string;
    if (SKIP_TABLES.has(tn)) continue;
    if (!tables.has(tn)) tables.set(tn, { name: tn, columns: [], pk: [], fks: [], rowCount: countByTable.get(tn) ?? 0 });
    tables.get(tn)!.columns.push({
      name: r.COLUMN_NAME,
      sqlType: String(r.DATA_TYPE).toLowerCase(),
      maxLen: r.CHARACTER_MAXIMUM_LENGTH,
      precision: r.NUMERIC_PRECISION,
      scale: r.NUMERIC_SCALE,
      nullable: r.IS_NULLABLE === "YES",
      isIdentity: r.IS_IDENTITY === 1,
      isComputed: r.IS_COMPUTED === 1,
      ordinal: r.ORDINAL_POSITION,
    });
  }
  for (const r of pks) {
    const t = tables.get(r.TABLE_NAME);
    if (t) t.pk.push(r.COLUMN_NAME);
  }
  // Group FK columns by FK name.
  const fkMap = new Map<string, ForeignKey>();
  for (const r of fkRows) {
    if (SKIP_TABLES.has(r.CHILD_TABLE) || SKIP_TABLES.has(r.PARENT_TABLE)) continue;
    let fk = fkMap.get(r.FK_NAME);
    if (!fk) {
      fk = { name: r.FK_NAME, childTable: r.CHILD_TABLE, childCols: [], parentTable: r.PARENT_TABLE, parentCols: [] };
      fkMap.set(r.FK_NAME, fk);
    }
    fk.childCols.push(r.CHILD_COL);
    fk.parentCols.push(r.PARENT_COL);
  }
  for (const fk of fkMap.values()) {
    const t = tables.get(fk.childTable);
    if (t) t.fks.push(fk);
  }

  const { order, cycles } = topoSort(tables);
  return { tables, order, cycles };
}

// Topological sort parents-first. FKs that would create a cycle (incl. self-refs)
// are collected as `cycles` and ignored for ordering; the ETL enforces them via a
// second pass / deferred constraints.
function topoSort(tables: Map<string, Table>): { order: string[]; cycles: ForeignKey[] } {
  const names = [...tables.keys()];
  const cycles: ForeignKey[] = [];
  // Build dependency edges child -> parent (skip self-refs immediately).
  const deps = new Map<string, Set<string>>(names.map((n) => [n, new Set<string>()]));
  const fkByPair: ForeignKey[] = [];
  for (const t of tables.values()) {
    for (const fk of t.fks) {
      fkByPair.push(fk);
      if (fk.parentTable === fk.childTable) { cycles.push(fk); continue; }
      if (tables.has(fk.parentTable)) deps.get(t.name)!.add(fk.parentTable);
    }
  }
  const order: string[] = [];
  const placed = new Set<string>();
  // Repeatedly place any table whose unmet deps are all placed.
  let progress = true;
  while (placed.size < names.length && progress) {
    progress = false;
    for (const n of names) {
      if (placed.has(n)) continue;
      const unmet = [...deps.get(n)!].filter((d) => !placed.has(d));
      if (unmet.length === 0) { order.push(n); placed.add(n); progress = true; }
    }
  }
  // Whatever remains is part of a cycle: break by placing remaining in name order,
  // and record their unmet FKs as deferred.
  if (placed.size < names.length) {
    const remaining = names.filter((n) => !placed.has(n));
    for (const n of remaining) {
      for (const fk of tables.get(n)!.fks) {
        if (!placed.has(fk.parentTable) && fk.parentTable !== n && tables.has(fk.parentTable)) {
          if (!cycles.includes(fk)) cycles.push(fk);
        }
      }
    }
    for (const n of remaining) { order.push(n); placed.add(n); }
  }
  return { order, cycles };
}
