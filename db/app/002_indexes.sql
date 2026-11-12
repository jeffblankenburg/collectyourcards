-- Secondary indexes. The migrated schema has only PKs + unique slugs, so every
-- FK join and name filter currently seq-scans (fatal toward 50M rows). These are
-- the hot paths the app actually issues.

-- FK-child B-trees (joins + filters)
create index if not exists ix_card_series            on public.card (series_id);
create index if not exists ix_card_color             on public.card (color_id);
create index if not exists ix_cpt_card               on public.card_player_team (card_id);
create index if not exists ix_cpt_player_team        on public.card_player_team (player_team_id);
create index if not exists ix_player_team_player     on public.player_team (player_id);
create index if not exists ix_player_team_team       on public.player_team (team_id);
create index if not exists ix_series_set             on public.series (set_id);
create index if not exists ix_series_parent          on public.series (parallel_of_series_id);
create index if not exists ix_user_card_user         on public.user_card (user_id);
create index if not exists ix_user_card_card         on public.user_card (card_id);
create index if not exists ix_user_location_user     on public.user_location (user_id);
create index if not exists ix_user_card_photo_card   on public.user_card_photo (user_card_id, sort_order);

-- Checklist order within a series (series detail / card_search keyset)
create index if not exists ix_card_series_sort       on public.card (series_id, sort_order, card_id);
-- Collection keyset pagination (newest first per owner)
create index if not exists ix_user_card_user_created on public.user_card (user_id, created desc);
-- Set listing order
create index if not exists ix_set_year               on public.set (year desc);

-- Trigram GIN for autocomplete / fuzzy name search (lower() is immutable -> indexable)
create index if not exists ix_player_name_trgm on public.player
  using gin ((lower(coalesce(first_name,'') || ' ' || coalesce(last_name,''))) gin_trgm_ops);
create index if not exists ix_player_last_trgm on public.player
  using gin ((lower(coalesce(last_name,''))) gin_trgm_ops);
create index if not exists ix_team_name_trgm on public.team
  using gin ((lower(coalesce(city,'') || ' ' || coalesce(name,''))) gin_trgm_ops);
create index if not exists ix_set_name_trgm on public.set
  using gin ((lower(coalesce(name,''))) gin_trgm_ops);
create index if not exists ix_series_name_trgm on public.series
  using gin ((lower(coalesce(name,''))) gin_trgm_ops);
create index if not exists ix_card_number_trgm on public.card
  using gin ((lower(coalesce(card_number,''))) gin_trgm_ops);
