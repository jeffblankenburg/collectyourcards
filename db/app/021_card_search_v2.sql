-- Card search v2: make "number + name" queries (e.g. "145 ohtani") surface the
-- exact card. v1 only substring-matched numeric tokens against the denormalized
-- blob (weak, noisy, +1 to score). v2 adds a dedicated `card_number_norm` column
-- to the MV so an exact card-number equality can FLOAT the right card to the top,
-- while numeric tokens still never drive the (trigram) candidate scan — so a year
-- like "2024" can't pull 190k rows.
set local statement_timeout = '600s';

-- ---------------------------------------------------------------------------
-- Rebuild card_search_mv ONLY when it's missing the new column, so re-running
-- `npm run db:app` doesn't rebuild the ~1M-row MV every time (07's `if not
-- exists` created the v1 shape without card_number_norm). After a `migration/`
-- run drops public, 007 recreates the v1 MV and this block upgrades it once.
-- ---------------------------------------------------------------------------
do $$
begin
  -- Materialized-view columns are NOT in information_schema.columns — must read
  -- pg_attribute, or this check always fails and rebuilds the ~1M-row MV every run.
  if not exists (
    select 1
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'card_search_mv'
      and a.attname = 'card_number_norm' and a.attnum > 0 and not a.attisdropped
  ) then
    drop materialized view if exists public.card_search_mv cascade;

    create materialized view public.card_search_mv as
    select
      c.card_id,
      c.series_id,
      lower(unaccent(coalesce(c.card_number,''))) as card_number_norm,
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

    create unique index ux_card_search_mv on public.card_search_mv (card_id);
    create index ix_card_search_mv_trgm on public.card_search_mv using gin (search_text gin_trgm_ops);
    create index ix_card_search_mv_num on public.card_search_mv (card_number_norm);
    grant select on public.card_search_mv to anon, authenticated;
  end if;
end $$;

-- Refresh after catalog changes (admin/cron). CONCURRENTLY needs the unique index.
create or replace function public.refresh_card_search()
returns void language sql security definer set search_path = public as $$
  refresh materialized view concurrently public.card_search_mv;
$$;

-- ---------------------------------------------------------------------------
-- Token-scored card search v2.
--  • score_t = all query tokens (>=2 chars) — drive the overall ranking.
--  • name_t  = distinctive tokens (>=3 chars, NOT numeric) — drive the trigram
--    candidate scan (precise intersection), exactly as v1.
--  • num_t   = purely-numeric tokens — NEVER constrain the scan; instead they
--    (a) float an EXACT card_number match to the very top, and (b) when the whole
--    query is numeric ("145"), become the candidate constraint via the
--    card_number_norm btree index (so a bare number returns the few #145 cards,
--    not everything containing "145").
-- ---------------------------------------------------------------------------
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
      array(select x from unnest(score_t) x where length(x) >= 3 and x !~ '^[0-9]+$') as name_t,
      array(select x from unnest(score_t) x where x ~ '^[0-9]+$')                      as num_t
    from raw
  ),
  toks2 as (
    select
      score_t, name_t, num_t,
      -- candidate tokens drive the trigram scan: distinctive names if any, else
      -- fall back to all tokens (mirrors v1).
      (case when array_length(name_t,1) >= 1 then name_t else score_t end)[1:5] as cand_t,
      -- purely-numeric query (no distinctive name tokens, every token numeric):
      -- constrain the scan by exact card_number instead of the blob.
      (array_length(name_t,1) is null and array_length(num_t,1) = array_length(score_t,1)) as all_numeric
    from toks
  )
  select public.card_json(sub.card_id)
  from (
    select m.card_id,
      (m.card_number_norm = any(t.num_t))                                                  as exact_num,
      (select count(*) from unnest(t.name_t) nk where m.search_text like '%'||nk||'%')      as name_score,
      (select count(*) from unnest(t.score_t) tk where m.search_text like '%'||tk||'%')     as score,
      similarity(m.search_text, array_to_string(t.score_t, ' '))                            as sim
    from public.card_search_mv m, toks2 t
    where (coalesce(array_length(t.cand_t,1),0) >= 1 or t.all_numeric)
      and (
        -- purely-numeric query → exact card_number (uses ix_card_search_mv_num)
        (t.all_numeric and m.card_number_norm = any(t.num_t))
        or
        -- otherwise AND every distinctive candidate token (BitmapAnd on the GIN
        -- trgm index). Numeric tokens are excluded from cand_t, so years/numbers
        -- never over-constrain; they still boost ranking via `exact_num`/`score`.
        (not t.all_numeric
          and (array_length(t.cand_t,1) < 1 or m.search_text like '%'||t.cand_t[1]||'%')
          and (array_length(t.cand_t,1) < 2 or m.search_text like '%'||t.cand_t[2]||'%')
          and (array_length(t.cand_t,1) < 3 or m.search_text like '%'||t.cand_t[3]||'%')
          and (array_length(t.cand_t,1) < 4 or m.search_text like '%'||t.cand_t[4]||'%')
          and (array_length(t.cand_t,1) < 5 or m.search_text like '%'||t.cand_t[5]||'%'))
      )
    order by exact_num desc, name_score desc, score desc, sim desc, m.card_id
    limit greatest(1, least(lim, 100))
  ) sub;
$$;
grant execute on function public.card_text_search(text,int) to anon, authenticated;
