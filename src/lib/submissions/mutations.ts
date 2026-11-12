"use client";

import { createClient } from "@/lib/supabase/client";

// User-facing crowdsourcing submissions (non-admin). These go into a pending
// queue that admins review at /admin/review. See db/app/015-017.

export interface CardEditInput {
  card_id: number;
  card_number: string | null;
  is_rookie: boolean;
  is_autograph: boolean;
  is_relic: boolean;
  is_short_print: boolean;
  print_run: number | null;
  notes: string | null;
  submission_notes?: string | null;
}

export async function submitCardEdit(p: CardEditInput): Promise<number> {
  const { data, error } = await createClient().rpc("submit_card_edit", {
    p_card_id: p.card_id,
    p_card_number: p.card_number,
    p_is_rookie: p.is_rookie,
    p_is_autograph: p.is_autograph,
    p_is_relic: p.is_relic,
    p_is_short_print: p.is_short_print,
    p_print_run: p.print_run,
    p_notes: p.notes,
    p_submission_notes: p.submission_notes ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function submitTeamEdit(p: {
  team_id: number; name: string | null; city: string | null; abbreviation: string | null;
  primary_color: string | null; secondary_color: string | null; submission_notes?: string | null;
}): Promise<number> {
  const { data, error } = await createClient().rpc("submit_team_edit", {
    p_team_id: p.team_id, p_name: p.name, p_city: p.city, p_abbreviation: p.abbreviation,
    p_primary_color: p.primary_color, p_secondary_color: p.secondary_color, p_submission_notes: p.submission_notes ?? null,
  });
  if (error) throw error;
  return data as number;
}

export interface MySubmission {
  type: string; submission_id: number; summary: string; status: string;
  created_at: string; reviewed_at: string | null; review_notes: string | null;
}
export async function mySubmissions(): Promise<MySubmission[]> {
  const { data, error } = await createClient().rpc("my_submissions");
  if (error) throw error;
  return (data ?? []) as MySubmission[];
}

export interface ContributorStats {
  total_submissions: number; pending_submissions: number; approved_submissions: number;
  rejected_submissions: number; trust_points: number; trust_level: string | null; approval_rate: number | null;
}
export async function myContributorStats(collectorId: number): Promise<ContributorStats | null> {
  const { data } = await createClient()
    .from("contributor_stats")
    .select("total_submissions, pending_submissions, approved_submissions, rejected_submissions, trust_points, trust_level, approval_rate")
    .eq("user_id", collectorId)
    .maybeSingle();
  return (data as ContributorStats) ?? null;
}

export async function submitSet(p: { name: string; year: number; sport?: string; manufacturer?: string | null; notes?: string | null }): Promise<number> {
  const { data, error } = await createClient().rpc("submit_set_submission", {
    p_name: p.name, p_year: p.year, p_sport: p.sport ?? "Baseball",
    p_manufacturer: p.manufacturer ?? null, p_description: null, p_notes: p.notes ?? null,
  });
  if (error) throw error;
  return data as number;
}

export async function submitPlayerEdit(p: {
  player_id: number; first_name: string | null; last_name: string | null; nick_name: string | null;
  is_hof: boolean; submission_notes?: string | null;
}): Promise<number> {
  const { data, error } = await createClient().rpc("submit_player_edit", {
    p_player_id: p.player_id, p_first_name: p.first_name, p_last_name: p.last_name,
    p_nick_name: p.nick_name, p_is_hof: p.is_hof, p_submission_notes: p.submission_notes ?? null,
  });
  if (error) throw error;
  return data as number;
}
