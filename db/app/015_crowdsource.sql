-- Crowdsourcing submissions + review (cutover workstream #29) — FOUNDATION +
-- the `set` reference flow. The 8 migrated submission tables were deny-all (RLS
-- on, no policies). This file establishes: owner-insert/read-own + admin-review
-- RLS across all submission types, generic contributor_stats maintenance via
-- triggers, and one fully-wired type (set) as the pattern. Other types (card,
-- series, player, team edits) + the review-queue UI follow in later passes.

-- contributor_stats: sane defaults so the stats upsert needn't list every NOT NULL col.
alter table public.contributor_stats
  alter column total_submissions   set default 0,
  alter column pending_submissions set default 0,
  alter column approved_submissions set default 0,
  alter column rejected_submissions set default 0,
  alter column trust_points        set default 0,
  alter column trust_level         set default 'novice',
  alter column current_streak_days set default 0,
  alter column longest_streak_days set default 0,
  alter column set_submissions        set default 0,
  alter column series_submissions     set default 0,
  alter column card_submissions       set default 0,
  alter column player_edit_submissions set default 0,
  alter column team_edit_submissions  set default 0,
  alter column created_at          set default now();

-- A contributor sees their own stats; admins see everyone's. Rows are only
-- written by the SECURITY DEFINER triggers below (which bypass RLS), never by users.
drop policy if exists p_cs_sel on public.contributor_stats;
create policy p_cs_sel on public.contributor_stats for select to authenticated
  using (user_id = public.current_collector_id() or public.is_admin());

-- Owner-insert / read-own / admin-review RLS across every submission table.
do $$
declare t text;
begin
  foreach t in array array[
    'card_edit_submissions','card_submissions','series_submissions','set_submissions',
    'player_edit_submissions','team_edit_submissions'
  ] loop
    execute format('drop policy if exists p_sub_ins on public.%I', t);
    execute format('create policy p_sub_ins on public.%I for insert to authenticated with check (user_id = public.current_collector_id())', t);
    execute format('drop policy if exists p_sub_sel on public.%I', t);
    execute format('create policy p_sub_sel on public.%I for select to authenticated using (user_id = public.current_collector_id() or public.is_admin())', t);
    execute format('drop policy if exists p_sub_upd on public.%I', t);
    execute format('create policy p_sub_upd on public.%I for update to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- Stats: +total/+pending on new submission (writer-agnostic across all types).
create or replace function public.tg_submission_insert_stats() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.contributor_stats (user_id, total_submissions, pending_submissions, first_submission_at, last_submission_at)
  values (new.user_id, 1, 1, now(), now())
  on conflict (user_id) do update set
    total_submissions   = contributor_stats.total_submissions + 1,
    pending_submissions = contributor_stats.pending_submissions + 1,
    first_submission_at = coalesce(contributor_stats.first_submission_at, now()),
    last_submission_at  = now(),
    updated_at = now();
  return null;
end $$;

-- Stats: on first pending→approved/rejected, move the counters + trust points.
create or replace function public.tg_submission_review_stats() returns trigger
language plpgsql security definer set search_path = public as $$
declare appr int; rej int;
begin
  if coalesce(old.status,'') = 'pending' and new.status in ('approved','rejected') then
    update public.contributor_stats set
      pending_submissions  = greatest(0, pending_submissions - 1),
      approved_submissions = approved_submissions + case when new.status='approved' then 1 else 0 end,
      rejected_submissions = rejected_submissions + case when new.status='rejected' then 1 else 0 end,
      trust_points = greatest(0, trust_points + case when new.status='approved' then 5 else -2 end),
      updated_at = now()
    where user_id = new.user_id
    returning approved_submissions, rejected_submissions into appr, rej;
    if appr is not null then
      update public.contributor_stats
         set approval_rate = case when (appr + rej) > 0 then round(appr::numeric * 100 / (appr + rej), 2) else 0 end
       where user_id = new.user_id;
    end if;
  end if;
  return null;
end $$;

-- Attach both stats triggers to every submission table.
do $$
declare t text;
begin
  foreach t in array array[
    'card_edit_submissions','card_submissions','series_submissions','set_submissions',
    'player_edit_submissions','team_edit_submissions'
  ] loop
    execute format('drop trigger if exists ai_sub_stats on public.%I', t);
    execute format('create trigger ai_sub_stats after insert on public.%I for each row execute function public.tg_submission_insert_stats()', t);
    execute format('drop trigger if exists au_sub_stats on public.%I', t);
    execute format('create trigger au_sub_stats after update of status on public.%I for each row execute function public.tg_submission_review_stats()', t);
  end loop;
end $$;

-- ── SET reference flow ───────────────────────────────────────────────────────
-- Submit a proposed set (any signed-in user). Status starts 'pending'; the insert
-- trigger bumps the contributor's stats.
create or replace function public.submit_set_submission(
  p_name text, p_year int, p_sport text default 'Baseball',
  p_manufacturer text default null, p_description text default null, p_notes text default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare v_id bigint; v_me bigint := public.current_collector_id();
begin
  if v_me is null then raise exception 'must be signed in'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'set name required'; end if;
  if p_year is null then raise exception 'year required'; end if;
  insert into public.set_submissions
    (user_id, proposed_name, proposed_year, proposed_sport, proposed_manufacturer, proposed_description, submission_notes, status, created_at)
  values
    (v_me, trim(p_name), p_year, coalesce(nullif(trim(p_sport), ''), 'Baseball'), p_manufacturer, p_description, p_notes, 'pending', now())
  returning submission_id into v_id;
  return v_id;
end $$;
grant execute on function public.submit_set_submission(text,int,text,text,text,text) to authenticated;

-- Admin review: approve (creates the set + links created_set_id) or reject. The
-- status change fires the review-stats trigger. Admin-gated.
create or replace function public.review_set_submission(p_submission_id bigint, p_approve boolean, p_notes text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v record; v_set_id int; v_admin bigint := public.current_collector_id();
begin
  perform public.assert_admin();
  select * into v from public.set_submissions where submission_id = p_submission_id for update;
  if not found then raise exception 'submission % not found', p_submission_id using errcode='P0002'; end if;
  if v.status <> 'pending' then raise exception 'submission already %', v.status; end if;
  if p_approve then
    v_set_id := public.admin_create_set(v.proposed_name, v.proposed_year, null, null);
    update public.set_submissions set status='approved', created_set_id=v_set_id,
      reviewed_by=v_admin, reviewed_at=now(), review_notes=p_notes, updated_at=now()
      where submission_id = p_submission_id;
  else
    update public.set_submissions set status='rejected',
      reviewed_by=v_admin, reviewed_at=now(), review_notes=p_notes, updated_at=now()
      where submission_id = p_submission_id;
  end if;
  return jsonb_build_object('submission_id', p_submission_id,
    'status', case when p_approve then 'approved' else 'rejected' end, 'created_set_id', v_set_id);
end $$;
grant execute on function public.review_set_submission(bigint,boolean,text) to authenticated;
