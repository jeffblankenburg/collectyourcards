import { notFound } from "next/navigation";
import { getTeamBySlug, cardSearch } from "@/lib/catalog/queries";
import { CardTile } from "@/components/catalog/card-tile";
import { SuggestTeamEdit } from "@/components/submissions/suggest-team-edit";

export const instant = false; // param + live catalog read

export default async function TeamDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();
  const cards = await cardSearch({ teamId: team.team_id, limit: 100 });
  const name = [team.city, team.name].filter(Boolean).join(" ");

  return (
    <main className="mx-auto max-w-screen-sm px-4 py-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-10 items-center justify-center rounded-full text-xs font-bold text-white ring-1 ring-inset ring-white/20"
          style={{ backgroundColor: team.primary_color || "#334155" }}>
          {team.abbreviation}
        </span>
        <div>
          <h1 className="font-display text-2xl text-ink">{name}</h1>
          <p className="text-sm text-muted">{team.card_count ?? 0} cards · {team.player_count ?? 0} players</p>
        </div>
      </div>
      <div className="mt-3">
        <SuggestTeamEdit current={{ team_id: team.team_id, name: team.name, city: team.city, abbreviation: team.abbreviation, primary_color: team.primary_color, secondary_color: team.secondary_color }} />
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {cards.map((c) => <CardTile key={c.card_id} card={c} />)}
      </div>
    </main>
  );
}
