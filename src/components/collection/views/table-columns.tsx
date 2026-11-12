import Image from "next/image";
import { ImageIcon, Star } from "lucide-react";
import type { CompactRow } from "@/lib/collection/index-types";
import { money } from "@/lib/collection/index-types";
import { cardValue, type SortKey, type ValueMode } from "@/lib/collection/pipeline";
import { Badge, TeamChip, gradeLabel, playersLabel, serialLabel } from "../card-row-shared";

export interface ColCtx { valueMode: ValueMode }

export interface ColDef {
  key: string;
  label: string;
  headerIcon?: React.ReactNode;         // shown in the header instead of a text label
  sortKey?: SortKey;
  align?: "left" | "right" | "center";
  defaultVisible: boolean;
  min: number;                          // minimum / fixed width
  max?: number;                         // clamp (for long free text like notes)
  pad?: number;                         // extra width past the measured text (inline icons/badges)
  grow?: (row: CompactRow) => string;   // text the column is sized to fit (no truncation)
  render: (row: CompactRow, ctx: ColCtx) => React.ReactNode;
}

const dateFmt = (epoch: number) => new Date(epoch * 1000).toLocaleDateString(undefined, { year: "2-digit", month: "2-digit", day: "2-digit" });

// Black or white tag text, chosen by the background colour's brightness.
export function contrastOn(hex?: string | null): string {
  if (!hex) return "#fff";
  const h = hex.replace("#", "").trim();
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(f.slice(0, 2), 16), g = parseInt(f.slice(2, 4), 16), b = parseInt(f.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "#fff";
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#000" : "#fff";
}

export const COLUMNS: ColDef[] = [
  // Thumbnail first (fav star overlaid) — fills the old empty left gutter and
  // makes it obvious which cards still lack a photo.
  { key: "thumb", label: "", headerIcon: <ImageIcon className="size-3.5" />, sortKey: "pc", defaultVisible: true, min: 46, align: "center",
    render: (r) => (
      <div className="relative aspect-[5/7] h-8 overflow-hidden rounded-sm border border-white/10 bg-white/5">
        {r.pu ? <Image src={r.pu} alt="" fill sizes="24px" className="object-cover" /> : null}
        {r.sp ? <Star className="absolute right-0 top-0 size-2.5 fill-gold text-gold drop-shadow" /> : null}
      </div>
    ) },
  { key: "num", label: "#", sortKey: "n", defaultVisible: true, min: 44, grow: (r) => `#${r.n ?? ""}`,
    render: (r) => <span className="whitespace-nowrap font-mono text-xs text-ink">#{r.n}</span> },
  { key: "players", label: "Player(s)", sortKey: "player", defaultVisible: true, min: 120, pad: 56, grow: (r) => playersLabel(r),
    render: (r) => (
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        {r.pl[0] ? <TeamChip p={r.pl[0]} size={16} /> : null}
        <span className="text-ink">{playersLabel(r)}</span>
        {r.rk ? <Badge tone="gold">RC</Badge> : null}
      </span>
    ) },
  { key: "series", label: "Series", sortKey: "se", defaultVisible: true, min: 120, max: 420, grow: (r) => r.se ?? "",
    render: (r) => <span className="whitespace-nowrap text-muted">{r.se}</span> },
  { key: "color", label: "Color", sortKey: "cl", defaultVisible: true, min: 60, pad: 24, grow: (r) => r.cl ?? "",
    render: (r) => (r.cl
      ? <span className="whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: r.cx || "#555", color: contrastOn(r.cx) }}>{r.cl}</span>
      : null) },
  { key: "serial", label: "Serial", sortKey: "sn", defaultVisible: true, min: 60, grow: (r) => serialLabel(r) ?? "",
    render: (r) => <span className="whitespace-nowrap tabular-nums text-muted">{serialLabel(r) ?? "—"}</span> },
  { key: "auto", label: "Auto", align: "center", defaultVisible: true, min: 52,
    render: (r) => (r.au ? <Badge tone="brand">AUTO</Badge> : null) },
  { key: "relic", label: "Relic", align: "center", defaultVisible: true, min: 58,
    render: (r) => (r.rl ? <Badge tone="violet">RELIC</Badge> : null) },
  { key: "sp", label: "SP", align: "center", defaultVisible: true, min: 40,
    render: (r) => (r.sh ? <Badge tone="pink">SP</Badge> : null) },
  { key: "grade", label: "Grade", sortKey: "g", defaultVisible: false, min: 60, grow: (r) => gradeLabel(r) ?? "",
    render: (r) => (gradeLabel(r) ? <span className="whitespace-nowrap rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">{gradeLabel(r)}</span> : null) },
  { key: "purchase", label: "Paid", sortKey: "pp", align: "right", defaultVisible: false, min: 64, grow: (r) => (r.pp ? money(r.pp) : ""),
    render: (r) => (r.pp ? <span className="whitespace-nowrap tabular-nums text-muted">{money(r.pp)}</span> : null) },
  { key: "estimated", label: "Est.", sortKey: "ev", align: "right", defaultVisible: false, min: 64, grow: (r) => { const e = cardValue(r, "estimated"); return e ? money(e) : ""; },
    render: (r) => { const e = cardValue(r, "estimated"); return e ? <span className="whitespace-nowrap tabular-nums text-muted">{money(e)}</span> : null; } },
  { key: "current", label: "Value", sortKey: "cv", align: "right", defaultVisible: true, min: 64, grow: (r) => { const v = cardValue(r, "current"); return v != null ? money(v) : ""; },
    render: (r, ctx) => { const v = cardValue(r, ctx.valueMode); return v != null ? <span className="whitespace-nowrap tabular-nums font-medium text-ink">{money(v)}</span> : null; } },
  { key: "location", label: "Location", sortKey: "ln", defaultVisible: false, min: 80, max: 260, grow: (r) => r.ln ?? "",
    render: (r) => <span className="whitespace-nowrap text-muted">{r.ln}</span> },
  { key: "added", label: "Added", sortKey: "cr", align: "right", defaultVisible: false, min: 74,
    render: (r) => <span className="whitespace-nowrap tabular-nums text-muted">{dateFmt(r.cr)}</span> },
  { key: "notes", label: "Notes", defaultVisible: false, min: 100, max: 320, grow: (r) => r.nt ?? "",
    render: (r) => <span className="whitespace-nowrap text-muted">{r.nt}</span> },
  { key: "code", label: "Code", defaultVisible: false, min: 56, grow: (r) => r.rc ?? "",
    render: (r) => <span className="whitespace-nowrap font-mono text-[11px] text-muted">{r.rc}</span> },
];

export const DEFAULT_VISIBLE = COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key);
