-- Admin ingestion RPCs. All SECURITY DEFINER (owner postgres -> bypass unforced
-- RLS) and gated by assert_admin() as the FIRST statement. A PL/pgSQL body is one
-- transaction, so the multi-table card chain writes atomically. Granted to
-- `authenticated` (the gate authorizes). Re-apply via `npm run db:app`.

-- ── SET ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_create_set(p_name text, p_year int, p_organization_id int, p_manufacturer_id int)
returns int language plpgsql security definer set search_path = public as $$
declare v_id int;
begin
  perform public.assert_admin();
  if coalesce(trim(p_name),'') = '' then raise exception 'set name required' using errcode='22023'; end if;
  insert into public.set(name, year, organization_id, manufacturer_id, slug, card_count, series_count, is_complete, created)
  values (trim(p_name), p_year, p_organization_id, p_manufacturer_id,
          public.unique_slug(coalesce(p_year::text,'')||' '||p_name,'public.set','set_id'), 0, 0, false, now())
  returning set_id into v_id;
  perform public.log_admin('create','set',v_id::text,null,jsonb_build_object('name',p_name,'year',p_year));
  return v_id;
end; $$;
grant execute on function public.admin_create_set(text,int,int,int) to authenticated;

create or replace function public.admin_update_set(p_set_id int, p_name text, p_year int, p_organization_id int, p_manufacturer_id int)
returns int language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.set set name=trim(p_name), year=p_year, organization_id=p_organization_id, manufacturer_id=p_manufacturer_id,
    slug=public.unique_slug(coalesce(p_year::text,'')||' '||p_name,'public.set','set_id', p_set_id)
  where set_id=p_set_id;
  if not found then raise exception 'set % not found', p_set_id using errcode='P0002'; end if;
  perform public.log_admin('update','set',p_set_id::text,null,jsonb_build_object('name',p_name));
  return p_set_id;
end; $$;
grant execute on function public.admin_update_set(int,text,int,int,int) to authenticated;

-- ── SERIES ───────────────────────────────────────────────────────────────────
create or replace function public.admin_create_series(
  p_name text, p_set_id int, p_color_id int default null, p_is_base boolean default false,
  p_parallel_of_series_id bigint default null, p_print_run int default null,
  p_min_print_run int default null, p_max_print_run int default null,
  p_print_run_display text default null, p_production_code text default null, p_card_count int default 0)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_base text;
begin
  perform public.assert_admin();
  if coalesce(trim(p_name),'')='' then raise exception 'series name required' using errcode='22023'; end if;
  select coalesce(s.year::text,'')||' '||coalesce(s.name,'')||' '||p_name into v_base from public.set s where s.set_id=p_set_id;
  insert into public.series(name, set_id, color_id, is_base, parallel_of_series_id, print_run,
    min_print_run, max_print_run, print_run_display, production_code, card_count, card_entered_count, slug, created)
  values (trim(p_name), p_set_id, p_color_id, p_is_base, p_parallel_of_series_id, p_print_run,
    p_min_print_run, p_max_print_run, p_print_run_display, p_production_code, coalesce(p_card_count,0), 0,
    public.unique_slug(v_base,'public.series','series_id'), now())
  returning series_id into v_id;
  update public.set set series_count = coalesce(series_count,0)+1 where set_id=p_set_id;
  perform public.log_admin('create','series',v_id::text,null,jsonb_build_object('name',p_name,'set_id',p_set_id));
  return v_id;
end; $$;
grant execute on function public.admin_create_series(text,int,int,boolean,bigint,int,int,int,text,text,int) to authenticated;

create or replace function public.admin_update_series(
  p_series_id bigint, p_name text, p_color_id int default null, p_is_base boolean default false,
  p_parallel_of_series_id bigint default null, p_print_run int default null,
  p_min_print_run int default null, p_max_print_run int default null,
  p_print_run_display text default null, p_production_code text default null, p_card_count int default null)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.series set name=trim(p_name), color_id=p_color_id, is_base=p_is_base,
    parallel_of_series_id=p_parallel_of_series_id, print_run=p_print_run, min_print_run=p_min_print_run,
    max_print_run=p_max_print_run, print_run_display=p_print_run_display, production_code=p_production_code,
    card_count=coalesce(p_card_count, card_count),
    slug=public.unique_slug(name,'public.series','series_id', p_series_id)
  where series_id=p_series_id;
  if not found then raise exception 'series % not found', p_series_id using errcode='P0002'; end if;
  perform public.log_admin('update','series',p_series_id::text,null,jsonb_build_object('name',p_name));
  return p_series_id;
end; $$;
grant execute on function public.admin_update_series(bigint,text,int,boolean,bigint,int,int,int,text,text,int) to authenticated;

-- ── PLAYER ───────────────────────────────────────────────────────────────────
create or replace function public.admin_create_player(
  p_first_name text, p_last_name text, p_nick_name text default null,
  p_birthdate date default null, p_is_hof boolean default false, p_team_id int default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.assert_admin();
  if coalesce(trim(p_first_name),'')='' and coalesce(trim(p_last_name),'')='' and coalesce(trim(p_nick_name),'')='' then
    raise exception 'player needs a name' using errcode='22023';
  end if;
  insert into public.player(first_name, last_name, nick_name, birthdate, is_hof, slug, card_count, created)
  values (nullif(trim(p_first_name),''), nullif(trim(p_last_name),''), nullif(trim(p_nick_name),''),
    p_birthdate, p_is_hof,
    public.unique_slug(coalesce(p_first_name,'')||' '||coalesce(p_last_name,''),'public.player','player_id'), 0, now())
  returning player_id into v_id;
  if p_team_id is not null then perform public.find_or_create_player_team(v_id, p_team_id); end if;
  perform public.log_admin('create','player',v_id::text,null,jsonb_build_object('name',p_first_name||' '||p_last_name));
  return v_id;
end; $$;
grant execute on function public.admin_create_player(text,text,text,date,boolean,int) to authenticated;

create or replace function public.admin_update_player(
  p_player_id bigint, p_first_name text, p_last_name text, p_nick_name text default null,
  p_birthdate date default null, p_is_hof boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.player set first_name=nullif(trim(p_first_name),''), last_name=nullif(trim(p_last_name),''),
    nick_name=nullif(trim(p_nick_name),''), birthdate=p_birthdate, is_hof=p_is_hof,
    slug=public.unique_slug(coalesce(p_first_name,'')||' '||coalesce(p_last_name,''),'public.player','player_id', p_player_id)
  where player_id=p_player_id;
  if not found then raise exception 'player % not found', p_player_id using errcode='P0002'; end if;
  return p_player_id;
end; $$;
grant execute on function public.admin_update_player(bigint,text,text,text,date,boolean) to authenticated;

-- ── TEAM ─────────────────────────────────────────────────────────────────────
create or replace function public.admin_create_team(
  p_name text, p_abbreviation text, p_organization_id int, p_city text default null,
  p_mascot text default null, p_primary_color text default null, p_secondary_color text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_id int;
begin
  perform public.assert_admin();
  if coalesce(trim(p_name),'')='' then raise exception 'team name required' using errcode='22023'; end if;
  insert into public.team(name, abbreviation, organization_id, city, mascot, primary_color, secondary_color, slug, card_count, player_count, created)
  values (trim(p_name), nullif(trim(p_abbreviation),''), p_organization_id, nullif(trim(p_city),''), nullif(trim(p_mascot),''),
    p_primary_color, p_secondary_color,
    public.unique_slug(coalesce(p_city,'')||' '||p_name,'public.team','team_id'), 0, 0, now())
  returning team_id into v_id;
  perform public.log_admin('create','team',v_id::text,null,jsonb_build_object('name',p_name));
  return v_id;
end; $$;
grant execute on function public.admin_create_team(text,text,int,text,text,text,text) to authenticated;

create or replace function public.admin_update_team(
  p_team_id int, p_name text, p_abbreviation text, p_organization_id int, p_city text default null,
  p_mascot text default null, p_primary_color text default null, p_secondary_color text default null)
returns int language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.team set name=trim(p_name), abbreviation=nullif(trim(p_abbreviation),''), organization_id=p_organization_id,
    city=nullif(trim(p_city),''), mascot=nullif(trim(p_mascot),''), primary_color=p_primary_color, secondary_color=p_secondary_color,
    slug=public.unique_slug(coalesce(p_city,'')||' '||p_name,'public.team','team_id', p_team_id)
  where team_id=p_team_id;
  if not found then raise exception 'team % not found', p_team_id using errcode='P0002'; end if;
  return p_team_id;
end; $$;
grant execute on function public.admin_update_team(int,text,text,int,text,text,text,text) to authenticated;

-- ── CARD (insert/update + 3-table player chain) ──────────────────────────────
create or replace function public.admin_upsert_card(
  p_card_id bigint, p_series_id bigint, p_card_number text,
  p_is_rookie boolean default false, p_is_autograph boolean default false,
  p_is_relic boolean default false, p_is_short_print boolean default false,
  p_print_run int default null, p_color_id int default null, p_sort_order int default null,
  p_notes text default null, p_players jsonb default '[]'::jsonb)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_card_id bigint := p_card_id; v_elem jsonb; v_pt bigint;
begin
  perform public.assert_admin();
  if p_series_id is null then raise exception 'series_id required' using errcode='22023'; end if;
  if v_card_id is null then
    insert into public.card(series_id, card_number, is_rookie, is_autograph, is_relic, is_short_print, print_run, color_id, sort_order, notes, created)
    values (p_series_id, nullif(trim(p_card_number),''), p_is_rookie, p_is_autograph, p_is_relic, p_is_short_print, p_print_run, p_color_id, p_sort_order, p_notes, now())
    returning card_id into v_card_id;
  else
    update public.card set series_id=p_series_id, card_number=nullif(trim(p_card_number),''),
      is_rookie=p_is_rookie, is_autograph=p_is_autograph, is_relic=p_is_relic, is_short_print=p_is_short_print,
      print_run=p_print_run, color_id=p_color_id, sort_order=p_sort_order, notes=p_notes
    where card_id=v_card_id;
    if not found then raise exception 'card % not found', v_card_id using errcode='P0002'; end if;
  end if;
  -- Rebuild links only when players supplied (empty array on update = leave untouched).
  if jsonb_typeof(p_players)='array' and jsonb_array_length(p_players) > 0 then
    delete from public.card_player_team where card_id = v_card_id;
    for v_elem in select * from jsonb_array_elements(p_players) loop
      v_pt := public.find_or_create_player_team((v_elem->>'player_id')::bigint, (v_elem->>'team_id')::int);
      insert into public.card_player_team(card_id, player_team_id, created) values (v_card_id, v_pt, now()) on conflict do nothing;
    end loop;
  end if;
  perform public.log_admin(case when p_card_id is null then 'create' else 'update' end,'card',v_card_id::text,null,jsonb_build_object('series_id',p_series_id,'number',p_card_number));
  return v_card_id;
end; $$;
grant execute on function public.admin_upsert_card(bigint,bigint,text,boolean,boolean,boolean,boolean,int,int,int,text,jsonb) to authenticated;

-- ── MATCHING (trigram) ───────────────────────────────────────────────────────
create or replace function public.match_players(p_names text[])
returns jsonb language sql stable security definer set search_path = public as $$
  with input as (
    select ord, raw, regexp_replace(lower(public.unaccent(raw)),'[^a-z0-9 ]','','g') as norm
    from unnest(p_names) with ordinality u(raw, ord)
  ),
  cand as (
    select i.ord, i.raw, i.norm, p.player_id, p.first_name, p.last_name, p.nick_name, p.slug,
      regexp_replace(lower(public.unaccent(coalesce(p.first_name,'')||' '||coalesce(p.last_name,''))),'[^a-z0-9 ]','','g') as nfull,
      regexp_replace(lower(public.unaccent(coalesce(p.nick_name,'')||' '||coalesce(p.last_name,''))),'[^a-z0-9 ]','','g') as nnick,
      greatest(similarity(lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')), i.norm),
               similarity(lower(coalesce(p.nick_name,'')||' '||coalesce(p.last_name,'')), i.norm)) as sim
    from input i
    join public.player p on (lower(coalesce(p.first_name,'')||' '||coalesce(p.last_name,'')) % i.norm
                          or lower(coalesce(p.nick_name,'')||' '||coalesce(p.last_name,'')) % i.norm)
    where length(i.norm) >= 2
  ),
  ranked as (
    select c.*, (nfull = norm or nnick = norm) as exact,
      row_number() over (partition by ord order by (nfull = norm or nnick = norm) desc, sim desc, player_id) as rn
    from cand c
  )
  select coalesce(jsonb_agg(jsonb_build_object('ord', ord, 'raw', raw, 'candidates', cands) order by ord), '[]'::jsonb)
  from (
    select ord, min(raw) as raw,
      jsonb_agg(jsonb_build_object('player_id', player_id, 'first_name', first_name, 'last_name', last_name,
        'nick_name', nick_name, 'slug', slug, 'score', round((case when exact then 1.0 else sim end)::numeric,3), 'exact', exact,
        'teams', coalesce((select jsonb_agg(distinct jsonb_build_object('team_id',t.team_id,'abbreviation',t.abbreviation,'primary_color',t.primary_color,'secondary_color',t.secondary_color,'organization_id',t.organization_id))
                 from public.player_team pt join public.team t on t.team_id=pt.team_id where pt.player_id=r.player_id),'[]'::jsonb)
      ) order by rn) filter (where rn <= 5) as cands
    from ranked r group by ord
  ) g;
$$;
grant execute on function public.match_players(text[]) to authenticated;

create or replace function public.match_teams(p_names text[], p_org int default null)
returns jsonb language sql stable security definer set search_path = public as $$
  with input as (
    select ord, raw, regexp_replace(lower(public.unaccent(raw)),'[^a-z0-9 ]','','g') as norm,
           upper(regexp_replace(raw,'[^A-Za-z0-9]','','g')) as abbr
    from unnest(p_names) with ordinality u(raw, ord)
  ),
  cand as (
    select i.ord, i.raw, i.norm, t.team_id, t.name, t.city, t.abbreviation, t.primary_color, t.secondary_color, t.organization_id,
      (upper(coalesce(t.abbreviation,'')) = i.abbr
       or regexp_replace(lower(public.unaccent(coalesce(t.city,'')||' '||coalesce(t.name,''))),'[^a-z0-9 ]','','g') = i.norm
       or regexp_replace(lower(public.unaccent(coalesce(t.name,''))),'[^a-z0-9 ]','','g') = i.norm) as exact,
      greatest(similarity(lower(coalesce(t.city,'')||' '||coalesce(t.name,'')), i.norm), similarity(lower(coalesce(t.name,'')), i.norm)) as sim
    from input i
    join public.team t on (upper(coalesce(t.abbreviation,'')) = i.abbr
                        or lower(coalesce(t.city,'')||' '||coalesce(t.name,'')) % i.norm
                        or lower(coalesce(t.name,'')) % i.norm)
    where (p_org is null or t.organization_id = p_org)
  ),
  ranked as (
    select c.*, row_number() over (partition by ord order by exact desc, sim desc, team_id) as rn from cand c
  )
  select coalesce(jsonb_agg(jsonb_build_object('ord', ord, 'raw', raw, 'candidates', cands) order by ord), '[]'::jsonb)
  from (
    select ord, min(raw) as raw,
      jsonb_agg(jsonb_build_object('team_id', team_id, 'name', name, 'city', city, 'abbreviation', abbreviation,
        'primary_color', primary_color, 'secondary_color', secondary_color, 'organization_id', organization_id,
        'score', round((case when exact then 1.0 else sim end)::numeric,3), 'exact', exact) order by rn) filter (where rn <= 5) as cands
    from ranked group by ord
  ) g;
$$;
grant execute on function public.match_teams(text[],int) to authenticated;

-- ── BULK IMPORT (transactional, per-row report) ──────────────────────────────
create or replace function public.admin_import_cards(p_series_id bigint, p_rows jsonb, p_on_duplicate text default 'skip')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb; v_pl jsonb; v_card_id bigint; v_player_id bigint; v_team_id int; v_pt bigint;
  v_num text; v_exists bigint; v_results jsonb := '[]'::jsonb;
  v_created int := 0; v_skipped int := 0; v_errors int := 0;
begin
  perform public.assert_admin();
  if p_series_id is null then raise exception 'series_id required'; end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    begin
      v_num := nullif(trim(v_row->>'card_number'),'');
      select card_id into v_exists from public.card where series_id=p_series_id and card_number is not distinct from v_num limit 1;
      if v_exists is not null and p_on_duplicate = 'skip' then
        v_skipped := v_skipped + 1;
        v_results := v_results || jsonb_build_object('row', v_row->'row', 'status','skipped', 'card_id', v_exists);
        continue;
      end if;
      insert into public.card(series_id, card_number, is_rookie, is_autograph, is_relic, is_short_print, print_run, color_id, notes, created)
      values (p_series_id, v_num, coalesce((v_row->>'is_rookie')::boolean,false), coalesce((v_row->>'is_autograph')::boolean,false),
        coalesce((v_row->>'is_relic')::boolean,false), coalesce((v_row->>'is_short_print')::boolean,false),
        (v_row->>'print_run')::int, (v_row->>'color_id')::int, v_row->>'notes', now())
      returning card_id into v_card_id;
      for v_pl in select * from jsonb_array_elements(coalesce(v_row->'players','[]'::jsonb)) loop
        if v_pl ? 'new_player' then
          insert into public.player(first_name, last_name, nick_name, slug, card_count, created)
          values (v_pl#>>'{new_player,first}', v_pl#>>'{new_player,last}', v_pl#>>'{new_player,nick}',
            public.unique_slug(coalesce(v_pl#>>'{new_player,first}','')||' '||coalesce(v_pl#>>'{new_player,last}',''),'public.player','player_id'), 0, now())
          returning player_id into v_player_id;
        else v_player_id := (v_pl->>'player_id')::bigint; end if;
        if v_pl ? 'new_team' then
          insert into public.team(name, city, abbreviation, organization_id, slug, card_count, player_count, created)
          values (v_pl#>>'{new_team,name}', v_pl#>>'{new_team,city}', v_pl#>>'{new_team,abbreviation}', (v_pl#>>'{new_team,organization_id}')::int,
            public.unique_slug(coalesce(v_pl#>>'{new_team,city}','')||' '||coalesce(v_pl#>>'{new_team,name}',''),'public.team','team_id'), 0, 0, now())
          returning team_id into v_team_id;
        else v_team_id := (v_pl->>'team_id')::int; end if;
        if v_player_id is not null and v_team_id is not null then
          v_pt := public.find_or_create_player_team(v_player_id, v_team_id);
          insert into public.card_player_team(card_id, player_team_id, created) values (v_card_id, v_pt, now()) on conflict do nothing;
        end if;
      end loop;
      v_created := v_created + 1;
      v_results := v_results || jsonb_build_object('row', v_row->'row', 'status','created', 'card_id', v_card_id);
    exception when others then
      v_errors := v_errors + 1;
      v_results := v_results || jsonb_build_object('row', v_row->'row', 'status','error', 'message', sqlerrm);
    end;
  end loop;
  perform public.log_admin('import','series',p_series_id::text,null,jsonb_build_object('created',v_created,'skipped',v_skipped,'errors',v_errors));
  return jsonb_build_object('created',v_created,'skipped',v_skipped,'errors',v_errors,'rows',v_results);
end; $$;
grant execute on function public.admin_import_cards(bigint,jsonb,text) to authenticated;
