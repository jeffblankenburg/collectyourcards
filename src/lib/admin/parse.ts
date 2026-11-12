// Checklist parsing — replicates the old excel-parser. Two input shapes:
//  • FIXED columns (tab/CSV): Card# | Player(s) | Team(s) | RC | Notes
//  • LINE format: "1 Aaron Judge - NYY RC (notes)"  /multi "1 A - NYY/B - PHI RC (..)"
// Players/teams are returned as positional arrays (players[i] ↔ teams[i]); the
// wizard resolves names to ids in the review step.

export interface ParsedRow {
  row: number;
  card_number: string | null;
  players: string[];
  teams: string[];
  is_rookie: boolean;
  is_short_print: boolean;
  is_autograph: boolean;
  is_relic: boolean;
  notes: string | null;
}

const RC_TRUE = new Set(["rc", "r", "y", "yes", "true", "1", "✓", "rookie"]);
const splitMulti = (s: string) => s.split(/\s*[/;]\s*/).map((x) => x.trim()).filter(Boolean);
const truthyRc = (s: string) => RC_TRUE.has(s.trim().toLowerCase());

export function detectFormat(text: string): "fixed" | "lines" {
  const line = text.split(/\r?\n/).find((l) => l.trim()) ?? "";
  if (line.includes("\t")) return "fixed";
  if (/\s-\s/.test(line)) return "lines";
  if (line.includes(",") && line.split(",").length >= 3) return "fixed";
  return "lines";
}

function stripFlags(s: string) {
  const flags = { is_rookie: false, is_short_print: false, is_autograph: false, is_relic: false };
  let out = s;
  const take = (re: RegExp, set: () => void) => { if (re.test(out)) { set(); out = out.replace(re, " "); } };
  take(/\bRC\b/i, () => (flags.is_rookie = true));
  take(/\bSP\b/i, () => (flags.is_short_print = true));
  take(/\b(AUTO|AU)\b/i, () => (flags.is_autograph = true));
  take(/\b(RELIC|MEM)\b/i, () => (flags.is_relic = true));
  return { out: out.replace(/\s+/g, " ").trim(), flags };
}

export function parseFixed(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const first = lines[0].split(delim)[0]?.trim().toLowerCase() ?? "";
  const hasHeader = /card|number|#|player/.test(first) && !/^\d/.test(first);
  const body = hasHeader ? lines.slice(1) : lines;
  return body.map((line, i) => {
    const c = line.split(delim).map((x) => x.trim());
    const rawNotes = (c[4] ?? "").replace(/[()]/g, "").trim();
    return {
      row: i + 1,
      card_number: c[0] || null,
      players: splitMulti(c[1] ?? ""),
      teams: splitMulti(c[2] ?? ""),
      is_rookie: truthyRc(c[3] ?? ""),
      is_short_print: false, is_autograph: false, is_relic: false,
      notes: rawNotes || null,
    };
  });
}

export function parseLines(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  return lines.map((raw, i) => {
    let s = raw.trim();
    // trailing (notes)
    let notes: string | null = null;
    const m = s.match(/\(([^)]*)\)\s*$/);
    if (m) { notes = m[1].trim(); s = s.slice(0, m.index).trim(); }
    // leading card number (first whitespace-delimited token)
    let card_number: string | null = null;
    const sp = s.indexOf(" ");
    if (sp > 0) { card_number = s.slice(0, sp); s = s.slice(sp + 1).trim(); }
    // flags
    const { out, flags } = stripFlags(s);
    // player - team segments
    const players: string[] = [];
    const teams: string[] = [];
    for (const seg of out.split(/\s*[/;]\s*/)) {
      const parts = seg.split(/\s+-\s+/);
      players.push((parts[0] ?? "").trim());
      teams.push((parts[1] ?? "").trim());
    }
    return { row: i + 1, card_number, players: players.filter(Boolean), teams, ...flags, notes };
  });
}

export function parseText(text: string): ParsedRow[] {
  return detectFormat(text) === "fixed" ? parseFixed(text) : parseLines(text);
}

// .xlsx -> array-of-arrays -> fixed-column mapping. SheetJS loaded on demand.
export async function parseXlsx(buf: ArrayBuffer): Promise<ParsedRow[]> {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false }) as unknown as unknown[][];
  const tsv = rows.map((r) => (r ?? []).map((c) => (c == null ? "" : String(c))).join("\t")).join("\n");
  return parseFixed(tsv);
}
