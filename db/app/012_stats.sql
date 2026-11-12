-- Published catalog figures for the home hero (mirrors the old app's
-- /api/database-stats: exact COUNT(*) of card/player/team, cached by the caller).
-- SECURITY INVOKER is fine — the anon role already has public-read on these tables.
create or replace function public.database_stats()
returns table (cards bigint, players bigint, teams bigint)
language sql
stable
as $$
  select
    (select count(*) from public.card),
    (select count(*) from public.player),
    (select count(*) from public.team);
$$;

grant execute on function public.database_stats() to anon, authenticated;
