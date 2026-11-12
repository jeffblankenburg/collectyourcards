import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { sbPublic } from "@/lib/supabase/public";
import { SHOWCASE_CARDS, type ShowcaseCard } from "@/data/showcase-cards";
import { pickFrom, teamTally } from "@/lib/showcase";

// Live showcase pool: random cards from opted-in collections (for now the
// owner's — see db/app/018_home_showcase.sql). Mapped onto the ShowcaseCard
// shape the hero components already consume. Falls back to the curated static
// list if the RPC returns nothing or errors, so the hero is never empty.
type ShowcaseRow = {
  user_card_id: number;
  card_id: number;
  card_number: string | null;
  photo_url: string;
  player: string;
  series: string;
  year: number | null;
  team_id: number | null;
};

async function fetchPool(): Promise<ShowcaseCard[]> {
  const { data, error } = await sbPublic.rpc("home_showcase_cards", { p_limit: 120 });
  if (error || !data?.length) return SHOWCASE_CARDS;
  return (data as ShowcaseRow[]).map((r) => ({
    cardId: r.card_id,
    image: r.photo_url,
    player: r.player,
    series: r.series,
    year: r.year ?? 0,
    number: r.card_number ?? "",
    href: `/cards/${r.card_id}`,
    team: r.team_id != null ? String(r.team_id) : undefined,
    // Collection photos are real-world shots of unknown orientation; we can't
    // pre-flag landscape, so the fan's 5:7 frame center-crops them (fine for the
    // portrait-dominant case). Revisit if we start storing photo dimensions.
  }));
}

// One coordinated, per-request selection shared by the hero fan and the marquee.
// React's cache() memoizes it for the render, so both components (in separate
// Suspense boundaries) see the same picks: the fan takes three cards, the
// marquee fills from the rest — no player, series, or card repeats on the page.
// connection() keeps it off the prerender path so it reshuffles every load.
const MAX_PER_TEAM = 3;

export const getHomeShowcase = cache(async () => {
  await connection();
  const pool = await fetchPool();
  const fan = pickFrom(pool, 3, { portraitOnly: true, maxPerTeam: MAX_PER_TEAM });
  const marquee = pickFrom(pool, 16, {
    exclude: new Set(fan.map((c) => c.cardId)),
    excludePlayers: fan.map((c) => c.player),
    excludeSeries: fan.map((c) => c.series),
    // Per-team cap spans the whole page: seed the marquee with the fan's teams.
    maxPerTeam: MAX_PER_TEAM,
    teamCounts: teamTally(fan),
  });
  return { fan, marquee };
});
