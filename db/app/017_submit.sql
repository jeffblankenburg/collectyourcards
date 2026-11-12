-- User-facing submission RPCs (workstream #29, pass 3). Client-friendly wrappers
-- that stamp user_id from current_collector_id() and snapshot the current values
-- into previous_* so the review diff is self-contained. Status starts 'pending'
-- (the 015 insert trigger bumps contributor_stats).

create or replace function public.submit_card_edit(
  p_card_id bigint, p_card_number text, p_is_rookie boolean, p_is_autograph boolean,
  p_is_relic boolean, p_is_short_print boolean, p_print_run int, p_notes text,
  p_submission_notes text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_me bigint := public.current_collector_id(); cur record;
begin
  if v_me is null then raise exception 'must be signed in'; end if;
  select card_number, is_rookie, is_autograph, is_relic, is_short_print, print_run, notes
    into cur from public.card where card_id = p_card_id;
  if not found then raise exception 'card % not found', p_card_id using errcode='P0002'; end if;
  if exists (select 1 from public.card_edit_submissions
              where card_id = p_card_id and user_id = v_me and status = 'pending') then
    raise exception 'you already have a pending edit for this card';
  end if;
  insert into public.card_edit_submissions (
    card_id, user_id,
    proposed_card_number, proposed_is_rookie, proposed_is_autograph, proposed_is_relic,
    proposed_is_short_print, proposed_print_run, proposed_notes,
    previous_card_number, previous_is_rookie, previous_is_autograph, previous_is_relic,
    previous_is_short_print, previous_print_run, previous_notes,
    submission_notes, status, created_at)
  values (
    p_card_id, v_me,
    p_card_number, p_is_rookie, p_is_autograph, p_is_relic, p_is_short_print, p_print_run, p_notes,
    cur.card_number, cur.is_rookie, cur.is_autograph, cur.is_relic, cur.is_short_print, cur.print_run, cur.notes,
    p_submission_notes, 'pending', now())
  returning submission_id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_card_edit(bigint,text,boolean,boolean,boolean,boolean,int,text,text) to authenticated;

create or replace function public.submit_team_edit(
  p_team_id int, p_name text, p_city text, p_abbreviation text,
  p_primary_color text, p_secondary_color text, p_submission_notes text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_me bigint := public.current_collector_id(); cur record;
begin
  if v_me is null then raise exception 'must be signed in'; end if;
  select name, city, mascot, abbreviation, primary_color, secondary_color
    into cur from public.team where team_id = p_team_id;
  if not found then raise exception 'team % not found', p_team_id using errcode='P0002'; end if;
  if exists (select 1 from public.team_edit_submissions
              where team_id = p_team_id and user_id = v_me and status = 'pending') then
    raise exception 'you already have a pending edit for this team';
  end if;
  insert into public.team_edit_submissions (
    team_id, user_id,
    proposed_name, proposed_city, proposed_abbreviation, proposed_primary_color, proposed_secondary_color,
    previous_name, previous_city, previous_mascot, previous_abbreviation, previous_primary_color, previous_secondary_color,
    submission_notes, status, created_at)
  values (
    p_team_id, v_me,
    p_name, p_city, p_abbreviation, p_primary_color, p_secondary_color,
    cur.name, cur.city, cur.mascot, cur.abbreviation, cur.primary_color, cur.secondary_color,
    p_submission_notes, 'pending', now())
  returning submission_id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_team_edit(int,text,text,text,text,text,text) to authenticated;

create or replace function public.submit_player_edit(
  p_player_id bigint, p_first_name text, p_last_name text, p_nick_name text,
  p_is_hof boolean, p_submission_notes text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_me bigint := public.current_collector_id(); cur record;
begin
  if v_me is null then raise exception 'must be signed in'; end if;
  select first_name, last_name, nick_name, birthdate, is_hof
    into cur from public.player where player_id = p_player_id;
  if not found then raise exception 'player % not found', p_player_id using errcode='P0002'; end if;
  if exists (select 1 from public.player_edit_submissions
              where player_id = p_player_id and user_id = v_me and status = 'pending') then
    raise exception 'you already have a pending edit for this player';
  end if;
  insert into public.player_edit_submissions (
    player_id, user_id,
    proposed_first_name, proposed_last_name, proposed_nick_name, proposed_is_hof,
    previous_first_name, previous_last_name, previous_nick_name, previous_birthdate, previous_is_hof,
    submission_notes, status, created_at)
  values (
    p_player_id, v_me,
    p_first_name, p_last_name, p_nick_name, p_is_hof,
    cur.first_name, cur.last_name, cur.nick_name, cur.birthdate, cur.is_hof,
    p_submission_notes, 'pending', now())
  returning submission_id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_player_edit(bigint,text,text,text,boolean,text) to authenticated;

-- The caller's own submissions across every type, for the "my submissions" page.
create or replace function public.my_submissions()
returns table(type text, submission_id bigint, summary text, status text,
              created_at timestamptz, reviewed_at timestamptz, review_notes text)
language plpgsql stable security definer set search_path = public as $$
declare v_me bigint := public.current_collector_id();
begin
  if v_me is null then return; end if;
  return query
    select 'set'::text, s.submission_id, (s.proposed_name || ' (' || s.proposed_year || ')')::text,
           s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.set_submissions s where s.user_id = v_me
    union all
    select 'card_edit', s.submission_id, ('Card #' || s.card_id)::text, s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.card_edit_submissions s where s.user_id = v_me
    union all
    select 'team_edit', s.submission_id, ('Team #' || s.team_id)::text, s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.team_edit_submissions s where s.user_id = v_me
    union all
    select 'player_edit', s.submission_id, ('Player #' || s.player_id)::text, s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.player_edit_submissions s where s.user_id = v_me
    union all
    select 'series', s.submission_id, coalesce(s.proposed_name, '(series)')::text, s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.series_submissions s where s.user_id = v_me
    union all
    select 'card', s.submission_id, coalesce(s.proposed_card_number, '(card)')::text, s.status::text, s.created_at, s.reviewed_at, s.review_notes
      from public.card_submissions s where s.user_id = v_me
    order by 5 desc;
end $$;
grant execute on function public.my_submissions() to authenticated;
