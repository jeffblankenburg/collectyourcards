-- Per-card ownership for the signed-in user within one series — powers the
-- series checklist's "in your collection" badges + completion %. SECURITY
-- INVOKER (default) so user_card's owner-only RLS scopes the rows to the caller;
-- the explicit current_collector_id() filter is a belt-and-braces backstop.
-- Returns [] for anon. Re-apply via `npm run db:app`.
create or replace function public.series_owned_counts(p_series_id bigint)
returns table (card_id bigint, cnt bigint)
language sql stable set search_path = public as $$
  select uc.card_id, count(*) as cnt
  from public.user_card uc
  join public.card c on c.card_id = uc.card_id
  where c.series_id = p_series_id
    and uc.sold_at is null
    and uc.user_id = public.current_collector_id()
  group by uc.card_id;
$$;
grant execute on function public.series_owned_counts(bigint) to authenticated;
