import Image from "next/image";
import { MapPin, Star } from "lucide-react";
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

// THE canonical owned-card row body (photo + number/grade/value/favorite +
// players w/ team circles + series + flags/serial). Used by the collection list
// view AND public views/profiles so a copy renders identically everywhere — the
// caller supplies the clickable wrapper. `value` is a pre-formatted money string
// (omit for public, where values are hidden); `locationLabel` adds a location
// pill (owner-only). No hooks → safe in Server Components.
export function CardRowInner({ row, value, locationLabel }: { row: CompactRow; value?: string | null; locationLabel?: string | null }) {
  const grade = gradeLabel(row);
  return (
    <div className="flex w-full items-stretch gap-3 overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] pl-3 text-left transition hover:border-white/15 hover:bg-white/[0.06]">
      <div className="my-2 flex shrink-0 flex-col items-center gap-1 self-start">
        <div className="relative aspect-[5/7] w-12 overflow-hidden border border-white/10 bg-white/5">
          {row.pu ? <Image src={row.pu} alt={playersLabel(row)} fill sizes="48px" className="object-contain" /> : <div className="flex h-full items-center justify-center text-[9px] text-muted">#{row.n}</div>}
        </div>
        {row.rc ? <span className="rounded-full border border-white/15 bg-white/[0.06] px-1 py-0.5 font-mono text-[10px] leading-none tracking-wide text-ink">{row.rc}</span> : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-2 pr-1">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-sm font-semibold text-muted">#{row.n}</span>
          <div className="flex shrink-0 items-center gap-2">
            {grade ? <span className="rounded bg-gold/15 px-1.5 py-0.5 text-[10px] font-semibold text-gold">{grade}</span> : null}
            {value != null ? <span className="text-sm font-semibold tabular-nums text-ink">{value}</span> : null}
            {row.sp ? <Star className="size-4 fill-gold text-gold" /> : null}
          </div>
        </div>
        <PlayersWithTeams row={row} stacked />
        <div className="text-xs leading-snug text-muted">{row.se}</div>
        <FlagBadges row={row} locationLabel={locationLabel} />
      </div>

      <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: row.cx || "transparent" }} />
    </div>
  );
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
