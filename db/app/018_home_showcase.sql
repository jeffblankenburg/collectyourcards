-- Home showcase: random cards drawn from "showcase" collectors' own collections
-- to fill the PUBLIC landing page hero fan + marquee. user_card_photo is
-- owner-only RLS, so this SECURITY DEFINER function deliberately publishes a
-- narrow, non-sensitive slice (card identity + photo, NOT prices/values/location)
-- for collectors who have opted in via profiles.showcase_collection. For now
-- that's just the owner (collector_id = 1). The app dedupes one-per-player and
-- one-per-series and splits the fan vs marquee. Re-apply via `npm run db:app`.

-- Opt-in flag: which collections may appear publicly on the home page.
alter table public.profiles
  add column if not exists showcase_collection boolean not null default false;

-- The owner opts in by default.
update public.profiles set showcase_collection = true where collector_id = 1;

-- Return signature changes (added team_id) → drop before re-create.
drop function if exists public.home_showcase_cards(int);

create or replace function public.home_showcase_cards(p_limit int default 120)
returns table (
  user_card_id bigint,
  card_id      bigint,
  card_number  text,
  photo_url    text,
  player       text,
  series       text,
  year         int,
  team_id      bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    uc.user_card_id,
    c.card_id,
    c.card_number,
    ph.photo_url,
    pl.first_name || ' ' || pl.last_name as player,
    se.name as series,
    stt.year,
    pl.team_id
  from user_card uc
  join card c    on c.card_id = uc.card_id
  join series se on se.series_id = c.series_id
  join set stt   on stt.set_id = se.set_id
  -- primary photo (lowest sort order) only; its presence is required
  join lateral (
    select p.photo_url
    from user_card_photo p
    where p.user_card_id = uc.user_card_id
    order by p.sort_order nulls last, p.user_card_photo_id
    limit 1
  ) ph on true
  -- first named player on the card + the team that card features them on
  -- (required — showcase cards feature a player)
  join lateral (
    select p.first_name, p.last_name, t.team_id
    from card_player_team cpt
    join player_team pt on pt.player_team_id = cpt.player_team_id
    join player p on p.player_id = pt.player_id
    join team t   on t.team_id = pt.team_id
    where cpt.card_id = c.card_id
    order by p.player_id
    limit 1
  ) pl on true
  where uc.sold_at is null
    and uc.user_id in (select collector_id from public.profiles where showcase_collection)
  order by random()
  limit greatest(p_limit, 1);
$$;

grant execute on function public.home_showcase_cards(int) to anon, authenticated;
