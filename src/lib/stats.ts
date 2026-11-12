import "server-only";
import { sbPublic } from "@/lib/supabase/public";

export interface DatabaseStats {
  cards: number;
  players: number;
  teams: number;
}

// Live published-catalog counts for the home hero. Mirrors the old app's
// /api/database-stats (exact COUNT(*) of card/player/team). `use cache` keeps the
// count off the request path — cookie-less sbPublic makes it cache-safe. Fallback
// to the last-known figures if the RPC ever errors, so the hero never shows zeros.
export async function getDatabaseStats(): Promise<DatabaseStats> {
  "use cache";
  const { data, error } = await sbPublic.rpc("database_stats").single<DatabaseStats>();
  if (error || !data) return { cards: 1_023_674, players: 9_735, teams: 330 };
  return {
    cards: Number(data.cards),
    players: Number(data.players),
    teams: Number(data.teams),
  };
}

// Compact figures for the stat row: 1.0M / 48K / 9,735 / 330.
export function formatStat(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return n.toLocaleString("en-US");
}
