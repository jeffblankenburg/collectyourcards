import { notFound } from "next/navigation";
import { getPlayerBySlug, cardSearch } from "@/lib/catalog/queries";
import { CardTile } from "@/components/catalog/card-tile";
import { SuggestPlayerEdit } from "@/components/submissions/suggest-player-edit";

export const instant = false; // param + live catalog read

export default async function PlayerDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);
  if (!player) notFound();
  const cards = await cardSearch({ playerId: player.player_id, limit: 100 });
  const name = [player.first_name, player.last_name].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <h1 className="font-display text-2xl text-ink">
        {name}
        {player.is_hof ? <span className="ml-2 align-middle text-sm text-gold">★ HOF</span> : null}
      </h1>
      <p className="mt-1 text-sm text-muted">{player.card_count ?? 0} cards in the catalog</p>
      <div className="mt-3">
        <SuggestPlayerEdit current={{ player_id: player.player_id, first_name: player.first_name, last_name: player.last_name, nick_name: player.nick_name, is_hof: !!player.is_hof }} />
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {cards.map((c) => <CardTile key={c.card_id} card={c} />)}
      </div>
    </main>
  );
}
