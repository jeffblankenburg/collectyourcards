import { MapPin } from "lucide-react";
import type { CompactPlayer, CompactRow } from "@/lib/collection/index-types";
import { fullName } from "@/lib/collection/index-types";

export function Badge({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "gold" | "brand" | "violet" | "pink" }) {
  const tones = {
    ink: "bg-white/10 text-ink",
    gold: "bg-gold/20 text-gold",
    brand: "bg-brand/20 text-brand",
    violet: "bg-violet-400/20 text-violet-300",
    pink: "bg-pink-400/20 text-pink-300",
  } as const;
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${tones[tone]}`}>{children}</span>;
}

export function TeamChip({ p, size = 22 }: { p: CompactPlayer; size?: number }) {
  if (!p.ta) return null;
  // Scale the font to the abbreviation length so 3-letter codes (NYY, CLE, …)
  // fit inside the circle instead of overflowing the fill area.
  const len = p.ta.length;
  const fontSize = size * (len >= 3 ? 0.34 : len === 2 ? 0.42 : 0.5);
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full text-center font-bold leading-none tracking-tight text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: p.tp || "#334155",
        fontSize,
        // Secondary-color outline as an INSET shadow (not a border) so the fill
        // area stays symmetric and the abbreviation centers correctly.
        boxShadow: `inset 0 0 0 1.5px ${p.ts || "#94a3b8"}`,
      }}
      title={p.ta}
    >
      {p.ta}
    </span>
  );
}

// RC / AUTO / RELIC / SP + serial/print-run — the standard attribute row.
// `locationLabel` adds a location pill at the end (list view moves location here).
export function FlagBadges({ row, locationLabel }: { row: CompactRow; locationLabel?: string | null }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {row.rk ? <Badge tone="gold">RC</Badge> : null}
      {row.au ? <Badge tone="brand">AUTO</Badge> : null}
      {row.rl ? <Badge tone="violet">RELIC</Badge> : null}
      {row.sh ? <Badge tone="pink">SP</Badge> : null}
      {serialLabel(row) ? <Badge>{serialLabel(row)}</Badge> : null}
      {locationLabel ? (
        <span className="inline-flex items-center gap-0.5 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-muted">
          <MapPin className="size-2.5" />{locationLabel}
        </span>
      ) : null}
    </div>
  );
}

export function serialLabel(row: CompactRow): string | null {
  if (row.sn != null && row.pr != null) return `${row.sn}/${row.pr}`;
  if (row.pr != null) return `/${row.pr}`;
  if (row.sn != null) return `#${row.sn}`;
  return null;
}

export function playersLabel(row: CompactRow): string {
  return row.pl.map(fullName).filter(Boolean).join(", ") || row.se || "—";
}

// Each player's name immediately followed by THAT player's team circle. Inline
// (single line, clips) by default; `stacked` puts one player per line, nothing
// truncated — so every name + circle is always visible (taller rows).
export function PlayersWithTeams({ row, chipSize = 18, stacked = false }: { row: CompactRow; chipSize?: number; stacked?: boolean }) {
  if (row.pl.length === 0) {
    return <span className="truncate text-sm font-semibold text-ink">{row.se || "—"}</span>;
  }
  if (stacked) {
    return (
      <div className="flex flex-col gap-0.5">
        {row.pl.map((p, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-sm font-semibold leading-tight text-ink">{fullName(p)}</span>
            <TeamChip p={p} size={chipSize} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <span className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {row.pl.map((p, i) => (
        <span key={i} className="flex shrink-0 items-center gap-1">
          <span className="whitespace-nowrap text-sm font-semibold text-ink">{fullName(p)}</span>
          <TeamChip p={p} size={chipSize} />
        </span>
      ))}
    </span>
  );
}

export function gradeLabel(row: CompactRow): string | null {
  if (row.g == null) return null;
  return `${row.ga ?? ""} ${row.g}`.trim();
}

// eBay SOLD/completed-listings search for a card (matches v1: card # + player
// names + series), sorted by most recently ended — i.e. price research.
export function ebaySoldUrl(row: CompactRow): string {
  const parts: string[] = [];
  if (row.n) parts.push(row.n);
  for (const p of row.pl) { const n = fullName(p); if (n) parts.push(n); }
  if (row.se) parts.push(row.se);
  const q = encodeURIComponent(parts.join(" "));
  return `https://www.ebay.com/sch/i.html?_nkw=${q}&LH_Sold=1&LH_Complete=1&_sop=13`;
}

// COMC keyword search for a card (matches v1: card # + set + player names).
// COMC's `Cards,sh,=` facet takes `+`-joined keywords.
export function comcUrl(row: CompactRow): string {
  const parts: string[] = [];
  if (row.n) parts.push(row.n);
  if (row.st) parts.push(row.st);
  for (const p of row.pl) { const n = fullName(p); if (n) parts.push(n); }
  const q = encodeURIComponent(parts.join(" ")).replace(/%20/g, "+");
  return `https://www.comc.com/Cards,sh,=${q}`;
}
