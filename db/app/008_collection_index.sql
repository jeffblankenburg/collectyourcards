-- The whole collection, once. Returns the caller's full UNSOLD collection as one
-- compact jsonb array — short keys + epoch dates keep the wire payload small
-- (~700-850KB gzipped for ~12.6k cards). The app loads this ONCE and does all
-- filter/sort/search/group client-side (instant). SECURITY INVOKER (default) so
-- the owner-only RLS on user_card scopes rows to the caller.
--
-- Re-apply via `npm run db:app`. Dropped+cascaded by a `migration/` run like 002-007.
create or replace function public.collection_index()
returns jsonb
language sql
stable
set search_path = public
as $$
  select coalesce(jsonb_agg(r order by (r->>'cr')::bigint desc), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'i',   uc.user_card_id,
      'c',   uc.card_id,
      'n',   c.card_number,
      'sn',  uc.serial_number,
      'pr',  c.print_run,
      'g',   uc.grade,
      'ga',  ga.abbreviation,
      'gid', uc.grade_id,
      'pp',  uc.purchase_price,
      'ev',  uc.estimated_value,
      'cv',  uc.current_value,
      'li',  uc.user_location_id,
      'ln',  ul.location,
      'sp',  uc.is_special,
      'fs',  uc.is_for_sale,
      'wd',  uc.is_wanted,
      'af',  uc.aftermarket_autograph,
      'rc',  uc.random_code,
      'nt',  uc.notes,
      'rk',  c.is_rookie,
      'au',  c.is_autograph,
      'rl',  c.is_relic,
      'sh',  c.is_short_print,
      'cl',  col.name,
      'cx',  col.hex_value,
      'se',  se.name,
      'sid', se.series_id,
      'sg',  se.slug,
      'st',  stt.name,
      'stid',stt.set_id,
      'yr',  stt.year,
      'cr',  (extract(epoch from uc.created))::bigint,
      'pc',  (select count(*) from user_card_photo ph where ph.user_card_id = uc.user_card_id),
      'pu',  (select ph.photo_url from user_card_photo ph
              where ph.user_card_id = uc.user_card_id
              order by ph.sort_order nulls last, ph.user_card_photo_id limit 1),
      'pl',  coalesce((
               select jsonb_agg(jsonb_build_object(
                        'p', p.player_id, 'f', p.first_name, 'l', p.last_name,
                        't', t.team_id, 'ta', t.abbreviation,
                        'tp', t.primary_color, 'ts', t.secondary_color))
               from card_player_team cpt
               join player_team pt on pt.player_team_id = cpt.player_team_id
               join player p on p.player_id = pt.player_id
               join team t on t.team_id = pt.team_id
               where cpt.card_id = c.card_id), '[]'::jsonb)
    ) as r
    from user_card uc
    join card c    on c.card_id = uc.card_id
    join series se on se.series_id = c.series_id
    join set stt   on stt.set_id = se.set_id
    left join color col         on col.color_id = c.color_id
    left join grading_agency ga on ga.grading_agency_id = uc.grading_agency
    left join user_location ul  on ul.user_location_id = uc.user_location_id
    where uc.sold_at is null   -- RLS already restricts uc.user_id to the caller
  ) s;
$$;
grant execute on function public.collection_index() to authenticated;
