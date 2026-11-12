import Link from "next/link";
import Image from "next/image";
import type { Card } from "@/lib/catalog/types";
import { playerName } from "@/lib/catalog/types";

function Badge({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "gold" | "brand" }) {
  const tones = {
    ink: "bg-white/10 text-ink",
    gold: "bg-gold/20 text-gold",
    brand: "bg-brand/20 text-brand",
  } as const;
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${tones[tone]}`}>
      {children}
    </span>
  );
}

// Small circular team chip colored with the team's primary color.
function TeamChip({ abbr, color }: { abbr: string | null; color: string | null }) {
  if (!abbr) return null;
  const bg = color || "#334155";
  return (
    <span
      className="inline-flex size-6 items-center justify-center rounded-full text-[9px] font-bold text-white ring-1 ring-inset ring-white/20"
      style={{ backgroundColor: bg }}
      title={abbr}
    >
      {abbr}
    </span>
  );
}

// Owner-condition extras shown on public views/profiles (serial, grade, favorite).
export interface CardCondition {
  serial_number?: number | null;
  grade?: number | null;
  grading_agency?: string | null;
  is_favorite?: boolean | null;
}

// A catalog card as a horizontal row (mobile-first list item). Square corners
// per house style; parallels show a color stripe. `condition` adds a collector's
// public-safe copy details (used on shared views / public profiles).
export function CardTile({ card, href, condition }: { card: Card; href?: string; condition?: CardCondition }) {
  const names = card.players.map(playerName).filter(Boolean).join(", ") || "—";
  const stripe = card.color?.hex || null;
  const firstTeam = card.players[0]?.team;

  return (
    <Link
      href={href ?? `/cards/${card.card_id}`}
      className="group flex items-stretch gap-3 overflow-hidden border border-white/5 bg-white/[0.03] transition hover:border-white/15 hover:bg-white/[0.06]"
    >
      {stripe ? <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: stripe }} /> : <span className="w-1 shrink-0 bg-transparent" />}

      <div className="relative my-2 aspect-[5/7] w-14 shrink-0 self-center overflow-hidden border border-white/10 bg-white/5">
        {card.front_image_path ? (
          <Image src={card.front_image_path} alt={names} fill sizes="56px" className="object-contain" />
        ) : (
          <div className="flex h-full items-center justify-center text-[10px] text-muted">#{card.card_number}</div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center py-2 pr-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted">#{card.card_number}</span>
          {firstTeam ? <TeamChip abbr={firstTeam.abbreviation} color={firstTeam.primary_color} /> : null}
        </div>
        <div className="truncate text-sm font-semibold text-ink">{names}</div>
        <div className="truncate text-xs text-muted">
          {card.series.name}
          {card.color?.name ? ` · ${card.color.name}` : ""}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {condition?.is_favorite ? <Badge tone="gold">★</Badge> : null}
          {card.is_rookie ? <Badge tone="gold">RC</Badge> : null}
          {card.is_autograph ? <Badge tone="brand">AUTO</Badge> : null}
          {card.is_relic ? <Badge tone="brand">RELIC</Badge> : null}
          {card.is_short_print ? <Badge>SP</Badge> : null}
          {card.print_run ? <Badge>/{card.print_run}</Badge> : null}
          {condition?.serial_number != null ? <Badge tone="brand">#{condition.serial_number}</Badge> : null}
          {condition?.grade != null ? <Badge tone="gold">{condition.grading_agency ? `${condition.grading_agency} ` : ""}{condition.grade}</Badge> : null}
        </div>
      </div>
    </Link>
  );
}
