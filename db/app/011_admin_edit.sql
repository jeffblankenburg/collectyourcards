-- Admin edit/cleanup RPCs beyond create/update: merge duplicate players and
-- delete catalog cards. DEFINER + assert_admin(), granted to authenticated.
-- Re-apply via `npm run db:app`.

-- Merge the duplicate player p_dup INTO p_keep: move its team links and card
-- associations to p_keep, repoint follows, delete the duplicate, then recompute
-- affected counts from scratch (robust vs the insert/delete-only count triggers,
-- which don't fire on the UPDATE repoints below).
create or replace function public.admin_merge_player(p_keep bigint, p_dup bigint)
returns void language plpgsql security definer set search_path = public as $$
declare r record; v_keep_pt bigint;
begin
  perform public.assert_admin();
  if p_keep = p_dup then raise exception 'cannot merge a player into itself' using errcode='22023'; end if;
  if not exists (select 1 from public.player where player_id = p_keep) then raise exception 'keep player % not found', p_keep using errcode='P0002'; end if;

  -- For each team the dup is on, ensure keep has the same player_team, then move
  -- that player_team's card links to keep's (skipping links keep already has).
  for r in select player_team_id, team_id from public.player_team where player_id = p_dup loop
    v_keep_pt := public.find_or_create_player_team(p_keep, r.team_id);
    update public.card_player_team cpt set player_team_id = v_keep_pt
      where cpt.player_team_id = r.player_team_id
        and not exists (select 1 from public.card_player_team c2 where c2.card_id = cpt.card_id and c2.player_team_id = v_keep_pt);
    delete from public.card_player_team where player_team_id = r.player_team_id;  -- leftover dup links
    delete from public.player_team where player_team_id = r.player_team_id;
  end loop;

  -- Repoint user follows + clean dup-only references.
  update public.user_player up set player_id = p_keep
    where up.player_id = p_dup and not exists (select 1 from public.user_player u2 where u2.user_id = up.user_id and u2.player_id = p_keep);
  delete from public.user_player where player_id = p_dup;
  delete from public.duplicate_player_member where player_id = p_dup;
  delete from public.duplicate_exclusion where player1_id = p_dup or player2_id = p_dup;
  delete from public.player_edit_submissions where player_id = p_dup;
  update public.player set display_card_id = null where player_id = p_dup; -- avoid self-ref on delete

  delete from public.player where player_id = p_dup;

  -- Recompute counts for keep + its player_teams + the teams involved.
  update public.player_team pt set card_count = (select count(*) from public.card_player_team c where c.player_team_id = pt.player_team_id)
    where pt.player_id = p_keep;
  update public.player set card_count = (
      select count(*) from public.card_player_team c join public.player_team pt on pt.player_team_id = c.player_team_id where pt.player_id = p_keep)
    where player_id = p_keep;
  update public.team t set card_count = (
      select count(*) from public.card_player_team c join public.player_team pt on pt.player_team_id = c.player_team_id where pt.team_id = t.team_id)
    where t.team_id in (select team_id from public.player_team where player_id = p_keep);

  perform public.log_admin('merge','player', p_dup::text, null, jsonb_build_object('into', p_keep));
end; $$;
grant execute on function public.admin_merge_player(bigint,bigint) to authenticated;

-- Delete a catalog card. Blocked if anyone owns it or it's in a sale (would orphan
-- real data). Removes dependent links first so FKs don't block; triggers keep
-- series/player/team counts correct on the cpt + card deletes.
create or replace function public.admin_delete_card(p_card_id bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_owned int; v_sold int;
begin
  perform public.assert_admin();
  select count(*) into v_owned from public.user_card where card_id = p_card_id;
  if v_owned > 0 then raise exception 'card % is in % collection(s); remove it from collections first', p_card_id, v_owned using errcode='23503'; end if;
  select count(*) into v_sold from public.sale where card_id = p_card_id;
  if v_sold > 0 then raise exception 'card % is referenced by % sale(s)', p_card_id, v_sold using errcode='23503'; end if;

  update public.player set display_card_id = null where display_card_id = p_card_id;
  delete from public.card_variation where card_id = p_card_id;
  delete from public.card_player_team where card_id = p_card_id;   -- triggers decrement counts
  delete from public.card where card_id = p_card_id;               -- trigger decrements series.card_entered_count
  perform public.log_admin('delete','card', p_card_id::text, null, null);
end; $$;
grant execute on function public.admin_delete_card(bigint) to authenticated;
