import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getCard } from "@/lib/catalog/queries";
import { playerName, type CardPlayer } from "@/lib/catalog/types";
import { AddCardButton } from "@/components/collection/add-card-button";
import { AddToListButton } from "@/components/lists/add-to-list-button";
import { SuggestEditButton } from "@/components/submissions/suggest-edit-button";
import { YourCopies } from "@/components/catalog/your-copies";

export const instant = false; // param + live catalog read

// Team dot sized to sit beside the player name.
function TeamCircle({ team }: { team: CardPlayer["team"] }) {
  return (
    <span
      aria-hidden
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
      style={{
        backgroundColor: team?.primary_color || "#334155",
        border: `2px solid ${team?.secondary_color || "#94a3b8"}`,
      }}
    >
      {team?.abbreviation}
    </span>
  );
}

export default async function CardDetailPage({ params }: { params: Promise<{ cardId: string }> }) {
  const { cardId } = await params;
  const id = Number(cardId);
  if (!Number.isFinite(id)) notFound();
  const card = await getCard(id);
  if (!card) notFound();

  const names = card.players.map(playerName).filter(Boolean).join(", ");
  const badges = [
    card.is_rookie && "Rookie",
    card.is_autograph && "Autograph",
    card.is_relic && "Relic",
    card.is_short_print && "Short print",
    card.print_run && `/${card.print_run}`,
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="sr-only">{names || card.series.name} — {card.series.name} #{card.card_number}</h1>

      <div className="mt-3 flex gap-4">
        <div className="relative aspect-[5/7] w-32 shrink-0 overflow-hidden border border-white/15 bg-white/5">
          {card.front_image_path ? (
            <Image src={card.front_image_path} alt={`#${card.card_number}`} fill sizes="128px" className="object-contain" priority />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted">#{card.card_number}</div>
          )}
          {card.color?.hex ? <span aria-hidden className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: card.color.hex }} /> : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm text-muted">#{card.card_number}</div>

          {/* Player(s) with their team dot */}
          {card.players.length ? (
            <div className="mt-1 flex flex-col gap-1.5">
              {card.players.map((p) => (
                <div key={p.player_id} className="flex items-center gap-2">
                  <TeamCircle team={p.team} />
                  <Link href={p.slug ? `/players/${p.slug}` : "#"} className="font-display text-lg leading-tight text-ink hover:text-brand">
                    {playerName(p)}
                  </Link>
                </div>
              ))}
            </div>
          ) : null}

          <Link href={`/series/${card.series.slug}`} className="mt-2 block text-sm text-muted hover:text-ink">
            {card.series.name}{card.color?.name ? ` · ${card.color.name}` : ""}
          </Link>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {badges.map((b) => <span key={b} className="rounded bg-white/10 px-2 py-0.5 text-xs text-ink">{b}</span>)}
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <AddCardButton cardId={card.card_id} />
        <AddToListButton cardId={card.card_id} />
        <SuggestEditButton current={{
          card_id: card.card_id, card_number: card.card_number, is_rookie: card.is_rookie,
          is_autograph: card.is_autograph, is_relic: card.is_relic, is_short_print: card.is_short_print,
          print_run: card.print_run, notes: card.notes,
        }} />
      </div>

      <YourCopies cardId={card.card_id} fallbackImage={card.front_image_path} />
    </main>
  );
}
