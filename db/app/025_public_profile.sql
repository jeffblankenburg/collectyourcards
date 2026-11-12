-- Public profile behavior: pick a @username, flip the profile public/private, and
-- the anon-readable public_profile(username) read (header + favorite cards +
-- public shared views). Columns live in 019; this file is behavior only.
-- Favorites reuse user_card.is_special (the "favorite" flag the owner already
-- toggles) — no new write path. Re-apply via `npm run db:app`.

-- Claim/replace the caller's username. Validates format + reserved names +
-- case-insensitive uniqueness. Lowercases storage for clean URLs.
create or replace function public.profile_set_username(p_username text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_name text := lower(trim(coalesce(p_username,'')));
  v_reserved constant text[] := array[
    'admin','api','u','v','lists','sets','set','series','search','auth','login',
    'collection','completion','submissions','settings','me','www','support','help',
    'about','profile','profiles','card','cards','players','player','teams','team'];
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_name !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'username must be 3–30 chars: letters, numbers, underscore';
  end if;
  if v_name like '\_%' or v_name like '%\_' or v_name like '%\_\_%' then
    raise exception 'username cannot start/end with or repeat underscore';
  end if;
  if v_name = any(v_reserved) then raise exception 'that username is reserved'; end if;
  if exists (select 1 from public.profiles where username = v_name::citext and id <> v_uid) then
    raise exception 'that username is taken';
  end if;

  update public.profiles set username = v_name::citext, updated_at = now() where id = v_uid;
  return jsonb_build_object('username', v_name);
end $$;
grant execute on function public.profile_set_username(text) to authenticated;

-- Toggle public visibility of the caller's profile.
create or replace function public.profile_set_public(p_is_public boolean)
returns void
language sql security definer set search_path = public as $$
  update public.profiles
     set is_public_profile = coalesce(p_is_public, false), updated_at = now()
   where id = auth.uid();
$$;
grant execute on function public.profile_set_public(boolean) to authenticated;

-- The caller's own public-profile settings (so the settings UI can prefill
-- without exposing the profiles table shape to the client). `onboarded` is true
-- once first name, last name AND a username are all set.
create or replace function public.my_profile_settings()
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'username', p.username, 'first_name', p.first_name, 'last_name', p.last_name,
    'display_name', p.display_name, 'is_public_profile', p.is_public_profile,
    'bio', p.bio, 'avatar_url', p.avatar_url,
    'onboarded', (p.first_name is not null and p.last_name is not null and p.username is not null)
  ) from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_profile_settings() to authenticated;

-- Onboarding: set first/last name AND claim a username in one call. Required
-- before a user can use the app. Validates names + username (same rules as
-- profile_set_username), sets display_name from the real name so the phone is
-- never surfaced again.
create or replace function public.profile_complete(p_first text, p_last text, p_username text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_first text := nullif(trim(coalesce(p_first,'')), '');
  v_last  text := nullif(trim(coalesce(p_last,'')),  '');
  v_name  text := lower(trim(coalesce(p_username,'')));
  v_reserved constant text[] := array[
    'admin','api','u','v','lists','sets','set','series','search','auth','login',
    'collection','completion','submissions','settings','onboarding','me','www','support','help',
    'about','profile','profiles','card','cards','players','player','teams','team'];
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_first is null or v_last is null then raise exception 'first and last name are required'; end if;
  if v_name !~ '^[a-z0-9_]{3,30}$' then
    raise exception 'username must be 3–30 chars: letters, numbers, underscore';
  end if;
  if v_name like '\_%' or v_name like '%\_' or v_name like '%\_\_%' then
    raise exception 'username cannot start/end with or repeat underscore';
  end if;
  if v_name = any(v_reserved) then raise exception 'that username is reserved'; end if;
  if exists (select 1 from public.profiles where username = v_name::citext and id <> v_uid) then
    raise exception 'that username is taken';
  end if;

  update public.profiles
     set first_name = v_first, last_name = v_last, username = v_name::citext,
         display_name = v_first || ' ' || v_last, updated_at = now()
   where id = v_uid;
  return jsonb_build_object('username', v_name, 'display_name', v_first || ' ' || v_last);
end $$;
grant execute on function public.profile_complete(text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Public profile read: header + favorite cards (is_special) + public views.
-- Null when the handle doesn't exist or the profile is private (owner bypass).
-- Favorites use the same public-safe slice as shared views (no prices/location).
-- ---------------------------------------------------------------------------
create or replace function public.public_profile(p_username text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
  v_me bigint := public.current_collector_id();
  v_is_owner boolean;
begin
  select collector_id, username, first_name, last_name, display_name, phone, bio, avatar_url, is_public_profile
    into v from public.profiles where username = lower(trim(p_username))::citext;
  if not found then return null; end if;

  v_is_owner := v_me is not distinct from v.collector_id;
  if not coalesce(v.is_public_profile, false) and not v_is_owner then
    return null;
  end if;

  return jsonb_build_object(
    'username', v.username,
    -- PHONE-SAFE: never the phone number (display_name defaults to it at signup).
    'display_name', public.safe_display_name(v.first_name, v.last_name, v.display_name, v.phone),
    'bio', v.bio,
    'avatar_url', v.avatar_url,
    'is_owner', v_is_owner,
    'favorites', coalesce((
      select jsonb_agg(public.public_user_card_json(uc.user_card_id) order by uc.created desc)
      from (
        select uc.user_card_id, uc.created
        from public.user_card uc
        where uc.user_id = v.collector_id and uc.sold_at is null and uc.is_special
        order by uc.created desc
        limit 60
      ) uc), '[]'::jsonb),
    'views', coalesce((
      select jsonb_agg(jsonb_build_object(
               'name', sv.name, 'share_token', sv.share_token,
               'slug', sv.slug, 'updated', sv.updated) order by sv.updated desc)
      from public.saved_view sv
      where sv.user_id = v.collector_id and sv.is_public), '[]'::jsonb)
  );
end $$;
grant execute on function public.public_profile(text) to anon, authenticated;
