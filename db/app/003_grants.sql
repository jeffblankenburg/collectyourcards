-- PostgREST connects as anon/authenticated. Those roles currently have NO
-- privileges on these tables, so the Supabase client sees nothing until these
-- grants exist (RLS in 005 then narrows what each role may actually read/write).

grant usage on schema public to anon, authenticated;

-- Catalog: public read for both roles.
grant select on
  public.card, public.card_player_team, public.player, public.player_team,
  public.team, public.series, public.set, public.color, public.grading_agency,
  public.user_card_photo
to anon, authenticated;

-- Collection: authenticated CRUD (RLS restricts to the owner's rows).
grant select, insert, update, delete on public.user_card     to authenticated;
grant select, insert, update, delete on public.user_location to authenticated;
grant select, insert, update, delete on public.user_card_photo to authenticated;

-- Identity-column sequences the app inserts into.
grant usage, select on all sequences in schema public to authenticated;

-- NOTE: legacy public."user" is deliberately NOT granted (holds email/password
-- hashes/tokens). Identity is mediated only through public.profiles + the
-- current_collector_id() helper.
