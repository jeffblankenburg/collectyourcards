-- RLS policies. RLS is already ENABLED on every table (currently deny-all because
-- there are no policies). Catalog = public read; collection = owner-only.

-- Catalog: anyone (anon or authenticated) may read.
do $$
declare t text;
begin
  foreach t in array array[
    'card','card_player_team','player','player_team','team','series','set','color','grading_agency'
  ] loop
    execute format('drop policy if exists p_read_all on public.%I', t);
    execute format('create policy p_read_all on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

-- profiles: a user sees/updates only their own row.
drop policy if exists p_profile_self_sel on public.profiles;
create policy p_profile_self_sel on public.profiles for select to authenticated
  using (id = auth.uid());
drop policy if exists p_profile_self_upd on public.profiles;
create policy p_profile_self_upd on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- user_card: owner-only across all verbs, via the STABLE helper.
drop policy if exists p_uc_sel on public.user_card;
create policy p_uc_sel on public.user_card for select to authenticated
  using (user_id = public.current_collector_id());
drop policy if exists p_uc_ins on public.user_card;
create policy p_uc_ins on public.user_card for insert to authenticated
  with check (user_id = public.current_collector_id());
drop policy if exists p_uc_upd on public.user_card;
create policy p_uc_upd on public.user_card for update to authenticated
  using (user_id = public.current_collector_id())
  with check (user_id = public.current_collector_id());
drop policy if exists p_uc_del on public.user_card;
create policy p_uc_del on public.user_card for delete to authenticated
  using (user_id = public.current_collector_id());

-- user_location: owner-only.
drop policy if exists p_ul_all on public.user_location;
create policy p_ul_all on public.user_location for all to authenticated
  using (user_id = public.current_collector_id())
  with check (user_id = public.current_collector_id());

-- user_card_photo: owner-only, gated through the parent user_card's ownership.
drop policy if exists p_ucp_sel on public.user_card_photo;
create policy p_ucp_sel on public.user_card_photo for select to authenticated
  using (exists (select 1 from public.user_card uc
                  where uc.user_card_id = user_card_photo.user_card_id
                    and uc.user_id = public.current_collector_id()));
drop policy if exists p_ucp_mod on public.user_card_photo;
create policy p_ucp_mod on public.user_card_photo for all to authenticated
  using (exists (select 1 from public.user_card uc
                  where uc.user_card_id = user_card_photo.user_card_id
                    and uc.user_id = public.current_collector_id()))
  with check (exists (select 1 from public.user_card uc
                  where uc.user_card_id = user_card_photo.user_card_id
                    and uc.user_id = public.current_collector_id()));
