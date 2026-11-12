import Link from "next/link";
import Image from "next/image";
import { Check } from "lucide-react";
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

// A catalog card as a horizontal row (mobile-first list item). Square corners
// per house style; parallels show a color stripe. `owned` shows an in-collection
// badge; `selection` turns the row into a toggle (checklist / bulk-add mode).
export function CardTile({
  card, href, owned, selection,
}: {
  card: Card;
  href?: string;
  owned?: number;
  selection?: { selected: boolean; onToggle: () => void };
}) {
  const names = card.players.map(playerName).filter(Boolean).join(", ") || "—";
  const stripe = card.color?.hex || null;
  const firstTeam = card.players[0]?.team;
  const isOwned = !!owned && owned > 0;

  const inner = (
    <>
      {selection ? (
        <span aria-hidden className={`flex w-9 shrink-0 items-center justify-center self-stretch ${selection.selected ? "bg-brand/15" : ""}`}>
          <span className={`flex size-5 items-center justify-center rounded-full border transition ${selection.selected ? "border-brand bg-brand text-white" : "border-white/30"}`}>
            {selection.selected ? <Check className="size-3.5" /> : null}
          </span>
        </span>
      ) : (
        stripe ? <span aria-hidden className="w-1 shrink-0" style={{ backgroundColor: stripe }} /> : <span className="w-1 shrink-0 bg-transparent" />
      )}

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
          {card.is_rookie ? <Badge tone="gold">RC</Badge> : null}
          {card.is_autograph ? <Badge tone="brand">AUTO</Badge> : null}
          {card.is_relic ? <Badge tone="brand">RELIC</Badge> : null}
          {card.is_short_print ? <Badge>SP</Badge> : null}
          {card.print_run ? <Badge>/{card.print_run}</Badge> : null}
        </div>
      </div>
    </>
  );

  // Whole-tile tint: owned reads green (like v1), gray otherwise. Selection
  // highlight (brand) takes priority so the current pick is unmistakable.
  const ownedCls = "border-green-500/30 bg-green-500/[0.10] hover:border-green-500/45 hover:bg-green-500/[0.14]";
  const plainCls = "border-white/5 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.06]";

  if (selection) {
    const cls = selection.selected ? "border-brand/60 bg-brand/[0.08]" : (isOwned ? ownedCls : plainCls);
    return (
      <button type="button" onClick={selection.onToggle} aria-pressed={selection.selected}
        className={`group flex w-full items-stretch gap-3 overflow-hidden border text-left transition ${cls}`}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={href ?? `/cards/${card.card_id}`}
      className={`group flex items-stretch gap-3 overflow-hidden border transition ${isOwned ? ownedCls : plainCls}`}>
      {inner}
    </Link>
  );
}
