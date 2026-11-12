-- Lists / wantlists + series completion (cutover workstream #28).
-- user_list + user_list_card were migrated with RLS enabled but NO policies
-- (deny-all). Lists are generic card lists that double as wantlists, exactly like
-- the old app. Writes are direct table ops under RLS (mirrors collection
-- mutations); the two computed reads are RPCs.

-- Grants: authenticated full CRUD, anon read (for public lists).
grant select, insert, update, delete on public.user_list      to authenticated;
grant select, insert,         delete on public.user_list_card  to authenticated;
grant select on public.user_list, public.user_list_card        to anon;

-- RLS: owner across all verbs; SELECT also open when the list is public.
drop policy if exists p_list_sel on public.user_list;
create policy p_list_sel on public.user_list for select to anon, authenticated
  using (user_id = public.current_collector_id() or coalesce(is_public, false));
drop policy if exists p_list_ins on public.user_list;
create policy p_list_ins on public.user_list for insert to authenticated
  with check (user_id = public.current_collector_id());
drop policy if exists p_list_upd on public.user_list;
create policy p_list_upd on public.user_list for update to authenticated
  using (user_id = public.current_collector_id())
  with check (user_id = public.current_collector_id());
drop policy if exists p_list_del on public.user_list;
create policy p_list_del on public.user_list for delete to authenticated
  using (user_id = public.current_collector_id());

-- list cards: gated through the parent list's ownership (or public for reads).
drop policy if exists p_lc_sel on public.user_list_card;
create policy p_lc_sel on public.user_list_card for select to anon, authenticated
  using (exists (select 1 from public.user_list ul
                  where ul.user_list_id = user_list_card.user_list_id
                    and (ul.user_id = public.current_collector_id() or coalesce(ul.is_public, false))));
drop policy if exists p_lc_ins on public.user_list_card;
create policy p_lc_ins on public.user_list_card for insert to authenticated
  with check (exists (select 1 from public.user_list ul
                       where ul.user_list_id = user_list_card.user_list_id
                         and ul.user_id = public.current_collector_id()));
drop policy if exists p_lc_del on public.user_list_card;
create policy p_lc_del on public.user_list_card for delete to authenticated
  using (exists (select 1 from public.user_list ul
                  where ul.user_list_id = user_list_card.user_list_id
                    and ul.user_id = public.current_collector_id()));

-- Keep user_list.card_count in sync (writer-agnostic, like the catalog triggers).
create or replace function public.tg_user_list_card_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_list bigint := coalesce(new.user_list_id, old.user_list_id);
begin
  update public.user_list ul
     set card_count = (select count(*) from public.user_list_card where user_list_id = v_list)
   where ul.user_list_id = v_list;
  return null;
end $$;
drop trigger if exists aiud_user_list_card_count on public.user_list_card;
create trigger aiud_user_list_card_count after insert or delete on public.user_list_card
  for each row execute function public.tg_user_list_card_count();

-- Dedup guard so "add card" is idempotent (on conflict do nothing).
create unique index if not exists ux_user_list_card on public.user_list_card (user_list_id, card_id);

-- list_create: make a list for the caller without the client knowing its own
-- collector_id (used by the "Add to list" island). Returns the new id.
create or replace function public.list_create(p_name text, p_is_public boolean default false)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'list name required'; end if;
  insert into public.user_list (user_id, name, is_public, card_count, created)
  values (public.current_collector_id(), trim(p_name), coalesce(p_is_public, false), 0, now())
  returning user_list_id into v_id;
  return v_id;
end $$;
grant execute on function public.list_create(text, boolean) to authenticated;

-- list_detail: list meta + its cards (full card_json) each flagged `owned` by the
-- caller. Visible to the owner, or to anyone if the list is public.
create or replace function public.list_detail(p_list_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v record; v_me bigint := public.current_collector_id();
begin
  select user_list_id, user_id, name, summary, card_count, is_public, created
    into v from public.user_list where user_list_id = p_list_id;
  if not found then return null; end if;
  if v.user_id is distinct from v_me and not coalesce(v.is_public, false) then
    return null; -- private list, not the caller's
  end if;
  return jsonb_build_object(
    'user_list_id', v.user_list_id, 'name', v.name, 'summary', v.summary,
    'card_count', v.card_count, 'is_public', coalesce(v.is_public, false),
    'is_owner', v.user_id is not distinct from v_me, 'created', v.created,
    'cards', coalesce((
      select jsonb_agg(
               public.card_json(ulc.card_id)
               || jsonb_build_object('owned', exists (
                    select 1 from public.user_card uc
                     where uc.card_id = ulc.card_id and uc.user_id = v_me))
               order by ulc.created)
        from public.user_list_card ulc where ulc.user_list_id = p_list_id), '[]'::jsonb));
end $$;
grant execute on function public.list_detail(bigint) to anon, authenticated;

-- my_lists: the caller's own lists (so a client island — e.g. "Add to list" on a
-- card page — can load them without knowing its own collector_id). When p_card_id
-- is given, `has` flags lists that already contain that card.
create or replace function public.my_lists(p_card_id bigint default null)
returns table (user_list_id bigint, name text, summary text, card_count integer,
               is_public boolean, created timestamptz, has boolean)
language sql stable security definer set search_path = public as $$
  select ul.user_list_id, ul.name, ul.summary, ul.card_count, ul.is_public, ul.created,
         (p_card_id is not null and exists (
            select 1 from public.user_list_card ulc
             where ulc.user_list_id = ul.user_list_id and ulc.card_id = p_card_id)) as has
    from public.user_list ul
   where ul.user_id = public.current_collector_id()
   order by ul.created desc;
$$;
grant execute on function public.my_lists(bigint) to authenticated;

-- series_completion: for every series the caller owns ≥1 card in, owned-distinct
-- vs the published checklist size (series.card_count — NOT a COUNT(*) of rows).
create or replace function public.series_completion()
returns table (series_id bigint, series_name text, series_slug text, set_name text,
               total integer, owned bigint)
language sql stable security definer set search_path = public as $$
  select s.series_id, s.name, s.slug, st.name,
         coalesce(s.card_count, 0) as total,
         count(distinct uc.card_id) as owned
    from public.user_card uc
    join public.card c   on c.card_id = uc.card_id
    join public.series s on s.series_id = c.series_id
    join public.set st   on st.set_id = s.set_id
   where uc.user_id = public.current_collector_id()
   group by s.series_id, s.name, s.slug, st.name, s.card_count
   order by owned desc, s.name;
$$;
grant execute on function public.series_completion() to authenticated;
