-- Public view sharing: serve a saved view's cards to ANYONE with the link
-- (/v/<token>), no account needed, re-running the view's filters/sort/search
-- against the owner's LIVE collection. These functions are SECURITY DEFINER and
-- bypass RLS, so the ONLY protection against leaking private fields is the
-- hand-picked column set in public_user_card_json — never widen it.
-- Re-apply via `npm run db:app`.

-- ---------------------------------------------------------------------------
-- The single public-safe card projection. Card identity (via card_json, which is
-- already price/value/location-free) + condition fields only. NO purchase_price,
-- estimated/current value, location, notes, random_code, is_wanted. This is the
-- one audited chokepoint for both shared views and public profiles.
-- NOT granted to anon/authenticated directly (would let anyone enumerate any
-- collector's cards by user_card_id); only the gated DEFINER callers below use it.
-- ---------------------------------------------------------------------------
create or replace function public.public_user_card_json(p_user_card_id bigint)
returns jsonb
language sql stable security definer set search_path = public as $$
  select public.card_json(uc.card_id) || jsonb_build_object(
    'user_card_id',      uc.user_card_id,
    'serial_number',     uc.serial_number,
    'grade',             uc.grade,
    'grading_agency',    ga.abbreviation,
    'is_favorite',       uc.is_special,
    'primary_photo_url', (select ph.photo_url from user_card_photo ph
                          where ph.user_card_id = uc.user_card_id
                          order by ph.sort_order nulls last, ph.user_card_photo_id limit 1)
  )
  from user_card uc
  left join grading_agency ga on ga.grading_agency_id = uc.grading_agency
  where uc.user_card_id = p_user_card_id;
$$;
revoke all on function public.public_user_card_json(bigint) from public;

-- ---------------------------------------------------------------------------
-- Live cards for a shared view. Returns null if the token is unknown, or the
-- view is private and the caller isn't the owner (owner-preview allowed). Public
-- visitors get the public-safe slice, filters applied, and private sort keys
-- (price/location) downgraded to newest-first (ordering by price leaks ordinal
-- value even when values are hidden). Capped at 500 (truncated flag) — no
-- pagination, matching the "load once" collection architecture.
-- ---------------------------------------------------------------------------
create or replace function public.public_view_cards(
  p_token text,
  p_limit int default 500,
  p_after text default null   -- reserved for future keyset; unused in v1
) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
  v_me bigint := public.current_collector_id();
  v_is_owner boolean;
  cfg jsonb;
  f jsonb;
  v_team_ids bigint[];
  v_set_id bigint;
  v_loc_nonzero bigint[];
  v_has_unassigned boolean;
  v_tokens text[];
  v_key text;
  v_dir text;
  v_order text;
  v_cap int := greatest(1, least(coalesce(p_limit, 500), 500));
  v_sql text;
  v_cards jsonb;
  v_owner_profile record;
begin
  select saved_view_id, user_id, name, is_public, config
    into v from public.saved_view where share_token = p_token;
  if not found then return null; end if;

  v_is_owner := v_me is not distinct from v.user_id;
  if not coalesce(v.is_public, false) and not v_is_owner then
    return null;   -- private view, not the caller's
  end if;

  cfg := coalesce(v.config, '{}'::jsonb);
  f   := coalesce(cfg->'filters', '{}'::jsonb);

  -- Parse filters (absent/empty => inactive).
  v_team_ids := case when jsonb_array_length(coalesce(f->'teamIds','[]'::jsonb)) > 0
                     then (select array_agg((e)::bigint) from jsonb_array_elements_text(f->'teamIds') e) end;
  v_set_id   := nullif(f->>'setId','')::bigint;
  v_loc_nonzero := case when jsonb_array_length(coalesce(f->'locationIds','[]'::jsonb)) > 0
                        then (select array_agg((e)::bigint) from jsonb_array_elements_text(f->'locationIds') e
                              where (e)::bigint <> 0) end;
  v_has_unassigned := coalesce((select bool_or((e)::bigint = 0) from jsonb_array_elements_text(coalesce(f->'locationIds','[]'::jsonb)) e), false);
  v_tokens := (select array_agg(tok) from unnest(
                 regexp_split_to_array(lower(unaccent(coalesce(cfg->>'search',''))), '\s+')) tok
               where length(tok) >= 2);
  v_tokens := coalesce(v_tokens, '{}'::text[]);

  -- Sort key + direction. Downgrade private keys for public visitors.
  v_key := coalesce(cfg->'sort'->>'key', 'cr');
  v_dir := case when lower(coalesce(cfg->'sort'->>'dir','desc')) = 'asc' then 'asc' else 'desc' end;
  if not v_is_owner and v_key in ('pp','ev','cv','ln') then v_key := 'cr'; v_dir := 'desc'; end if;

  v_order := case v_key
    when 'cr'     then 'created'
    when 'n'      then 'num_sort'
    when 'player' then 'player_sort'
    when 'se'     then 'series_sort'
    when 'sn'     then 'serial_number'
    when 'cl'     then 'color_sort'
    when 'g'      then 'grade'
    when 'pc'     then 'photo_count'
    when 'pp'     then 'purchase_price'
    when 'ev'     then 'estimated_value'
    when 'cv'     then 'current_value'
    when 'ln'     then 'location_sort'
    else 'created' end;

  -- Static query text (filters via params; only the validated order expr + dir
  -- are interpolated). % chars in LIKE patterns are safe here (plain ||, not format()).
  v_sql :=
    'with src as ( '
 || '  select uc.user_card_id, uc.created, '
 || '    coalesce(uc.serial_number, -1) as serial_number, '
 || '    coalesce(uc.grade, -1) as grade, '
 || '    coalesce(uc.purchase_price, -1) as purchase_price, '
 || '    coalesce(uc.estimated_value, -1) as estimated_value, '
 || '    coalesce(uc.current_value, -1) as current_value, '
 || '    coalesce(nullif(regexp_replace(coalesce(c.card_number,''''),''\D'','''',''g''),'''')::bigint, 9223372036854775807) as num_sort, '
 || '    lower(coalesce(se.name,'''')) as series_sort, '
 || '    lower(coalesce(col.name,'''')) as color_sort, '
 || '    lower(coalesce(ul.location,'''')) as location_sort, '
 || '    lower(coalesce(pl.last_name, pl.first_name, '''')) as player_sort, '
 || '    (select count(*) from user_card_photo ph where ph.user_card_id = uc.user_card_id) as photo_count, '
 || '    lower(unaccent( '
 || '      coalesce(c.card_number,'''')||'' ''||coalesce(se.name,'''')||'' ''||coalesce(st.name,'''')||'' ''|| '
 || '      coalesce(col.name,'''')||'' ''||coalesce(uc.serial_number::text,'''')||'' ''||coalesce(uc.grade::text,'''')||'' ''|| '
 || '      coalesce(ga.abbreviation,'''')||'' ''|| '
 || '      case when $14 then coalesce(uc.notes,'''')||'' ''||coalesce(ul.location,'''') else '''' end ||'' ''|| '
 || '      coalesce((select string_agg(distinct lower(coalesce(p.first_name,'''')||'' ''||coalesce(p.last_name,'''')||'' ''||coalesce(t.name,'''')||'' ''||coalesce(t.abbreviation,'''')), '' '') '
 || '        from card_player_team cpt join player_team pt on pt.player_team_id = cpt.player_team_id '
 || '        join player p on p.player_id = pt.player_id join team t on t.team_id = pt.team_id '
 || '        where cpt.card_id = c.card_id), '''') '
 || '    )) as hay '
 || '  from user_card uc '
 || '  join card c   on c.card_id = uc.card_id '
 || '  join series se on se.series_id = c.series_id '
 || '  join set st    on st.set_id = se.set_id '
 || '  left join color col on col.color_id = c.color_id '
 || '  left join grading_agency ga on ga.grading_agency_id = uc.grading_agency '
 || '  left join user_location ul on ul.user_location_id = uc.user_location_id '
 || '  left join lateral ( '
 || '    select p.first_name, p.last_name from card_player_team cpt '
 || '    join player_team pt on pt.player_team_id = cpt.player_team_id join player p on p.player_id = pt.player_id '
 || '    where cpt.card_id = c.card_id order by p.player_id limit 1 ) pl on true '
 || '  where uc.user_id = $1 and uc.sold_at is null '
 || '    and ($2::bigint[] is null or exists (select 1 from card_player_team cpt join player_team pt on pt.player_team_id = cpt.player_team_id where cpt.card_id = c.card_id and pt.team_id = any($2))) '
 || '    and ($3::bigint is null or c.series_id in (select series_id from series where set_id = $3)) '
 || '    and (not $4 or c.is_rookie) and (not $5 or c.is_autograph) and (not $6 or c.is_relic) '
 || '    and (not $7 or uc.grade is not null) and (not $8 or uc.is_for_sale) and (not $9 or uc.is_special) '
 || '    and (not $10 or exists (select 1 from user_card_photo ph where ph.user_card_id = uc.user_card_id)) '
 || '    and ($11::bigint[] is null and not $12 or ($11::bigint[] is not null and uc.user_location_id = any($11)) or ($12 and uc.user_location_id is null)) '
 || '  ), base as ( '
 || '    select * from src where (cardinality($13::text[]) = 0 or not exists (select 1 from unnest($13::text[]) tk where src.hay not like ''%''||tk||''%'')) '
 || '  ) '
 || '  select jsonb_build_object( '
 || '    ''cards'', coalesce((select jsonb_agg(public.public_user_card_json(t.user_card_id) order by t.rn) '
 || '       from (select user_card_id, row_number() over (order by ' || v_order || ' ' || v_dir || ', user_card_id) rn '
 || '             from base order by rn limit ' || v_cap::text || ') t), ''[]''::jsonb), '
 || '    ''truncated'', (select count(*) from base) > ' || v_cap::text || ' '
 || '  )';

  execute v_sql into v_cards
    using v.user_id, v_team_ids, v_set_id, coalesce((f->>'rookie')::boolean,false),
          coalesce((f->>'auto')::boolean,false), coalesce((f->>'relic')::boolean,false),
          coalesce((f->>'graded')::boolean,false), coalesce((f->>'forSale')::boolean,false),
          coalesce((f->>'special')::boolean,false), coalesce((f->>'photo')::boolean,false),
          v_loc_nonzero, v_has_unassigned, v_tokens, v_is_owner;

  -- Owner handle for the "by <user>" link (null if the owner has no public handle).
  select username, display_name into v_owner_profile
    from public.profiles where collector_id = v.user_id;

  return jsonb_build_object(
    'view', jsonb_build_object(
      'name', v.name,
      'view_mode', coalesce(cfg->>'view','list'),
      'is_owner', v_is_owner,
      'is_public', coalesce(v.is_public, false),
      'owner_username', v_owner_profile.username,
      'owner_display', v_owner_profile.display_name
    ),
    'cards', v_cards->'cards',
    'truncated', v_cards->'truncated'
  );
end $$;
grant execute on function public.public_view_cards(text,int,text) to anon, authenticated;
