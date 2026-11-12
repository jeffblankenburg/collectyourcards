-- Crowdsourcing review queue (workstream #29, pass 2). Generic admin review for
-- all submission types + a unified pending-queue read. Approve APPLIES the change
-- for the edit/create flows we support (set create, card/team/player edits); the
-- two bulk-create flows (series, card) are reject-capable now, approve lands later.
-- Status changes fire the stats triggers from 015.

create or replace function public.review_submission(
  p_type text, p_submission_id bigint, p_approve boolean, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_admin  bigint := public.current_collector_id();
  v_tbl    text;
  v_status text := case when p_approve then 'approved' else 'rejected' end;
  v_cur    text;
  v_result jsonb := '{}'::jsonb;
begin
  perform public.assert_admin();
  v_tbl := case p_type
    when 'set' then 'set_submissions'           when 'series' then 'series_submissions'
    when 'card' then 'card_submissions'         when 'card_edit' then 'card_edit_submissions'
    when 'team_edit' then 'team_edit_submissions' when 'player_edit' then 'player_edit_submissions'
    else null end;
  if v_tbl is null then raise exception 'unknown submission type %', p_type; end if;

  execute format('select status from public.%I where submission_id = $1 for update', v_tbl)
    into v_cur using p_submission_id;
  if v_cur is null then raise exception 'submission % not found', p_submission_id using errcode='P0002'; end if;
  if v_cur <> 'pending' then raise exception 'submission already %', v_cur; end if;

  if p_approve then
    if p_type = 'set' then
      declare s record; nid int;
      begin
        select * into s from public.set_submissions where submission_id = p_submission_id;
        nid := public.admin_create_set(s.proposed_name, s.proposed_year, null, null);
        update public.set_submissions set created_set_id = nid where submission_id = p_submission_id;
        v_result := jsonb_build_object('created_set_id', nid);
      end;
    elsif p_type = 'card_edit' then
      declare s record;
      begin
        select * into s from public.card_edit_submissions where submission_id = p_submission_id;
        update public.card set
          card_number    = coalesce(s.proposed_card_number, card_number),
          is_rookie      = coalesce(s.proposed_is_rookie, is_rookie),
          is_autograph   = coalesce(s.proposed_is_autograph, is_autograph),
          is_relic       = coalesce(s.proposed_is_relic, is_relic),
          is_short_print = coalesce(s.proposed_is_short_print, is_short_print),
          print_run      = coalesce(s.proposed_print_run, print_run),
          notes          = coalesce(s.proposed_notes, notes)
        where card_id = s.card_id;
      end;
    elsif p_type = 'team_edit' then
      declare s record; t record;
      begin
        select * into s from public.team_edit_submissions where submission_id = p_submission_id;
        select name, abbreviation, organization_id, city, mascot, primary_color, secondary_color
          into t from public.team where team_id = s.team_id;
        perform public.admin_update_team(s.team_id,
          coalesce(s.proposed_name, t.name), coalesce(s.proposed_abbreviation, t.abbreviation),
          t.organization_id, coalesce(s.proposed_city, t.city), coalesce(s.proposed_mascot, t.mascot),
          coalesce(s.proposed_primary_color, t.primary_color), coalesce(s.proposed_secondary_color, t.secondary_color));
      end;
    elsif p_type = 'player_edit' then
      declare s record; pl record;
      begin
        select * into s from public.player_edit_submissions where submission_id = p_submission_id;
        select first_name, last_name, nick_name, birthdate, is_hof
          into pl from public.player where player_id = s.player_id;
        perform public.admin_update_player(s.player_id,
          coalesce(s.proposed_first_name, pl.first_name), coalesce(s.proposed_last_name, pl.last_name),
          coalesce(s.proposed_nick_name, pl.nick_name), coalesce(s.proposed_birthdate, pl.birthdate)::date,
          coalesce(s.proposed_is_hof, pl.is_hof));
      end;
    elsif p_type = 'series' then
      declare s record; nid bigint;
      begin
        select * into s from public.series_submissions where submission_id = p_submission_id;
        nid := public.admin_create_series(
          s.proposed_name, s.set_id, null, not coalesce(s.proposed_is_parallel, false),
          s.proposed_parallel_of_series, s.proposed_print_run, null, null, null, null,
          coalesce(s.proposed_base_card_count, 0));
        update public.series_submissions set created_series_id = nid where submission_id = p_submission_id;
        v_result := jsonb_build_object('created_series_id', nid);
      end;
    elsif p_type = 'card' then
      declare s record; nid bigint; v_players jsonb := '[]'::jsonb;
      begin
        select * into s from public.card_submissions where submission_id = p_submission_id;
        -- matched_*_ids are comma-separated varchar; pair them positionally, tolerate junk.
        begin
          select coalesce(jsonb_agg(jsonb_build_object('player_id', q.pid::bigint, 'team_id', q.tid::bigint)), '[]'::jsonb)
            into v_players
          from (
            select trim(p.v) pid, trim(t.v) tid
              from unnest(string_to_array(s.matched_player_ids, ',')) with ordinality p(v, o)
              join unnest(string_to_array(s.matched_team_ids, ',')) with ordinality t(v, o) using (o)
             where trim(p.v) ~ '^\d+$' and trim(t.v) ~ '^\d+$'
          ) q;
        exception when others then v_players := '[]'::jsonb;
        end;
        nid := public.admin_upsert_card(null, s.series_id, s.proposed_card_number,
          coalesce(s.proposed_is_rookie, false), coalesce(s.proposed_is_autograph, false),
          coalesce(s.proposed_is_relic, false), coalesce(s.proposed_is_short_print, false),
          s.proposed_print_run, null, null, s.proposed_notes, v_players);
        update public.card_submissions set created_card_id = nid where submission_id = p_submission_id;
        v_result := jsonb_build_object('created_card_id', nid);
      end;
    else
      raise exception 'approve not supported for type %', p_type;
    end if;
  end if;

  execute format('update public.%I set status=$1, reviewed_by=$2, reviewed_at=now(), review_notes=$3, updated_at=now() where submission_id=$4', v_tbl)
    using v_status, v_admin, p_notes, p_submission_id;

  return v_result || jsonb_build_object('submission_id', p_submission_id, 'type', p_type, 'status', v_status);
end $$;
grant execute on function public.review_submission(text,bigint,boolean,text) to authenticated;

-- Unified pending queue for the admin review page (admin-only).
create or replace function public.pending_submissions()
returns table(type text, submission_id bigint, user_id bigint, summary text, notes text, created_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return query
    select 'set'::text, s.submission_id, s.user_id,
           s.proposed_name || ' (' || s.proposed_year || ')', s.submission_notes, s.created_at
      from public.set_submissions s where s.status = 'pending'
    union all
    select 'card_edit', s.submission_id, s.user_id,
           'Card #' || s.card_id || ' → #' || coalesce(s.proposed_card_number, '—'), s.submission_notes, s.created_at
      from public.card_edit_submissions s where s.status = 'pending'
    union all
    select 'team_edit', s.submission_id, s.user_id,
           'Team #' || s.team_id || coalesce(' → ' || s.proposed_name, ''), s.submission_notes, s.created_at
      from public.team_edit_submissions s where s.status = 'pending'
    union all
    select 'player_edit', s.submission_id, s.user_id,
           'Player #' || s.player_id || ' → ' || trim(coalesce(s.proposed_first_name, '') || ' ' || coalesce(s.proposed_last_name, '')),
           s.submission_notes, s.created_at
      from public.player_edit_submissions s where s.status = 'pending'
    union all
    select 'series', s.submission_id, s.user_id, coalesce(s.proposed_name, '(series)'), s.submission_notes, s.created_at
      from public.series_submissions s where s.status = 'pending'
    union all
    select 'card', s.submission_id, s.user_id, coalesce(s.proposed_card_number, '(card)'), s.submission_notes, s.created_at
      from public.card_submissions s where s.status = 'pending'
    order by 6;
end $$;
grant execute on function public.pending_submissions() to authenticated;
