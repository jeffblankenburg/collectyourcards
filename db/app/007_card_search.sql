-- Specific multi-token card search ("PA-SB Bieber 2024"): a denormalized text per
-- card (card number + year + set + series + color + players + teams), trigram-
-- indexed, searched token-by-token and ranked by how many tokens each card matches
-- (so precise full matches lead, partial matches follow gracefully).
set local statement_timeout = '180s';

-- `if not exists` so re-applying db:app doesn't rebuild the 1M-row MV each time.
-- (Drop it manually if the projection definition below ever changes.)
create materialized view if not exists public.card_search_mv as
select
  c.card_id,
  c.series_id,
  lower(unaccent(
    coalesce(c.card_number,'') || ' ' ||
    coalesce(st.year::text,'') || ' ' ||
    coalesce(st.name,'') || ' ' ||
    coalesce(se.name,'') || ' ' ||
    coalesce(col.name,'') || ' ' ||
    coalesce(string_agg(distinct trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')), ' '), '') || ' ' ||
    coalesce(string_agg(distinct t.name, ' '), '') || ' ' ||
    coalesce(string_agg(distinct t.abbreviation, ' '), '')
  )) as search_text
from public.card c
join public.series se on se.series_id = c.series_id
join public.set st on st.set_id = se.set_id
left join public.color col on col.color_id = c.color_id
left join public.card_player_team cpt on cpt.card_id = c.card_id
left join public.player_team pt on pt.player_team_id = cpt.player_team_id
left join public.player p on p.player_id = pt.player_id
left join public.team t on t.team_id = pt.team_id
group by c.card_id, c.card_number, st.year, st.name, se.name, col.name;

create unique index if not exists ux_card_search_mv on public.card_search_mv (card_id);
create index if not exists ix_card_search_mv_trgm on public.card_search_mv using gin (search_text gin_trgm_ops);
grant select on public.card_search_mv to anon, authenticated;

-- Refresh after catalog changes (admin/cron). CONCURRENTLY needs the unique index.
create or replace function public.refresh_card_search()
returns void language sql security definer set search_path = public as $$
  refresh materialized view concurrently public.card_search_mv;
$$;

-- Token-scored card search.
--  • score tokens  = all query tokens (>=2 chars) — drive the ranking (match count)
--  • candidate tokens = the "distinctive" ones (>=3 chars, NOT purely numeric) —
--    drive the index scan. Excluding years/numbers from candidate selection keeps
--    a query like "...2024" from pulling in all 190k+ cards of that year; the year
--    still boosts ranking via the score. Falls back to all tokens if none qualify.
create or replace function public.card_text_search(q text, lim int default 20)
returns setof jsonb
language sql stable security definer set search_path = public as $$
  with raw as (
    select array(
      select tok from unnest(regexp_split_to_array(lower(unaccent(coalesce(q,''))), '\s+')) tok
      where length(tok) >= 2
    ) as score_t
  ),
  toks as (
    select
      score_t,
      ( case
          when array_length(array(select x from unnest(score_t) x where length(x) >= 3 and x !~ '^[0-9]+$'), 1) >= 1
            then array(select x from unnest(score_t) x where length(x) >= 3 and x !~ '^[0-9]+$')
          else score_t
        end )[1:5] as cand_t
    from raw
  )
  select public.card_json(sub.card_id)
  from (
    select m.card_id,
      (select count(*) from unnest(score_t) tk where m.search_text like '%'||tk||'%') as score,
      similarity(m.search_text, array_to_string(score_t, ' ')) as sim
    from public.card_search_mv m, toks
    where coalesce(array_length(cand_t,1),0) >= 1
      -- AND: every distinctive token must be present (BitmapAnd -> small, precise
      -- intersection). Years/numbers were excluded from cand_t, so they don't
      -- over-constrain; they still boost ranking via `score`.
      and (array_length(cand_t,1) < 1 or m.search_text like '%'||cand_t[1]||'%')
      and (array_length(cand_t,1) < 2 or m.search_text like '%'||cand_t[2]||'%')
      and (array_length(cand_t,1) < 3 or m.search_text like '%'||cand_t[3]||'%')
      and (array_length(cand_t,1) < 4 or m.search_text like '%'||cand_t[4]||'%')
      and (array_length(cand_t,1) < 5 or m.search_text like '%'||cand_t[5]||'%')
    order by score desc, sim desc, m.card_id
    limit greatest(1, least(lim, 100))
  ) sub;
$$;
grant execute on function public.card_text_search(text,int) to anon, authenticated;
