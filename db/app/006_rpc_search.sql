-- Search + catalog + collection RPCs. PostgREST can't express the 4-table card
-- join, so the UI calls these. Shapes mirror the old app's payloads.

-- ---------------------------------------------------------------------------
-- Unified entity search (players/teams/sets/series) for the global search box.
-- Trigram candidates (typo-tolerant) + prefix boost, tie-broken by card_count.
-- Returns one jsonb object: { players:[], teams:[], sets:[], series:[] }.
-- ---------------------------------------------------------------------------
create or replace function public.search_entities(q text, lim int default 8)
returns jsonb
language sql stable security definer set search_path = public as $$
  with needle as (select lower(unaccent(coalesce(q,''))) as n),
  players as (
    select jsonb_build_object(
      'player_id', p.player_id, 'first_name', p.first_name, 'last_name', p.last_name,
      'nick_name', p.nick_name, 'slug', p.slug, 'is_hof', p.is_hof, 'card_count', p.card_count,
      'teams', coalesce((
        select jsonb_agg(distinct jsonb_build_object(
          'team_id', t.team_id, 'abbreviation', t.abbreviation,
          'primary_color', t.primary_color, 'secondary_color', t.secondary_color))
        from player_team pt join team t on t.team_id = pt.team_id
        where pt.player_id = p.player_id), '[]'::jsonb)
    ) j
    from player p, needle
    where lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) % n
       or lower(coalesce(p.last_name,'')) like n || '%'
    order by (lower(coalesce(p.last_name,'')) like n || '%') desc,
             similarity(lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')), n) desc,
             p.card_count desc nulls last
    limit lim
  ),
  teams as (
    select jsonb_build_object(
      'team_id', t.team_id, 'name', t.name, 'city', t.city, 'abbreviation', t.abbreviation,
      'primary_color', t.primary_color, 'secondary_color', t.secondary_color,
      'card_count', t.card_count, 'player_count', t.player_count, 'slug', t.slug
    ) j
    from team t, needle
    where lower(coalesce(t.city,'')||' '||coalesce(t.name,'')) % n
       or lower(coalesce(t.name,'')) like n || '%'
    order by (lower(coalesce(t.name,'')) like n || '%') desc,
             similarity(lower(coalesce(t.city,'')||' '||coalesce(t.name,'')), n) desc,
             t.card_count desc nulls last
    limit lim
  ),
  sets as (
    select jsonb_build_object(
      'set_id', s.set_id, 'name', s.name, 'year', s.year, 'slug', s.slug,
      'card_count', s.card_count, 'series_count', s.series_count
    ) j
    from set s, needle
    where lower(coalesce(s.name,'')) % n or lower(coalesce(s.name,'')) like n || '%'
    order by (lower(coalesce(s.name,'')) like n || '%') desc,
             similarity(lower(coalesce(s.name,'')), n) desc, s.year desc nulls last
    limit lim
  ),
  series_r as (
    select jsonb_build_object(
      'series_id', se.series_id, 'name', se.name, 'slug', se.slug, 'card_count', se.card_count,
      'is_parallel', (se.is_base is distinct from true), 'print_run', se.print_run_display,
      'set', jsonb_build_object('set_id', st.set_id, 'name', st.name, 'year', st.year, 'slug', st.slug)
    ) j
    from series se join set st on st.set_id = se.set_id, needle
    where lower(coalesce(se.name,'')) % n or lower(coalesce(se.name,'')) like n || '%'
    order by (lower(coalesce(se.name,'')) like n || '%') desc,
             similarity(lower(coalesce(se.name,'')), n) desc, se.card_count desc nulls last
    limit lim
  )
  select jsonb_build_object(
    'players', coalesce((select jsonb_agg(j) from players), '[]'::jsonb),
    'teams',   coalesce((select jsonb_agg(j) from teams), '[]'::jsonb),
    'sets',    coalesce((select jsonb_agg(j) from sets), '[]'::jsonb),
    'series',  coalesce((select jsonb_agg(j) from series_r), '[]'::jsonb)
  );
$$;
grant execute on function public.search_entities(text,int) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- A single card as a rich jsonb object (shared shape for detail + lists).
-- ---------------------------------------------------------------------------
create or replace function public.card_json(p_card_id bigint)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'card_id', c.card_id, 'card_number', c.card_number,
    'is_rookie', c.is_rookie, 'is_autograph', c.is_autograph, 'is_relic', c.is_relic,
    'is_short_print', c.is_short_print, 'print_run', c.print_run, 'sort_order', c.sort_order,
    'notes', c.notes, 'front_image_path', c.front_image_path, 'back_image_path', c.back_image_path,
    'color', case when col.color_id is null then null else
      jsonb_build_object('name', col.name, 'hex', col.hex_value) end,
    'series', jsonb_build_object('series_id', se.series_id, 'name', se.name, 'slug', se.slug,
                                 'is_parallel', (se.is_base is distinct from true), 'print_run', se.print_run_display),
    'set', jsonb_build_object('set_id', st.set_id, 'name', st.name, 'year', st.year, 'slug', st.slug),
    'players', coalesce((
      select jsonb_agg(distinct jsonb_build_object(
        'player_id', p.player_id, 'first_name', p.first_name, 'last_name', p.last_name, 'slug', p.slug,
        'team', jsonb_build_object('team_id', t.team_id, 'name', t.name, 'abbreviation', t.abbreviation,
                                   'primary_color', t.primary_color, 'secondary_color', t.secondary_color)))
      from card_player_team cpt
      join player_team pt on pt.player_team_id = cpt.player_team_id
      join player p on p.player_id = pt.player_id
      join team t on t.team_id = pt.team_id
      where cpt.card_id = c.card_id), '[]'::jsonb)
  )
  from card c
  join series se on se.series_id = c.series_id
  join set st on st.set_id = se.set_id
  left join color col on col.color_id = c.color_id
  where c.card_id = p_card_id;
$$;
grant execute on function public.card_json(bigint) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cards scoped by an indexed parent (series/player/team), keyset-paginated.
-- Always scoped so we never seq-scan 1M+ cards. Optional p_q AND-matches tokens
-- against the card_search_mv blob (card #, players, teams, color…) within the
-- already-narrow parent scope — powers "find Ohtani in this series".
-- (Signature grew a 6th arg; drop the old 5-arg overload so re-apply is clean.)
-- ---------------------------------------------------------------------------
drop function if exists public.card_search(bigint,bigint,bigint,int,bigint);
create or replace function public.card_search(
  p_series_id bigint default null,
  p_player_id bigint default null,
  p_team_id   bigint default null,
  p_limit     int    default 60,
  p_after     bigint default null,  -- keyset: last card_id from the previous page
  p_q         text   default null   -- optional free-text filter within the scope
) returns setof jsonb
language sql stable security definer set search_path = public as $$
  with toks as (
    select (array(
      select tok from unnest(regexp_split_to_array(lower(unaccent(coalesce(p_q,''))), '\s+')) tok
      where length(tok) >= 2
    ))[1:5] as t
  )
  select public.card_json(c.card_id)
  from card c, toks
  where (p_after is null or c.card_id > p_after)
    and (p_series_id is null or c.series_id = p_series_id)
    and (p_player_id is null or exists (
          select 1 from card_player_team cpt join player_team pt on pt.player_team_id = cpt.player_team_id
          where cpt.card_id = c.card_id and pt.player_id = p_player_id))
    and (p_team_id is null or exists (
          select 1 from card_player_team cpt join player_team pt on pt.player_team_id = cpt.player_team_id
          where cpt.card_id = c.card_id and pt.team_id = p_team_id))
    and (coalesce(array_length(toks.t,1),0) = 0 or exists (
          select 1 from card_search_mv m
          where m.card_id = c.card_id
            and (array_length(toks.t,1) < 1 or m.search_text like '%'||toks.t[1]||'%')
            and (array_length(toks.t,1) < 2 or m.search_text like '%'||toks.t[2]||'%')
            and (array_length(toks.t,1) < 3 or m.search_text like '%'||toks.t[3]||'%')
            and (array_length(toks.t,1) < 4 or m.search_text like '%'||toks.t[4]||'%')
            and (array_length(toks.t,1) < 5 or m.search_text like '%'||toks.t[5]||'%')))
  order by c.card_id
  limit greatest(1, least(p_limit, 200));
$$;
grant execute on function public.card_search(bigint,bigint,bigint,int,bigint,text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Collection: owner-scoped by RLS (SECURITY INVOKER). Returns the user's cards
-- with catalog join + their personal fields + primary photo. sold cards excluded.
-- ---------------------------------------------------------------------------
create or replace function public.collection_list(
  p_limit int default 50,
  p_after bigint default null,       -- keyset on user_card_id
  p_series_id bigint default null,
  p_set_id bigint default null,
  p_team_id bigint default null,
  p_location_id bigint default null,
  p_rookie boolean default null,
  p_autograph boolean default null,
  p_relic boolean default null,
  p_graded boolean default null
) returns setof jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'user_card_id', uc.user_card_id, 'serial_number', uc.serial_number,
    'purchase_price', uc.purchase_price, 'estimated_value', uc.estimated_value, 'current_value', uc.current_value,
    'grade', uc.grade, 'grading_agency', ga.abbreviation, 'aftermarket_autograph', uc.aftermarket_autograph,
    'is_for_sale', uc.is_for_sale, 'is_special', uc.is_special, 'notes', uc.notes,
    'location', ul.location, 'created', uc.created,
    'primary_photo_url', (select ph.photo_url from user_card_photo ph
                          where ph.user_card_id = uc.user_card_id order by ph.sort_order limit 1),
    'card', public.card_json(uc.card_id)
  )
  from user_card uc
  join card c on c.card_id = uc.card_id
  left join grading_agency ga on ga.grading_agency_id = uc.grading_agency
  left join user_location ul on ul.user_location_id = uc.user_location_id
  where uc.sold_at is null
    and (p_after is null or uc.user_card_id > p_after)
    and (p_series_id is null or c.series_id = p_series_id)
    and (p_set_id is null or c.series_id in (select series_id from series where set_id = p_set_id))
    and (p_location_id is null or uc.user_location_id = p_location_id)
    and (p_rookie is null or c.is_rookie = p_rookie)
    and (p_autograph is null or c.is_autograph = p_autograph)
    and (p_relic is null or c.is_relic = p_relic)
    and (p_graded is null or (uc.grade is not null) = p_graded)
    and (p_team_id is null or exists (
          select 1 from card_player_team cpt join player_team pt on pt.player_team_id = cpt.player_team_id
          where cpt.card_id = c.card_id and pt.team_id = p_team_id))
  order by uc.user_card_id
  limit greatest(1, least(p_limit, 200));
$$;
grant execute on function public.collection_list(int,bigint,bigint,bigint,bigint,bigint,boolean,boolean,boolean,boolean) to authenticated;

-- Collection headline stats for the signed-in user (owner-scoped by RLS).
create or replace function public.collection_totals()
returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'count', count(*),
    'total_purchase', coalesce(sum(uc.purchase_price),0),
    'total_estimated', coalesce(sum(uc.estimated_value),0),
    'total_value', coalesce(sum(coalesce(uc.current_value, uc.estimated_value)),0),
    'rookies', count(*) filter (where c.is_rookie),
    'autographs', count(*) filter (where c.is_autograph),
    'relics', count(*) filter (where c.is_relic),
    'graded', count(*) filter (where uc.grade is not null),
    'unique_series', count(distinct c.series_id)
  )
  from user_card uc join card c on c.card_id = uc.card_id
  where uc.sold_at is null;
$$;
grant execute on function public.collection_totals() to authenticated;
