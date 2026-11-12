-- Admin ingestion foundation: role gate, slug + find-or-create helpers, count
-- triggers, and the unique indexes that make the upsert/import RPCs race-safe.
-- All idempotent; re-apply via `npm run db:app` (a `migration/` run cascades these
-- away — re-run afterward). INVARIANT: never FORCE ROW LEVEL SECURITY on catalog
-- tables — the admin model relies on DEFINER functions (owner postgres) bypassing
-- unforced RLS. Admin RPCs still gate every call with assert_admin().

-- ── role gate ──────────────────────────────────────────────────────────────
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;
grant execute on function public.is_admin() to authenticated;

create or replace function public.assert_admin()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin role required' using errcode = '42501';
  end if;
end;
$$;
grant execute on function public.assert_admin() to authenticated;

create or replace function public.log_admin(
  p_action text, p_entity text, p_entity_id text, p_old jsonb, p_new jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_action_log(user_id, action_type, entity_type, entity_id, old_values, new_values, created)
  values (public.current_collector_id(), p_action, p_entity, p_entity_id, p_old::text, p_new::text, now());
$$;

-- ── slugs ──────────────────────────────────────────────────────────────────
create or replace function public.slugify(p text)
returns text language sql stable set search_path = public as $$
  select nullif(trim(both '-' from regexp_replace(lower(public.unaccent(coalesce(p,''))), '[^a-z0-9]+', '-', 'g')), '');
$$;

-- A slug unique within the named relation, appending -2/-3/... p_ignore_id lets an
-- UPDATE keep its own slug.
create or replace function public.unique_slug(
  p_base text, p_table regclass, p_id_col text, p_ignore_id bigint default null)
returns text language plpgsql stable set search_path = public as $$
declare base text := coalesce(public.slugify(p_base), 'item'); cand text; n int := 1; hit bigint;
begin
  loop
    cand := case when n = 1 then base else base || '-' || n end;
    execute format('select %I from %s where slug = $1 and ($2 is null or %I <> $2) limit 1', p_id_col, p_table::text, p_id_col)
      into hit using cand, p_ignore_id;
    exit when hit is null;
    n := n + 1;
  end loop;
  return cand;
end;
$$;

-- ── player_team find-or-create ──────────────────────────────────────────────
create or replace function public.find_or_create_player_team(p_player_id bigint, p_team_id int)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  select player_team_id into v_id from public.player_team where player_id = p_player_id and team_id = p_team_id limit 1;
  if v_id is null then
    insert into public.player_team(player_id, team_id, card_count, created)
    values (p_player_id, p_team_id, 0, now())
    on conflict (player_id, team_id) do nothing
    returning player_team_id into v_id;
    if v_id is null then
      select player_team_id into v_id from public.player_team where player_id = p_player_id and team_id = p_team_id limit 1;
    end if;
  end if;
  return v_id;
end;
$$;

-- ── dedup + unique indexes (enable `on conflict do nothing`) ────────────────
-- 84 duplicate (card_id, player_team_id) links exist from the legacy data; collapse
-- to one each (keep lowest id) so the unique index below can be created. Idempotent.
delete from public.card_player_team a
  using public.card_player_team b
 where a.card_id = b.card_id and a.player_team_id = b.player_team_id
   and a.card_player_team_id > b.card_player_team_id;

create unique index if not exists ux_cpt_unique on public.card_player_team(card_id, player_team_id);
create unique index if not exists ux_player_team_pt on public.player_team(player_id, team_id);

-- ── count maintenance (writer-agnostic triggers) ────────────────────────────
create or replace function public.trg_cpt_counts()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_player bigint; v_team int; v_delta int;
begin
  v_delta := case tg_op when 'INSERT' then 1 else -1 end;
  select player_id, team_id into v_player, v_team from public.player_team
   where player_team_id = coalesce(new.player_team_id, old.player_team_id);
  update public.player_team set card_count = greatest(0, coalesce(card_count,0)+v_delta)
   where player_team_id = coalesce(new.player_team_id, old.player_team_id);
  update public.player set card_count = greatest(0, coalesce(card_count,0)+v_delta) where player_id = v_player;
  update public.team set card_count = greatest(0, coalesce(card_count,0)+v_delta) where team_id = v_team;
  return null;
end;
$$;
drop trigger if exists aiud_cpt_counts on public.card_player_team;
create trigger aiud_cpt_counts after insert or delete on public.card_player_team
  for each row execute function public.trg_cpt_counts();

create or replace function public.trg_card_series_count()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.series set card_entered_count = coalesce(card_entered_count,0)+1 where series_id = new.series_id;
  elsif tg_op = 'DELETE' then
    update public.series set card_entered_count = greatest(0, coalesce(card_entered_count,0)-1) where series_id = old.series_id;
  elsif tg_op = 'UPDATE' and new.series_id is distinct from old.series_id then
    update public.series set card_entered_count = greatest(0, coalesce(card_entered_count,0)-1) where series_id = old.series_id;
    update public.series set card_entered_count = coalesce(card_entered_count,0)+1 where series_id = new.series_id;
  end if;
  return null;
end;
$$;
drop trigger if exists aiud_card_series_count on public.card;
create trigger aiud_card_series_count after insert or update or delete on public.card
  for each row execute function public.trg_card_series_count();
